import { HttpError, json, readJson } from "./http";
import { admin } from "./auth";
import { imageUrl, thumbUrl } from "./catalog";
import { normalizeSearch, slugify } from "../src/shared/text";
import type { AttributeType } from "../src/shared/api-types";

/*
 * Admin CRUD for categories, attributes and products (+ variants).
 * Everything is validated here; the panel is only a convenience.
 */

type B = Record<string, unknown>;
const now = () => new Date().toISOString();

/* ── validation ──────────────────────────────────────────── */

export const bad = (msg: string): never => {
  throw new HttpError(400, msg);
};

export function text(v: unknown, label: string, max: number, required = false): string {
  if (v == null) v = "";
  if (typeof v !== "string") bad(`${label}: mətn olmalıdır`);
  const s = (v as string).trim();
  if (required && !s) bad(`${label} boş ola bilməz`);
  if (s.length > max) bad(`${label} çox uzundur (maks. ${max})`);
  return s;
}
export const opt = (v: unknown, label: string, max: number) => text(v, label, max) || null;

export function int(v: unknown, label: string, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) bad(`${label}: yanlış rəqəm`);
  return n;
}
export const money = (v: unknown, label: string) => int(v, label, 0, 1_000_000_000);
export const flag = (v: unknown) => (v === true || v === 1 || v === "1" ? 1 : 0);

export function translations(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "object" || Array.isArray(v)) bad("Tərcümələr yanlışdır");
  const out: Record<string, unknown> = {};
  for (const [lang, val] of Object.entries(v as B)) {
    if (!["az", "ru", "en"].includes(lang)) continue;
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    // drop empty strings so the main language shows instead
    const clean = Object.fromEntries(Object.entries(val as B).filter(([, x]) => x !== "" && x != null));
    if (Object.keys(clean).length) out[lang] = clean;
  }
  if (!Object.keys(out).length) return null;
  const s = JSON.stringify(out);
  if (s.length > 50_000) bad("Tərcümələr çox uzundur");
  return s;
}

export function idList(v: unknown, max = 500): number[] {
  if (!Array.isArray(v) || !v.length || v.length > max) bad("Siyahı yanlışdır");
  return (v as unknown[]).map((x) => int(x, "id", 1, Number.MAX_SAFE_INTEGER)!);
}

export const parse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
};

const IMAGE_KEY = /^(products|categories|banners|brand)\/[\w.-]{1,120}$/;
const imageKey = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !IMAGE_KEY.test(v) || v.includes("..")) bad("Şəkil açarı yanlışdır");
  return v as string;
};

