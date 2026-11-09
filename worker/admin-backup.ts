import { HttpError, json, readJson } from "./http";
import { admin } from "./auth";
import { APP_VERSION, SECRET_PREFIXES } from "../src/shared/settings";

/*
 * Full JSON backup of the shop's data (not the admin password, sessions,
 * Telegram token or the pictures — those stay in R2 and are referenced by key).
 * Restore replaces everything in one D1 batch, so it either all lands or
 * nothing changes. Row ids are kept, so orders still point at their lines.
 *
 * A new migration that adds a column must add it here too; a backup from an
 * older version simply lacks it and the column takes its default.
 */

const TABLES = {
  settings: ["key", "value"],
  categories: ["id", "parent_id", "name", "slug", "image", "sort_order", "is_active", "translations"],
  attributes: ["id", "name", "key", "type", "options", "unit", "filterable", "is_variant", "category_ids", "sort_order", "translations"],
  products: [
    "id", "category_id", "name", "slug", "description", "price", "old_price", "stock", "sku", "images", "attributes",
    "is_active", "is_featured", "sort_order", "created_at", "updated_at", "translations", "search_text", "sold_count",
  ],
  product_variants: ["id", "product_id", "options", "price", "old_price", "stock", "sku", "image", "sort_order"],
  pages: ["id", "slug", "title", "content", "is_active", "show_in_menu", "sort_order", "translations", "updated_at"],
  orders: [
    "id", "order_number", "customer_name", "customer_phone", "customer_data", "total", "status", "admin_note", "notified",
    "created_at", "updated_at", "lang",
  ],
  order_items: ["id", "order_id", "product_id", "variant_id", "product_name", "variant_text", "price", "quantity"],
} as const;
type Table = keyof typeof TABLES;
const ORDER = Object.keys(TABLES) as Table[];

/** Settings a restore never touches: secrets, and keys that describe this install. */
const KEEP = (k: string) => SECRET_PREFIXES.some((p) => k.startsWith(p)) || k === "app.schema" || k === "setup.completed";

export const FORMAT = "magaza-backup";

/** Every table as one JSON-ready object (the format `importBackup` reads). */
export async function buildBackup(env: Env) {
  const res = await env.DB.batch(ORDER.map((t) => env.DB.prepare(`SELECT ${TABLES[t].join(", ")} FROM ${t}${t === "settings" ? "" : " ORDER BY id"}`)));
  const tables = Object.fromEntries(ORDER.map((t, i) => [t, res[i].results])) as Record<Table, Record<string, unknown>[]>;
  tables.settings = tables.settings.filter((r) => !KEEP(String(r.key)));
  return { format: FORMAT, version: 1, app_version: APP_VERSION, created_at: new Date().toISOString(), tables };
}

export const exportBackup = admin(async ({ env }) => {
  const day = new Date().toISOString().slice(0, 10);
  return json(await buildBackup(env), {
    headers: { "content-disposition": `attachment; filename="magaza-${day}.json"` },
  });
});

/*
 * Weekly copies in R2 under `backups/` (never served by /images). The cron in
 * wrangler.jsonc calls `writeAutoBackup`; the panel lists and downloads them.
 */
const PREFIX = "backups/";
const KEEP_COPIES = 8;
const NAME = /^magaza-d{4}-d{2}-d{2}.json$/;

export async function writeAutoBackup(env: Env) {
  const name = `magaza-${new Date().toISOString().slice(0, 10)}.json`;
  await env.IMAGES.put(PREFIX + name, JSON.stringify(await buildBackup(env)), { httpMetadata: { contentType: "application/json" } });
  const old = (await listCopies(env)).slice(KEEP_COPIES).map((c) => PREFIX + c.name);
  if (old.length) await env.IMAGES.delete(old);
}

async function listCopies(env: Env) {
  const list = await env.IMAGES.list({ prefix: PREFIX, limit: 1000 });
  return list.objects
    .map((o) => ({ name: o.key.slice(PREFIX.length), size: o.size, created_at: o.uploaded.toISOString() }))
    .filter((c) => NAME.test(c.name))
    .sort((a, b) => b.name.localeCompare(a.name));
}

