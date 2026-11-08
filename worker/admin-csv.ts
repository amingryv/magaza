import { HttpError, json, readJson } from "./http";
import { admin } from "./auth";
import { flag, int, money, parse, searchText, text } from "./admin-catalog";
import { normalizeSearch, slugify } from "../src/shared/text";
import type { AttributeType } from "../src/shared/api-types";

/*
 * Products to and from a spreadsheet. The panel parses the CSV and sends rows
 * of up to 100; a row with a code (SKU) that already exists updates that
 * product, any other row creates one. A field that is absent from the row is
 * left alone; a field sent as null is cleared. Pictures, variants and
 * translations are not part of the sheet and are never touched.
 */

type B = Record<string, unknown>;
type Attr = { id: number; key: string; type: AttributeType; options: string | null; is_variant: number };
type Cat = { id: number; name: string; slug: string };
type Existing = {
  id: number; sku: string; name: string; description: string | null; price: number; old_price: number | null; stock: number | null;
  category_id: number | null; attributes: string | null; translations: string | null; is_active: number; is_featured: number; variants: string | null;
};

/** Every product as a flat row (the panel turns it into CSV). */
export const exportProducts = admin(async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT p.name, p.sku, p.price, p.old_price, p.stock, p.description, p.is_active, p.is_featured, p.attributes, c.name AS category,
       (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variants
     FROM products p LEFT JOIN categories c ON c.id = p.category_id ORDER BY p.created_at DESC, p.id DESC`,
  ).all<B & { attributes: string | null; is_active: number; is_featured: number }>();
  return json({ items: results.map((r) => ({ ...r, attributes: parse(r.attributes, {}), is_active: !!r.is_active, is_featured: !!r.is_featured })) });
});

const present = (o: B, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export const importProducts = admin(async ({ env, req }) => {
  const body = await readJson<{ rows?: unknown }>(req, 3_000_000);
  if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 100) throw new HttpError(400, "Sətirlər yanlışdır");
  const rows = (body.rows as unknown[]).map((r) => (r && typeof r === "object" && !Array.isArray(r) ? (r as B) : {}));
  const skus = [...new Set(rows.map((r) => (typeof r.sku === "string" ? r.sku.trim() : "")).filter(Boolean))];

  const [catsR, attrsR, oldR, slugsR] = await env.DB.batch([
    env.DB.prepare("SELECT id, name, slug FROM categories"),
    env.DB.prepare("SELECT id, key, type, options, is_variant FROM attributes"),
    env.DB.prepare(
      `SELECT p.id, p.sku, p.name, p.description, p.price, p.old_price, p.stock, p.category_id, p.attributes, p.translations, p.is_active, p.is_featured,
         (SELECT json_group_array(json_object('o', json(v.options), 's', v.sku)) FROM product_variants v WHERE v.product_id = p.id) AS variants
       FROM products p WHERE p.sku IN (SELECT value FROM json_each(?)) ORDER BY p.id`,
    ).bind(JSON.stringify(skus)),
    env.DB.prepare("SELECT slug FROM products"),
  ]);
  const cats = catsR.results as Cat[];
  const attrs = new Map((attrsR.results as Attr[]).filter((a) => !a.is_variant).map((a) => [a.key, a]));
  const bySku = new Map<string, Existing>();
  for (const p of oldR.results as Existing[]) if (!bySku.has(p.sku)) bySku.set(p.sku, p);
  const slugs = new Set((slugsR.results as { slug: string }[]).map((r) => r.slug));

  // categories by name or link; missing ones are created first
  const catKey = (s: string) => normalizeSearch(s);
  const findCat = (s: string) => cats.find((c) => catKey(c.name) === catKey(s) || c.slug === s.trim());
  const wanted = [...new Set(rows.map((r) => (typeof r.category === "string" ? r.category.trim().slice(0, 120) : "")).filter(Boolean))];
  const missing = wanted.filter((n, i) => !findCat(n) && wanted.findIndex((m) => catKey(m) === catKey(n)) === i);
  if (missing.length) {
    const taken = new Set(cats.map((c) => c.slug));
    const stmts = missing.map((name) => {
      const base = slugify(name) || "kateqoriya";
      let slug = base;
      for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
      taken.add(slug);
      return env.DB.prepare(
        `INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories)) RETURNING id, name, slug`,
      ).bind(name, slug);
    });
    for (const r of await env.DB.batch<Cat>(stmts)) cats.push(r.results[0]);
  }
  const catName = (id: number | null) => (id ? (cats.find((c) => c.id === id)?.name ?? "") : "");

  const newOptions = new Map<string, unknown[]>();
  const optionsOf = (a: Attr) => newOptions.get(a.key) ?? parse<unknown[]>(a.options, []);
  const value = (a: Attr, v: unknown): unknown => {
    if (v === null || v === "") return undefined;
    if (a.type === "number") {
      const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n)) throw new HttpError(400, `${a.key}: rəqəm olmalıdır`);
      return n;
    }
    if (a.type === "boolean") return /^(1|true|bəli|beli|hə|he|yes|да)$/i.test(String(v).trim());
    const list = (a.type === "multiselect" ? String(v).split("|") : [String(v)]).map((s) => s.trim().slice(0, 80)).filter(Boolean);
    if (a.type !== "text") {
      // a value the list does not have yet is added to it
      const opts = optionsOf(a);
      const has = new Set(opts.map((o) => (typeof o === "string" ? o : String((o as B).value))));
      const add = list.filter((s) => !has.has(s));
      if (add.length) newOptions.set(a.key, [...opts, ...add.map((s) => (a.type === "color" ? { value: s } : s))]);
    }
    return a.type === "multiselect" ? list : a.type === "text" ? String(v).trim().slice(0, 300) : list[0];
  };

  const now = new Date().toISOString();
  const writes: D1PreparedStatement[] = [];
  const errors: { line: number; error: string }[] = [];
  let created = 0;
  let updated = 0;

  rows.forEach((r, i) => {
    const line = int(r.line, "line", 1, 10_000_000) ?? i + 1;
    try {
      const sku = typeof r.sku === "string" && r.sku.trim() ? text(r.sku, "Kod", 60) : null;
      const old = sku ? bySku.get(sku) : undefined;
      const pick = <T>(k: string, read: () => T, fallback: T): T => (present(r, k) ? read() : fallback);

      const name = pick("name", () => text(r.name, "Ad", 200, true), old?.name ?? "");
      if (!name) throw new HttpError(400, "Ad boş ola bilməz");
      const price = pick("price", () => money(r.price, "Qiymət"), old?.price ?? null);
      if (price === null) throw new HttpError(400, "Qiymət daxil edin");
      let oldPrice = pick("old_price", () => money(r.old_price, "Köhnə qiymət"), old?.old_price ?? null);
      if (oldPrice === 0) oldPrice = null;
      const hasVariants = !!old && parse<string[]>(old.variants, []).length > 0;
      const stock = hasVariants ? null : pick("stock", () => int(r.stock, "Stok", 0, 1_000_000), old?.stock ?? null);
      const description = pick("description", () => text(r.description, "Təsvir", 20_000) || null, old?.description ?? null);
      const category = pick(
        "category",
        () => (typeof r.category === "string" && r.category.trim() ? findCat(r.category.trim().slice(0, 120))!.id : null),
        old?.category_id ?? null,
      );
      const active = pick("is_active", () => flag(r.is_active), old ? old.is_active : 1);
      const featured = pick("is_featured", () => flag(r.is_featured), old ? old.is_featured : 0);

      const at: B = { ...parse<B>(old?.attributes ?? null, {}) };
      if (r.attributes && typeof r.attributes === "object" && !Array.isArray(r.attributes))
        for (const [k, v] of Object.entries(r.attributes as B)) {
          const a = attrs.get(k);
          if (!a) continue;
          const x = value(a, v);
          if (x === undefined) delete at[k];
          else at[k] = x;
        }

      const variantText = parse<{ o: B; s: string | null }[]>(old?.variants ?? null, []).flatMap((v) => [...Object.values(v.o ?? {}).map(String), v.s ?? ""]);
      const search = searchText(name, old?.translations ?? null, sku, catName(category), at, variantText);

      if (old) {
        writes.push(
          env.DB.prepare(
            `UPDATE products SET name = ?, price = ?, old_price = ?, stock = ?, description = ?, category_id = ?, is_active = ?, is_featured = ?,
               attributes = ?, search_text = ?, updated_at = ?
             WHERE id = COALESCE(NULLIF(?, -1), (SELECT MAX(id) FROM products WHERE sku = ?))`,
          ).bind(name, price, oldPrice, stock, description, category, active, featured, JSON.stringify(at), search, now, old.id, sku),
        );
        updated++;
      } else {
        const base = slugify(name) || "mehsul";
        let slug = base;
        for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
        slugs.add(slug);
        writes.push(
          env.DB.prepare(
            `INSERT INTO products (category_id, name, slug, description, price, old_price, stock, sku, images, attributes, is_active, is_featured, sort_order, created_at, updated_at, search_text)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, 0, ?, ?, ?)`,
          ).bind(category, name, slug, description, price, oldPrice, stock, sku, JSON.stringify(at), active, featured, now, now, search),
        );
        created++;
        // a later row with the same code updates the one just made (id -1 = the newest with this code)
        if (sku) bySku.set(sku, { id: -1, sku, name, description, price, old_price: oldPrice, stock, category_id: category, attributes: JSON.stringify(at), translations: null, is_active: active, is_featured: featured, variants: "[]" });
      }
    } catch (e) {
      errors.push({ line, error: e instanceof HttpError ? e.message : "Yanlış sətir" });
    }
  });

  for (const [k, opts] of newOptions) writes.push(env.DB.prepare("UPDATE attributes SET options = ? WHERE key = ?").bind(JSON.stringify(opts), k));
  if (writes.length) await env.DB.batch(writes);
  return json({ created, updated, errors, categories_created: missing.length });
});