/** "ad" → "ad", or "ad-2", "ad-3"... when taken (by another row). */
export async function uniqueSlug(env: Env, table: "products" | "categories" | "pages", wanted: string, selfId: number | null): Promise<string> {
  const base = slugify(wanted) || ({ products: "mehsul", categories: "kateqoriya", pages: "sehife" } as const)[table];
  const { results } = await env.DB.prepare(`SELECT slug FROM ${table} WHERE (slug = ?1 OR slug LIKE ?2) AND id != ?3`)
    .bind(base, `${base}-%`, selfId ?? 0)
    .all<{ slug: string }>();
  const taken = new Set(results.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Deletes R2 pictures (and their thumbnails) that no product, variant or category uses any more. */
async function cleanupImages(env: Env, keys: string[]): Promise<void> {
  const own = [...new Set(keys)].filter((k) => k.startsWith("products/") || k.startsWith("categories/"));
  if (!own.length) return;
  const list = JSON.stringify(own);
  const { results } = await env.DB.prepare(
    `SELECT j.value AS k FROM products p, json_each(p.images) j WHERE j.value IN (SELECT value FROM json_each(?1))
     UNION SELECT image FROM product_variants WHERE image IN (SELECT value FROM json_each(?1))
     UNION SELECT image FROM categories WHERE image IN (SELECT value FROM json_each(?1))`,
  )
    .bind(list)
    .all<{ k: string }>();
  const used = new Set(results.map((r) => r.k));
  const drop = own.filter((k) => !used.has(k)).flatMap((k) => (k.endsWith(".webp") ? [k, k.replace(/\.webp$/, "_thumb.webp")] : [k]));
  if (drop.length) await env.IMAGES.delete(drop);
}

/* ── categories ──────────────────────────────────────────── */

type CatRow = { id: number; parent_id: number | null; name: string; slug: string; image: string | null; sort_order: number; is_active: number; translations: string | null };

export const listCategories = admin(async ({ env }) => {
  const { results } = await env.DB.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS products
     FROM categories c ORDER BY c.sort_order, c.id`,
  ).all<CatRow & { products: number }>();
  return json({
    items: results.map((c) => ({
      ...c,
      is_active: !!c.is_active,
      image_url: c.image ? imageUrl(c.image) : null,
      translations: parse(c.translations, null),
    })),
  });
});

async function categoryInput(env: Env, body: B, selfId: number | null) {
  const name = text(body.name, "Ad", 120, true);
  const parent = int(body.parent_id, "Üst kateqoriya", 1, Number.MAX_SAFE_INTEGER);
  if (parent !== null) {
    const { results } = await env.DB.prepare("SELECT id, parent_id FROM categories").all<{ id: number; parent_id: number | null }>();
    const up = new Map(results.map((r) => [r.id, r.parent_id]));
    if (!up.has(parent)) bad("Üst kateqoriya tapılmadı");
    // walking up from the new parent must never reach this category
    for (let at: number | null | undefined = parent, n = 0; at != null && n < 100; at = up.get(at), n++)
      if (at === selfId) bad("Kateqoriya öz alt kateqoriyasının içinə qoyula bilməz");
  }
  return {
    name,
    parent,
    slug: await uniqueSlug(env, "categories", text(body.slug, "Link", 80) || name, selfId),
    image: imageKey(body.image),
    is_active: body.is_active === undefined ? 1 : flag(body.is_active),
    translations: translations(body.translations),
  };
}

export const createCategory = admin(async ({ env, req }) => {
  const c = await categoryInput(env, await readJson(req), null);
  const row = await env.DB.prepare(
    `INSERT INTO categories (parent_id, name, slug, image, sort_order, is_active, translations)
     VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM categories), ?, ?) RETURNING id`,
  )
    .bind(c.parent, c.name, c.slug, c.image, c.is_active, c.translations)
    .first<{ id: number }>();
  return json({ id: row!.id, slug: c.slug }, { status: 201 });
});

export const updateCategory = admin(async ({ env, req, params, exec }) => {
  const id = int(params.id, "id", 1, Number.MAX_SAFE_INTEGER)!;
  const old = await env.DB.prepare("SELECT image FROM categories WHERE id = ?").bind(id).first<{ image: string | null }>();
  if (!old) throw new HttpError(404, "Kateqoriya tapılmadı");
  const c = await categoryInput(env, await readJson(req), id);
  await env.DB.prepare("UPDATE categories SET parent_id = ?, name = ?, slug = ?, image = ?, is_active = ?, translations = ? WHERE id = ?")
    .bind(c.parent, c.name, c.slug, c.image, c.is_active, c.translations, id)
    .run();
  if (old.image && old.image !== c.image) exec.waitUntil(cleanupImages(env, [old.image]));
  return json({ ok: true, slug: c.slug });
});

/** Sub-categories move up one level; products keep existing without a category. */
export const deleteCategory = admin(async ({ env, params, exec }) => {
  const id = int(params.id, "id", 1, Number.MAX_SAFE_INTEGER)!;
  const row = await env.DB.prepare("SELECT parent_id, image FROM categories WHERE id = ?").bind(id).first<{ parent_id: number | null; image: string | null }>();
  if (!row) throw new HttpError(404, "Kateqoriya tapılmadı");
  await env.DB.batch([
    env.DB.prepare("UPDATE categories SET parent_id = ? WHERE parent_id = ?").bind(row.parent_id, id),
    env.DB.prepare("UPDATE products SET category_id = NULL WHERE category_id = ?").bind(id),
    env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id),
  ]);
  if (row.image) exec.waitUntil(cleanupImages(env, [row.image]));
  return json({ ok: true });
});

/** `{ ids: [...] }` in the new order (any subset; positions follow the list). */
export const reorder = (table: "categories" | "attributes" | "pages") =>
  admin(async ({ env, req }) => {
    const ids = idList((await readJson<B>(req)).ids, 1000);
    await env.DB.prepare(
      `UPDATE ${table} SET sort_order = (SELECT j.key FROM json_each(?1) j WHERE j.value = ${table}.id)
       WHERE id IN (SELECT value FROM json_each(?1))`,
    )
      .bind(JSON.stringify(ids))
      .run();
    return json({ ok: true });
  });

/* ── attributes ──────────────────────────────────────────── */

const TYPES: AttributeType[] = ["text", "number", "select", "multiselect", "color", "boolean"];
const WITH_OPTIONS = new Set<AttributeType>(["select", "multiselect", "color"]);

type AttrRow = { id: number; name: string; key: string; type: AttributeType; options: string | null; unit: string | null; filterable: number; is_variant: number; category_ids: string | null; sort_order: number; translations: string | null };

const toAttr = (a: AttrRow) => ({
  ...a,
  options: parse<unknown[]>(a.options, []),
  filterable: !!a.filterable,
  is_variant: !!a.is_variant,
  category_ids: parse<number[]>(a.category_ids, []),
  translations: parse(a.translations, null),
});

export const listAttributes = admin(async ({ env }) => {
  const { results } = await env.DB.prepare("SELECT * FROM attributes ORDER BY sort_order, id").all<AttrRow>();
  return json({ items: results.map(toAttr) });
});

function attributeInput(body: B, type: AttributeType) {
  let options: unknown[] | null = null;
  if (WITH_OPTIONS.has(type)) {
    if (!Array.isArray(body.options) || body.options.length > 300) bad("Seçimlər yanlışdır");
    const seen = new Set<string>();
    options = [];
    for (const o of body.options as unknown[]) {
      const value = text(typeof o === "object" && o ? (o as B).value : o, "Seçim", 80);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      if (type === "color") {
        const hex = typeof o === "object" && o ? String((o as B).hex ?? "") : "";
        options.push(/^#[0-9a-f]{6}$/i.test(hex) ? { value, hex: hex.toLowerCase() } : { value });
      } else options.push(value);
    }
  }
  const variant = flag(body.is_variant);
  if (variant && type !== "select" && type !== "color") bad("Variant yalnız «Siyahıdan seçim» və «Rəng» tipində ola bilər");
  const cats = Array.isArray(body.category_ids) && body.category_ids.length ? idList(body.category_ids) : [];
  return {
    name: text(body.name, "Ad", 80, true),
    options: options ? JSON.stringify(options) : null,
    unit: opt(body.unit, "Ölçü vahidi", 20),
    filterable: flag(body.filterable),
    is_variant: variant,
    category_ids: cats.length ? JSON.stringify(cats) : null,
    translations: translations(body.translations),
  };
}

const attrType = (v: unknown): AttributeType => (TYPES.includes(v as AttributeType) ? (v as AttributeType) : bad("Tip yanlışdır"));

export const createAttribute = admin(async ({ env, req }) => {
  const body = await readJson(req);
  const type = attrType(body.type);
  const a = attributeInput(body, type);
  // the key is what product JSON uses; it is fixed once created
  let key = text(body.key, "Açar", 40) || slugify(a.name).replace(/-/g, "_");
  key = key.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "attr";
  const { results } = await env.DB.prepare("SELECT key FROM attributes WHERE key = ? OR key LIKE ?").bind(key, `${key}_%`).all<{ key: string }>();
  const taken = new Set(results.map((r) => r.key));
  if (taken.has(key)) for (let i = 2; ; i++) if (!taken.has(`${key}_${i}`)) { key = `${key}_${i}`; break; }
  const row = await env.DB.prepare(
    `INSERT INTO attributes (name, key, type, options, unit, filterable, is_variant, category_ids, sort_order, translations)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM attributes), ?) RETURNING id`,
  )
    .bind(a.name, key, type, a.options, a.unit, a.filterable, a.is_variant, a.category_ids, a.translations)
    .first<{ id: number }>();
  return json({ id: row!.id, key }, { status: 201 });
});

export const updateAttribute = admin(async ({ env, req, params }) => {
  const id = int(params.id, "id", 1, Number.MAX_SAFE_INTEGER)!;
  const old = await env.DB.prepare("SELECT type FROM attributes WHERE id = ?").bind(id).first<{ type: AttributeType }>();
  if (!old) throw new HttpError(404, "Xüsusiyyət tapılmadı");
  const body = await readJson(req);
  const type = body.type === undefined ? old.type : attrType(body.type);
  const a = attributeInput(body, type);
  await env.DB.prepare(
    "UPDATE attributes SET name = ?, type = ?, options = ?, unit = ?, filterable = ?, is_variant = ?, category_ids = ?, translations = ? WHERE id = ?",
  )
    .bind(a.name, type, a.options, a.unit, a.filterable, a.is_variant, a.category_ids, a.translations, id)
    .run();
  return json({ ok: true });
});

/** Product values under this key stay in their JSON (harmless, and back if the key is re-created). */
export const deleteAttribute = admin(async ({ env, params }) => {
  const id = int(params.id, "id", 1, Number.MAX_SAFE_INTEGER)!;
  await env.DB.prepare("DELETE FROM attributes WHERE id = ?").bind(id).run();
  return json({ ok: true });
});

/* ── products ────────────────────────────────────────────── */

type ProdRow = {
  id: number; category_id: number | null; name: string; slug: string; description: string | null; price: number; old_price: number | null;
  stock: number | null; sku: string | null; images: string | null; attributes: string | null; is_active: number; is_featured: number;
  sort_order: number; created_at: string; updated_at: string; translations: string | null; sold_count: number;
};
type VarRow = { id: number; product_id: number; options: string; price: number | null; old_price: number | null; stock: number | null; sku: string | null; image: string | null; sort_order: number };

/** GET ?q=&category=<id|none>&status=active|inactive&page=&limit= */
export const listAdminProducts = admin(async ({ env, url }) => {
  const sp = url.searchParams;
  const where: string[] = [];
  const binds: unknown[] = [];
  const words = normalizeSearch(sp.get("q") ?? "").split(" ").filter(Boolean).slice(0, 6);
  for (const w of words) {
    where.push("(p.search_text LIKE ? OR p.sku LIKE ?)");
    binds.push(`%${w}%`, `%${w}%`);
  }
  const cat = sp.get("category");
  if (cat === "none") where.push("p.category_id IS NULL");
  else if (cat && /^\d+$/.test(cat)) {
    // the category and everything below it
    where.push(`p.category_id IN (WITH RECURSIVE t(id) AS (SELECT ? UNION SELECT c.id FROM categories c JOIN t ON c.parent_id = t.id) SELECT id FROM t)`);
    binds.push(Number(cat));
  }
  const status = sp.get("status");
  if (status === "active") where.push("p.is_active = 1");
  if (status === "inactive") where.push("p.is_active = 0");
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30));
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows, total] = await env.DB.batch([
    env.DB.prepare(
      `SELECT p.id, p.name, p.slug, p.price, p.old_price, p.stock, p.sku, p.images, p.is_active, p.is_featured, p.category_id,
         (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variants,
         (SELECT SUM(v.stock) FROM product_variants v WHERE v.product_id = p.id) AS variant_stock,
         (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.stock IS NULL) AS untracked
       FROM products p ${w} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    ).bind(...binds, limit, (page - 1) * limit),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM products p ${w}`).bind(...binds),
  ]);
  type L = ProdRow & { variants: number; variant_stock: number | null; untracked: number };
  return json({
    items: (rows.results as L[]).map((p) => {
      const first = parse<string[]>(p.images, [])[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        old_price: p.old_price,
        sku: p.sku,
        category_id: p.category_id,
        is_active: !!p.is_active,
        is_featured: !!p.is_featured,
        thumb: first ? thumbUrl(first) : null,
        variants: p.variants,
        // null = not tracked (anywhere)
        stock: p.variants ? (p.untracked ? null : (p.variant_stock ?? 0)) : p.stock,
      };
    }),
    total: (total.results[0] as { n: number }).n,
    page,
    limit,
  });
});

export const getAdminProduct = admin(async ({ env, params }) => {
  const id = int(params.id, "id", 1, Number.MAX_SAFE_INTEGER)!;
  const [p, v] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id),
    env.DB.prepare("SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order, id").bind(id),
  ]);
  const row = p.results[0] as ProdRow | undefined;
  if (!row) throw new HttpError(404, "Məhsul tapılmadı");
  const images = parse<string[]>(row.images, []);
  return json({
    ...row,
    is_active: !!row.is_active,
    is_featured: !!row.is_featured,
    images: images.map((key) => ({ key, url: imageUrl(key), thumb: thumbUrl(key) })),
    attributes: parse(row.attributes, {}),
    translations: parse(row.translations, null),
    variants: (v.results as VarRow[]).map((x) => ({ ...x, options: parse(x.options, {}) })),
  });
});

/** `products.search_text`: names (all languages), code, category, attribute and variant values. */
export function searchText(name: string, tr: string | null, sku: string | null, catName: string, attrs: Record<string, unknown>, extra: string[]): string {
  const trNames = Object.values(parse<Record<string, B>>(tr, {})).map((x) => (typeof x.name === "string" ? x.name : ""));
  return normalizeSearch([name, ...trNames, sku, catName, ...Object.values(attrs).flat().map(String), ...extra].filter(Boolean).join(" ")).slice(0, 4000);
}

type VariantIn = { id: number | null; options: string; label: string[]; price: number | null; old_price: number | null; stock: number | null; sku: string | null; image: string | null };

/** Validates a product body. Returns column values plus the variant list. */
async function productInput(env: Env, body: B, selfId: number | null) {
  const name = text(body.name, "Ad", 200, true);
  const category = int(body.category_id, "Kateqoriya", 1, Number.MAX_SAFE_INTEGER);
  if (category !== null && !(await env.DB.prepare("SELECT 1 FROM categories WHERE id = ?").bind(category).first()))
    bad("Kateqoriya tapılmadı");
  const price = money(body.price, "Qiymət");
  if (price === null) bad("Qiymət daxil edin");
  const old = money(body.old_price, "Köhnə qiymət");

  if (!Array.isArray(body.images ?? []) || ((body.images as unknown[]) ?? []).length > 12) bad("Ən çox 12 şəkil");
  const images = [...new Set(((body.images as unknown[]) ?? []).map(imageKey).filter(Boolean) as string[])];

  // attribute values: strings, numbers, booleans or string lists; empty ones are dropped
  const attrs: Record<string, unknown> = {};
  const rawAttrs = body.attributes ?? {};
  if (typeof rawAttrs !== "object" || Array.isArray(rawAttrs)) bad("Xüsusiyyətlər yanlışdır");
  for (const [k, v] of Object.entries(rawAttrs as B)) {
    if (!/^[a-z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v === "string" && v.trim()) attrs[k] = text(v, "Xüsusiyyət", 300);
    else if (typeof v === "number" && Number.isFinite(v)) attrs[k] = v;
    else if (typeof v === "boolean") attrs[k] = v;
    else if (Array.isArray(v)) {
      const list = v.filter((x) => typeof x === "string" && x.trim()).map((x) => text(x, "Xüsusiyyət", 80));
      if (list.length) attrs[k] = list.slice(0, 50);
    }
  }

  const rawVars = body.variants ?? [];
  if (!Array.isArray(rawVars) || rawVars.length > 200) bad("Ən çox 200 variant");
  const seen = new Set<string>();
  const variants: VariantIn[] = (rawVars as B[]).map((v) => {
    const o = v.options;
    if (!o || typeof o !== "object" || Array.isArray(o)) bad("Variant seçimləri yanlışdır");
    const entries = Object.entries(o as B)
      .filter(([k, x]) => /^[a-z0-9_]{1,40}$/.test(k) && typeof x === "string" && x.trim())
      .map(([k, x]) => [k, text(x, "Variant", 80)] as const);
    if (!entries.length) bad("Variantın seçimi boşdur");
    const sig = JSON.stringify([...entries].sort());
    if (seen.has(sig)) bad(`Eyni variant iki dəfə: ${entries.map((e) => e[1]).join(" / ")}`);
    seen.add(sig);
    return {
      id: int(v.id, "Variant", 1, Number.MAX_SAFE_INTEGER),
      options: JSON.stringify(Object.fromEntries(entries)),
      label: entries.map((e) => e[1]),
      price: money(v.price, "Variant qiyməti"),
      old_price: money(v.old_price, "Variant köhnə qiyməti"),
      stock: int(v.stock, "Variant stoku", 0, 1_000_000),
      sku: opt(v.sku, "Variant kodu", 60),
      image: imageKey(v.image),
    };
  });

  const tr = translations(body.translations);
  const sku = opt(body.sku, "Kod", 60);
  const catName = category
    ? ((await env.DB.prepare("SELECT name FROM categories WHERE id = ?").bind(category).first<{ name: string }>())?.name ?? "")
    : "";
  const search = searchText(name, tr, sku, catName, attrs, variants.flatMap((v) => [...v.label, v.sku ?? ""]));

  return {
    category,
    name,
    slug: await uniqueSlug(env, "products", text(body.slug, "Link", 80) || name, selfId),
    description: opt(body.description, "Təsvir", 20_000),
    price: price!,
    old_price: old,
    // with variants, stock lives on each variant
    stock: variants.length ? null : int(body.stock, "Stok", 0, 1_000_000),
    sku,
    images: JSON.stringify(images),
    imageList: images,
    attributes: JSON.stringify(attrs),
    is_active: body.is_active === undefined ? 1 : flag(body.is_active),
    is_featured: flag(body.is_featured),
    translations: tr,
    search,
    variants,
  };
}

const variantInsert = (env: Env, productSql: string, product: string | number, v: VariantIn, i: number) =>
  env.DB.prepare(
    `INSERT INTO product_variants (product_id, options, price, old_price, stock, sku, image, sort_order) VALUES (${productSql}, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(product, v.options, v.price, v.old_price, v.stock, v.sku, v.image, i);

export const createProduct = admin(async ({ env, req }) => {
  const p = await productInput(env, await readJson(req), null);
  const t = now();
  const insert = env.DB.prepare(
    `INSERT INTO products (category_id, name, slug, description, price, old_price, stock, sku, images, attributes, is_active, is_featured, sort_order, created_at, updated_at, translations, search_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?) RETURNING id`,
  ).bind(p.category, p.name, p.slug, p.description, p.price, p.old_price, p.stock, p.sku, p.images, p.attributes, p.is_active, p.is_featured, t, t, p.translations, p.search);
  // variants find their product by its unique slug inside the same transaction
  const res = await env.DB.batch([
    insert,
    ...p.variants.map((v, i) => variantInsert(env, "(SELECT id FROM products WHERE slug = ?)", p.slug, v, i)),
  ]);
  return json({ id: (res[0].results[0] as { id: number }).id, slug: p.slug }, { status: 201 });
});

export const updateProduct = admin(async ({ env, req, params, exec }) => {
  const id = int(params.id, "id", 1, Number.MAX_SAFE_INTEGER)!;
  const [oldP, oldV] = await env.DB.batch([
    env.DB.prepare("SELECT images FROM products WHERE id = ?").bind(id),
    env.DB.prepare("SELECT id, image FROM product_variants WHERE product_id = ?").bind(id),
  ]);
  const old = oldP.results[0] as { images: string | null } | undefined;
  if (!old) throw new HttpError(404, "Məhsul tapılmadı");
  const p = await productInput(env, await readJson(req), id);
  const existing = new Set((oldV.results as { id: number }[]).map((r) => r.id));
  const keep = new Set(p.variants.map((v) => v.id).filter((x): x is number => x !== null && existing.has(x)));

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `UPDATE products SET category_id = ?, name = ?, slug = ?, description = ?, price = ?, old_price = ?, stock = ?, sku = ?, images = ?, attributes = ?,
         is_active = ?, is_featured = ?, updated_at = ?, translations = ?, search_text = ? WHERE id = ?`,
    ).bind(p.category, p.name, p.slug, p.description, p.price, p.old_price, p.stock, p.sku, p.images, p.attributes, p.is_active, p.is_featured, now(), p.translations, p.search, id),
  ];
  for (const vid of existing) if (!keep.has(vid)) stmts.push(env.DB.prepare("DELETE FROM product_variants WHERE id = ?").bind(vid));
  p.variants.forEach((v, i) => {
    // variant ids stay stable so carts holding them keep working
    if (v.id !== null && keep.has(v.id))
      stmts.push(
        env.DB.prepare("UPDATE product_variants SET options = ?, price = ?, old_price = ?, stock = ?, sku = ?, image = ?, sort_order = ? WHERE id = ? AND product_id = ?").bind(
          v.options, v.price, v.old_price, v.stock, v.sku, v.image, i, v.id, id,
        ),
      );
    else stmts.push(variantInsert(env, "?", id, v, i));
  });
  await env.DB.batch(stmts);

  const before = [...parse<string[]>(old.images, []), ...(oldV.results as { image: string | null }[]).map((r) => r.image ?? "")].filter(Boolean);
  const gone = before.filter((k) => !p.imageList.includes(k));
  if (gone.length) exec.waitUntil(cleanupImages(env, gone));
  return json({ ok: true, slug: p.slug });
});