export const listAutoBackups = admin(async ({ env }) => json({ items: await listCopies(env) }));

export const getAutoBackup = admin(async ({ env, params }) => {
  if (!NAME.test(params.name ?? "")) throw new HttpError(400, "Yanlış ad");
  const obj = await env.IMAGES.get(PREFIX + params.name);
  if (!obj) throw new HttpError(404, "Nüsxə tapılmadı");
  return new Response(obj.body, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
});

const scalar = (v: unknown) => v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";

/** Splits rows so no single bound JSON parameter grows past D1's value size limit. */
function chunks(rows: Record<string, unknown>[], maxChars = 500_000): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let size = 0;
  for (const r of rows) {
    const s = JSON.stringify(r);
    if (s.length > 1_800_000) throw new HttpError(400, "Ehtiyat nüsxəsində çox böyük sətir var");
    if (cur.length && size + s.length > maxChars) {
      out.push(`[${cur.join(",")}]`);
      cur = [];
      size = 0;
    }
    cur.push(s);
    size += s.length + 1;
  }
  if (cur.length) out.push(`[${cur.join(",")}]`);
  return out;
}

export const importBackup = admin(async ({ env, req }) => {
  const body = await readJson<{ format?: unknown; tables?: unknown }>(req, 90_000_000);
  if (body.format !== FORMAT || !body.tables || typeof body.tables !== "object") throw new HttpError(400, "Bu fayl mağazanın ehtiyat nüsxəsi deyil");
  const src = body.tables as Record<string, unknown>;

  const data = {} as Record<Table, Record<string, unknown>[]>;
  for (const t of ORDER) {
    const rows = src[t] ?? [];
    if (!Array.isArray(rows)) throw new HttpError(400, `Ehtiyat nüsxəsi zədəlidir (${t})`);
    for (const r of rows)
      if (!r || typeof r !== "object" || Array.isArray(r) || !Object.values(r as object).every(scalar))
        throw new HttpError(400, `Ehtiyat nüsxəsi zədəlidir (${t})`);
    data[t] = rows as Record<string, unknown>[];
  }
  data.settings = data.settings.filter((r) => typeof r.key === "string" && !KEEP(r.key));

  const stmts: D1PreparedStatement[] = [
    ...[...ORDER].reverse().map((t) =>
      t === "settings"
        ? env.DB.prepare("DELETE FROM settings WHERE key NOT LIKE 'notify.telegram\\_%' ESCAPE '\\' AND key NOT LIKE 'admin.%' AND key NOT IN ('app.schema', 'setup.completed')")
        : env.DB.prepare(`DELETE FROM ${t}`),
    ),
  ];
  for (const t of ORDER) {
    const rows = data[t];
    if (!rows.length) continue;
    // only columns the backup has; missing ones take their default
    const have = new Set(rows.flatMap((r) => Object.keys(r)));
    const cols = TABLES[t].filter((c) => have.has(c));
    // categories point at each other: parents are set in a second pass
    const pick = (c: string) => (t === "categories" && c === "parent_id" ? "NULL" : `json_extract(value, '$.${c}')`);
    for (const part of chunks(rows))
      stmts.push(env.DB.prepare(`INSERT INTO ${t} (${cols.join(", ")}) SELECT ${cols.map(pick).join(", ")} FROM json_each(?)`).bind(part));
    if (t === "categories" && cols.includes("parent_id"))
      for (const part of chunks(rows.filter((r) => r.parent_id != null).map((r) => ({ id: r.id, parent_id: r.parent_id }))))
        stmts.push(
          env.DB.prepare(
            `UPDATE categories SET parent_id = (SELECT json_extract(j.value, '$.parent_id') FROM json_each(?1) j WHERE json_extract(j.value, '$.id') = categories.id)
             WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?1))`,
          ).bind(part),
        );
  }

  try {
    await env.DB.batch(stmts);
  } catch (e) {
    console.error("import", e);
    throw new HttpError(400, "Ehtiyat nüsxəsi bərpa olunmadı: fayl zədəlidir və ya başqa versiyadandır. Heç nə dəyişmədi");
  }
  return json({ ok: true, counts: Object.fromEntries(ORDER.map((t) => [t, data[t].length])) });
});
