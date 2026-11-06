import type {
  ApiAttribute,
  ApiCategory,
  ApiFilter,
  ApiFilters,
  ApiPage,
  ApiProduct,
  ApiProductList,
  ApiVariant,
  AttributeOption,
  Bootstrap,
  Translations,
} from "../src/shared/api-types";
import { publicStore } from "../src/shared/settings";
import { normalizeSearch } from "../src/shared/text";
import { HttpError, json } from "./http";
import type { Ctx } from "./router";

/* ── row types (what D1 returns) ─────────────────────────── */

type CategoryRow = {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  image: string | null;
  sort_order: number;
  translations: string | null;
};

type AttributeRow = {
  id: number;
  name: string;
  key: string;
  type: ApiAttribute["type"];
  options: string | null;
  unit: string | null;
  filterable: number;
  is_variant: number;
  category_ids: string | null;
  sort_order: number;
  translations: string | null;
};

type ProductRow = {
  id: number;
  category_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  old_price: number | null;
  stock: number | null;
  sku: string | null;
  images: string | null;
  attributes: string | null;
  is_featured: number;
  created_at: string;
  translations: string | null;
};

type VariantRow = {
  id: number;
  product_id: number;
  options: string;
  price: number | null;
  old_price: number | null;
  stock: number | null;
  sku: string | null;
  image: string | null;
};

/* ── helpers ─────────────────────────────────────────────── */

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