/** A hidden copy ("… (kopya)") with the same pictures and variants. */
export const copyProduct = admin(async ({ env, params }) => {
  const id = int(params.id, "id", 1, Number.MAX_SAFE_INTEGER)!;
  const src = await env.DB.prepare("SELECT name, slug FROM products WHERE id = ?").bind(id).first<{ name: string; slug: string }>();
  if (!src) throw new HttpError(404, "Məhsul tapılmadı");
  const name = `${src.name} (kopya)`.slice(0, 200);
  const slug = await uniqueSlug(env, "products", `${src.slug}-kopya`, null);
  const t = now();
  const res = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO products (category_id, name, slug, description, price, old_price, stock, sku, images, attributes, is_active, is_featured, sort_order, created_at, updated_at, translations, search_text)
       SELECT category_id, ?, ?, description, price, old_price, stock, sku, images, attributes, 0, 0, sort_order, ?, ?, translations, search_text FROM products WHERE id = ? RETURNING id`,
    ).bind(name, slug, t, t, id),
    env.DB.prepare(
      `INSERT INTO product_variants (product_id, options, price, old_price, stock, sku, image, sort_order)
       SELECT (SELECT id FROM products WHERE slug = ?), options, price, old_price, stock, sku, image, sort_order FROM product_variants WHERE product_id = ?`,
    ).bind(slug, id),
  ]);
  return json({ id: (res[0].results[0] as { id: number }).id, slug }, { status: 201 });
});

async function removeProducts(env: Env, exec: ExecutionContext, ids: number[]): Promise<void> {
  const list = JSON.stringify(ids);
  const [imgs, vimgs] = await env.DB.batch([
    env.DB.prepare("SELECT j.value AS k FROM products p, json_each(p.images) j WHERE p.id IN (SELECT value FROM json_each(?))").bind(list),
    env.DB.prepare("SELECT image AS k FROM product_variants WHERE image IS NOT NULL AND product_id IN (SELECT value FROM json_each(?))").bind(list),
  ]);
  // order lines keep their snapshot (name, price); variants go with the product
  await env.DB.batch([
    env.DB.prepare("DELETE FROM product_variants WHERE product_id IN (SELECT value FROM json_each(?))").bind(list),
    env.DB.prepare("DELETE FROM products WHERE id IN (SELECT value FROM json_each(?))").bind(list),
  ]);
  const keys = [...imgs.results, ...vimgs.results].map((r) => (r as { k: string }).k);
  exec.waitUntil(cleanupImages(env, keys));
}

export const deleteProduct = admin(async ({ env, params, exec }) => {
  await removeProducts(env, exec, [int(params.id, "id", 1, Number.MAX_SAFE_INTEGER)!]);
  return json({ ok: true });
});

/** `{ ids, action: activate|deactivate|feature|unfeature|category|delete, category_id? }` */
export const bulkProducts = admin(async ({ env, req, exec }) => {
  const body = await readJson(req);
  const ids = idList(body.ids);
  const list = JSON.stringify(ids);
  const set = (sql: string, ...b: unknown[]) =>
    env.DB.prepare(`UPDATE products SET ${sql}, updated_at = ? WHERE id IN (SELECT value FROM json_each(?))`).bind(...b, now(), list).run();
  switch (body.action) {
    case "activate":
      await set("is_active = 1");
      break;
    case "deactivate":
      await set("is_active = 0");
      break;
    case "feature":
      await set("is_featured = 1");
      break;
    case "unfeature":
      await set("is_featured = 0");
      break;
    case "category": {
      const c = int(body.category_id, "Kateqoriya", 1, Number.MAX_SAFE_INTEGER);
      if (c !== null && !(await env.DB.prepare("SELECT 1 FROM categories WHERE id = ?").bind(c).first())) bad("Kateqoriya tapılmadı");
      await set("category_id = ?", c);
      break;
    }
    case "delete":
      await removeProducts(env, exec, ids);
      break;
    default:
      bad("Naməlum əməliyyat");
  }
  return json({ ok: true, count: ids.length });
});