/** An R2 key becomes /images/<key>; absolute paths and URLs stay as stored. */
export function imageUrl(key: string): string {
  if (/^(https?:)?\/\//.test(key) || key.startsWith("/")) return key;
  return `/images/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Uploads store a small copy beside each picture: products/<id>.webp → products/<id>_thumb.webp */
export function thumbUrl(key: string): string {
  if (key.startsWith("products/") && key.endsWith(".webp") && !key.endsWith("_thumb.webp")) {
    return imageUrl(key.replace(/\.webp$/, "_thumb.webp"));
  }
  return imageUrl(key);
}

const ATTR_KEY = /^[a-z0-9_]{1,40}$/;

function intParam(v: string | null, def: number, min: number, max: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || v === null || v === "") return def;
  return Math.min(max, Math.max(min, n));
}

/* ── categories ──────────────────────────────────────────── */

async function categoryRows(env: Env): Promise<CategoryRow[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, parent_id, name, slug, image, sort_order, translations FROM categories WHERE is_active = 1 ORDER BY sort_order, name",
  ).all<CategoryRow>();
  return results;
}

export function buildTree(rows: CategoryRow[]): ApiCategory[] {
  const byId = new Map<number, ApiCategory>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      parent_id: r.parent_id,
      name: r.name,
      slug: r.slug,
      image: r.image ? imageUrl(r.image) : null,
      sort_order: r.sort_order,
      translations: parse<Translations | null>(r.translations, null),
      children: [],
    });
  }
  const roots: ApiCategory[] = [];
  for (const c of byId.values()) {
    const parent = c.parent_id != null ? byId.get(c.parent_id) : undefined;
    // an inactive parent hides its branch's place, not the children: lift them up
    (parent ? parent.children : roots).push(c);
  }
  return roots;
}

/** The category and every category below it. */
function withDescendants(rows: CategoryRow[], id: number): number[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const r of rows) if (r.parent_id === out[i] && !out.includes(r.id)) out.push(r.id);
  return out;
}

/* ── attributes ──────────────────────────────────────────── */

function toAttribute(r: AttributeRow): ApiAttribute {
  return {
    id: r.id,
    name: r.name,
    key: r.key,
    type: r.type,
    options: parse<AttributeOption[]>(r.options, []),
    unit: r.unit,
    filterable: !!r.filterable,
    is_variant: !!r.is_variant,
    category_ids: parse<number[]>(r.category_ids, []),
    sort_order: r.sort_order,
    translations: parse<Translations | null>(r.translations, null),
  };
}

/* ── products ────────────────────────────────────────────── */

function toVariant(v: VariantRow, productPrice: number): ApiVariant {
  return {
    id: v.id,
    options: parse<Record<string, string>>(v.options, {}),
    price: v.price ?? productPrice,
    old_price: v.old_price,
    stock: v.stock,
    sku: v.sku,
    image: v.image ? imageUrl(v.image) : null,
  };
}

function toProduct(p: ProductRow, variants: VariantRow[], cats: Map<number, CategoryRow>): ApiProduct {
  const keys = parse<string[]>(p.images, []).filter((k) => typeof k === "string" && k);
  const cat = p.category_id != null ? cats.get(p.category_id) : undefined;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description ?? "",
    price: p.price,
    old_price: p.old_price,
    stock: p.stock,
    sku: p.sku,
    images: keys.map(imageUrl),
    thumbs: keys.map(thumbUrl),
    category: cat ? { id: cat.id, slug: cat.slug } : null,
    attributes: parse<Record<string, unknown>>(p.attributes, {}),
    is_featured: !!p.is_featured,
    created_at: p.created_at,
    translations: parse<Translations | null>(p.translations, null),
    variants: variants.map((v) => toVariant(v, p.price)),
  };
}

async function variantsFor(env: Env, ids: number[]): Promise<Map<number, VariantRow[]>> {
  const map = new Map<number, VariantRow[]>();
  if (!ids.length) return map;
  const { results } = await env.DB.prepare(
    "SELECT * FROM product_variants WHERE product_id IN (SELECT value FROM json_each(?)) ORDER BY product_id, sort_order, id",
  )
    .bind(JSON.stringify(ids))
    .all<VariantRow>();
  for (const v of results) {
    const list = map.get(v.product_id) ?? [];
    list.push(v);
    map.set(v.product_id, list);
  }
  return map;
}

// Effective price (cheapest variant, or the product's own) and stock state,
// computed in SQL so filters, sorting and paging stay in the database.
const EFFECTIVE = `
  COALESCE((SELECT MIN(COALESCE(v.price, p.price)) FROM product_variants v WHERE v.product_id = p.id), p.price) AS eff_price,
  CASE WHEN EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)
       THEN EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND (v.stock IS NULL OR v.stock > 0))
       ELSE (p.stock IS NULL OR p.stock > 0) END AS in_stock`;

const SORTS: Record<string, string> = {
  new: "created_at DESC, id DESC",
  price_asc: "eff_price ASC, id DESC",
  price_desc: "eff_price DESC, id DESC",
  popular: "is_featured DESC, sold_count DESC, sort_order ASC, created_at DESC, id DESC",
};

/**
 * GET /api/products
 *   category=<slug> (includes sub-categories) · q · min_price · max_price (qəpik)
 *   attr[key]=value (repeat for OR within a key; keys are ANDed) · in_stock=1
 *   featured=1 · ids=1,2,3 · sort=new|price_asc|price_desc|popular · page · limit
 */
export async function listProducts({ env, url }: Ctx): Promise<Response> {
  const sp = url.searchParams;
  const cats = await categoryRows(env);
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const where: string[] = ["p.is_active = 1"];
  const binds: unknown[] = [];

  const catSlug = sp.get("category");
  if (catSlug) {
    const cat = cats.find((c) => c.slug === catSlug);
    if (!cat) return json({ items: [], total: 0, page: 1, limit: 0 } satisfies ApiProductList);
    where.push("p.category_id IN (SELECT value FROM json_each(?))");
    binds.push(JSON.stringify(withDescendants(cats, cat.id)));
  }

  const ids = (sp.get("ids") ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 100);
  if (sp.has("ids")) {
    if (!ids.length) return json({ items: [], total: 0, page: 1, limit: 0 } satisfies ApiProductList);
    where.push("p.id IN (SELECT value FROM json_each(?))");
    binds.push(JSON.stringify(ids));
  }

  const words = normalizeSearch(sp.get("q") ?? "").split(" ").filter(Boolean).slice(0, 6);
  for (const w of words) {
    where.push("p.search_text LIKE ?");
    binds.push(`%${w}%`);
  }

  if (sp.get("featured") === "1") where.push("p.is_featured = 1");

  // attr[color]=Qara&attr[color]=Ağ&attr[size]=M
  const attrs = new Map<string, string[]>();
  for (const [k, v] of sp) {
    const m = /^attr\[([^\]]+)\]$/.exec(k);
    if (!m || !v) continue;
    if (!ATTR_KEY.test(m[1])) throw new HttpError(400, "Yanlış xüsusiyyət açarı");
    attrs.set(m[1], [...(attrs.get(m[1]) ?? []), v]);
  }
  if (attrs.size > 10) throw new HttpError(400, "Çox filtr");
  for (const [key, values] of attrs) {
    const path = `$.${key}`;
    where.push(`(
      EXISTS (SELECT 1 FROM json_each(p.attributes, ?) j WHERE CAST(j.value AS TEXT) IN (SELECT value FROM json_each(?)))
      OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND json_extract(v.options, ?) IN (SELECT value FROM json_each(?)))
    )`);
    const list = JSON.stringify(values.slice(0, 30));
    binds.push(path, list, path, list);
  }

  const outer: string[] = [];
  const outerBinds: unknown[] = [];
  const min = sp.get("min_price");
  const max = sp.get("max_price");
  if (min) {
    outer.push("eff_price >= ?");
    outerBinds.push(intParam(min, 0, 0, Number.MAX_SAFE_INTEGER));
  }
  if (max) {
    outer.push("eff_price <= ?");
    outerBinds.push(intParam(max, 0, 0, Number.MAX_SAFE_INTEGER));
  }
  if (sp.get("in_stock") === "1") outer.push("in_stock = 1");

  const sort = SORTS[sp.get("sort") ?? ""] ?? SORTS.popular;
  const limit = intParam(sp.get("limit"), 24, 1, 100);
  const page = intParam(sp.get("page"), 1, 1, 10_000);

  const base = `WITH x AS (SELECT p.*, ${EFFECTIVE} FROM products p WHERE ${where.join(" AND ")})`;
  const filter = outer.length ? `WHERE ${outer.join(" AND ")}` : "";
  const [rows, count] = await env.DB.batch<ProductRow & { total?: number }>([
    env.DB.prepare(`${base} SELECT * FROM x ${filter} ORDER BY in_stock DESC, ${sort} LIMIT ? OFFSET ?`).bind(
      ...binds,
      ...outerBinds,
      limit,
      (page - 1) * limit,
    ),
    env.DB.prepare(`${base} SELECT COUNT(*) AS total FROM x ${filter}`).bind(...binds, ...outerBinds),
  ]);

  const items = rows.results;
  const variants = await variantsFor(
    env,
    items.map((p) => p.id),
  );
  const body: ApiProductList = {
    items: items.map((p) => toProduct(p, variants.get(p.id) ?? [], catMap)),
    total: Number(count.results[0]?.total ?? 0),
    page,
    limit,
  };
  return json(body);
}

/** GET /api/products/:slug */
export async function getProduct({ env, params }: Ctx): Promise<Response> {
  const p = await env.DB.prepare("SELECT * FROM products WHERE slug = ? AND is_active = 1").bind(params.slug).first<ProductRow>();
  if (!p) throw new HttpError(404, "Məhsul tapılmadı");
  const [cats, variants] = await Promise.all([categoryRows(env), variantsFor(env, [p.id])]);
  return json(toProduct(p, variants.get(p.id) ?? [], new Map(cats.map((c) => [c.id, c]))));
}

/* ── filters ─────────────────────────────────────────────── */

/** GET /api/attributes/filters?category=<slug> — filterable attributes with the values in use. */
export async function listFilters({ env, url }: Ctx): Promise<Response> {
  const cats = await categoryRows(env);
  const slug = url.searchParams.get("category");
  const cat = slug ? cats.find((c) => c.slug === slug) : undefined;
  if (slug && !cat) return json({ attributes: [], price: { min: 0, max: 0 } } satisfies ApiFilters);

  const scope = cat ? withDescendants(cats, cat.id) : null;
  // an attribute limited to some categories shows for those and for their parents' pages
  const pageCats = new Set(scope ?? []);
  for (let id = cat?.parent_id ?? null; id != null; id = cats.find((c) => c.id === id)?.parent_id ?? null) pageCats.add(id);

  const catWhere = scope ? "AND p.category_id IN (SELECT value FROM json_each(?))" : "";
  const catBind = scope ? [JSON.stringify(scope)] : [];
  const [attrs, prods, vars] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare("SELECT * FROM attributes WHERE filterable = 1 ORDER BY sort_order, name"),
    env.DB.prepare(`SELECT p.id, p.price, p.attributes FROM products p WHERE p.is_active = 1 ${catWhere}`).bind(...catBind),
    env.DB.prepare(
      `SELECT v.product_id, v.options, COALESCE(v.price, p.price) AS price FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.is_active = 1 ${catWhere}`,
    ).bind(...catBind),
  ]);

  const defs = (attrs.results as unknown as AttributeRow[]).map(toAttribute).filter(
    (a) => !scope || !a.category_ids.length || a.category_ids.some((id) => pageCats.has(id) || scope.includes(id)),
  );

  // value → set of product ids, per attribute key
  const seen = new Map<string, Map<string, Set<number>>>();
  const note = (key: string, raw: unknown, pid: number) => {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const v of values) {
      if (v === null || v === undefined || v === "") continue;
      const s = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
      const byValue = seen.get(key) ?? new Map<string, Set<number>>();
      seen.set(key, byValue);
      const set = byValue.get(s) ?? new Set<number>();
      set.add(pid);
      byValue.set(s, set);
    }
  };

  let lo = Infinity;
  let hi = 0;
  const withVariants = new Set<number>();
  for (const v of vars.results as { product_id: number; options: string; price: number }[]) {
    withVariants.add(v.product_id);
    lo = Math.min(lo, v.price);
    hi = Math.max(hi, v.price);
    for (const [k, val] of Object.entries(parse<Record<string, unknown>>(v.options, {}))) note(k, val, v.product_id);
  }
  for (const p of prods.results as { id: number; price: number; attributes: string | null }[]) {
    if (!withVariants.has(p.id)) {
      lo = Math.min(lo, p.price);
      hi = Math.max(hi, p.price);
    }
    for (const [k, val] of Object.entries(parse<Record<string, unknown>>(p.attributes, {}))) note(k, val, p.id);
  }

  const out: ApiFilter[] = [];
  for (const a of defs) {
    const byValue = seen.get(a.key);
    if (!byValue?.size) continue;
    const order = a.options.map((o) => (typeof o === "string" ? o : o.value));
    const hex = new Map(a.options.filter((o) => typeof o !== "string").map((o) => [(o as { value: string }).value, (o as { hex?: string }).hex]));
    const values = [...byValue.entries()]
      .map(([value, set]) => ({ value, hex: hex.get(value), count: set.size }))
      .sort((x, y) => {
        const ix = order.indexOf(x.value);
        const iy = order.indexOf(y.value);
        if (ix !== -1 || iy !== -1) return (ix === -1 ? 1e9 : ix) - (iy === -1 ? 1e9 : iy);
        if (a.type === "number") return Number(x.value) - Number(y.value);
        return x.value.localeCompare(y.value, "az");
      });
    out.push({ key: a.key, name: a.name, type: a.type, unit: a.unit, translations: a.translations, values });
  }

  return json({ attributes: out, price: { min: lo === Infinity ? 0 : lo, max: hi } } satisfies ApiFilters);
}

/* ── store, categories, pages, bootstrap ─────────────────── */

async function settingsMap(env: Env): Promise<Record<string, string>> {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

export async function getStore({ env }: Ctx): Promise<Response> {
  return json(publicStore(await settingsMap(env)));
}

export async function getCategories({ env }: Ctx): Promise<Response> {
  return json(buildTree(await categoryRows(env)));
}

type PageRow = { slug: string; title: string; content: string | null; show_in_menu: number; translations: string | null };

export async function getPage({ env, params }: Ctx): Promise<Response> {
  const r = await env.DB.prepare("SELECT slug, title, content, show_in_menu, translations FROM pages WHERE slug = ? AND is_active = 1")
    .bind(params.slug)
    .first<PageRow>();
  if (!r) throw new HttpError(404, "Səhifə tapılmadı");
  const page: ApiPage = {
    slug: r.slug,
    title: r.title,
    content: r.content ?? "",
    show_in_menu: !!r.show_in_menu,
    translations: parse<Translations | null>(r.translations, null),
  };
  return json(page);
}

/** Settings, categories, attributes and the page menu in one round trip. */
export async function loadBootstrap(env: Env): Promise<Bootstrap> {
  const [settings, cats, attrs, menu] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare("SELECT key, value FROM settings"),
    env.DB.prepare("SELECT id, parent_id, name, slug, image, sort_order, translations FROM categories WHERE is_active = 1 ORDER BY sort_order, name"),
    env.DB.prepare("SELECT * FROM attributes ORDER BY sort_order, name"),
    env.DB.prepare("SELECT slug, title, translations FROM pages WHERE is_active = 1 AND show_in_menu = 1 ORDER BY sort_order, title"),
  ]);
  const rows = settings.results as { key: string; value: string }[];
  return {
    store: publicStore(Object.fromEntries(rows.map((r) => [r.key, r.value]))),
    categories: buildTree(cats.results as unknown as CategoryRow[]),
    attributes: (attrs.results as unknown as AttributeRow[]).map(toAttribute),
    menu: (menu.results as { slug: string; title: string; translations: string | null }[]).map((m) => ({
      slug: m.slug,
      title: m.title,
      translations: parse<Translations | null>(m.translations, null),
    })),
  };
}

export async function getBootstrap({ env }: Ctx): Promise<Response> {
  return json(await loadBootstrap(env));
}
