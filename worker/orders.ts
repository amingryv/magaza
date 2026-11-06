import type { OrderError, OrderRequest, OrderResponse } from "../src/shared/api-types";
import { parseValue, publicStore } from "../src/shared/settings";
import { json, readJson } from "./http";
import { allow, ipKey } from "./ratelimit";
import { escHtml, sendTelegram } from "./telegram";
import type { Ctx } from "./router";

const fail = (status: number, code: OrderError, extra: Record<string, unknown> = {}) => json({ error: code, ...extra }, { status });

/** Azerbaijani numbers in any common form → "+994XXXXXXXXX"; other countries need a leading "+". */
export function normalizePhone(raw: string): string | null {
  const plus = raw.trim().startsWith("+");
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) return `+994${d}`;
  if (d.length === 10 && d.startsWith("0")) return `+994${d.slice(1)}`;
  if (d.length === 12 && d.startsWith("994")) return `+${d}`;
  if (plus && d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, max) : "");

type P = { id: number; name: string; price: number; stock: number | null; has_variants: number };
type V = { id: number; product_id: number; options: string; price: number | null; stock: number | null };

export async function createOrder({ req, env, exec, url }: Ctx): Promise<Response> {
  const body = await readJson<OrderRequest>(req, 20_000);

  // honeypot: answer like a success, store nothing
  if (clean(body.website, 200)) return json({ order_number: "S-0", total: 0, items: [] } satisfies OrderResponse);

  const { results: rows } = await env.DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const store = publicStore(raw);
  if (!store.orders.enabled) return fail(403, "closed");

  if (!(await allow(env, `order:${await ipKey(req)}`, 5, 600))) return fail(429, "rate");

  // the customer
  const name = clean(body.name, 80);
  const phone = normalizePhone(clean(body.phone, 40));
  const fields = { address: clean(body.address, 500), note: clean(body.note, 1000) };
  if (name.length < 2) return fail(400, "required", { field: "name" });
  if (!phone) return fail(400, "phone");
  for (const f of store.orders.form_fields) {
    if (f.visible && f.required && (f.key === "address" || f.key === "note") && !fields[f.key]) return fail(400, "required", { field: f.key });
  }

  // the items: ids and quantities only, merged
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) return fail(400, "invalid");
  const merged = new Map<string, { product_id: number; variant_id: number | null; quantity: number }>();
  for (const it of body.items) {
    const pid = Number(it?.product_id);
    const vid = it?.variant_id == null || Number(it.variant_id) === 0 ? null : Number(it.variant_id);
    const qty = Number(it?.quantity);
    if (!Number.isInteger(pid) || pid <= 0 || (vid !== null && (!Number.isInteger(vid) || vid <= 0)) || !Number.isInteger(qty) || qty < 1 || qty > 99)
      return fail(400, "invalid");
    const k = `${pid}:${vid}`;
    const prev = merged.get(k);
    merged.set(k, { product_id: pid, variant_id: vid, quantity: Math.min(99, (prev?.quantity ?? 0) + qty) });
  }
  const items = [...merged.values()];

  const pids = JSON.stringify([...new Set(items.map((i) => i.product_id))]);
  const vids = JSON.stringify(items.map((i) => i.variant_id).filter((v) => v !== null));
  const [pr, vr] = await env.DB.batch<Record<string, unknown>>([
    env.DB.prepare(
      `SELECT p.id, p.name, p.price, p.stock, EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id) AS has_variants
       FROM products p WHERE p.is_active = 1 AND p.id IN (SELECT value FROM json_each(?))`,
    ).bind(pids),
    env.DB.prepare("SELECT id, product_id, options, price, stock FROM product_variants WHERE id IN (SELECT value FROM json_each(?))").bind(vids),
  ]);
  const products = new Map((pr.results as unknown as P[]).map((p) => [p.id, p]));
  const variants = new Map((vr.results as unknown as V[]).map((v) => [v.id, v]));

  // prices from the database, never from the request
  const lines: OrderResponse["items"] = [];
  for (const it of items) {
    const p = products.get(it.product_id);
    const v = it.variant_id !== null ? variants.get(it.variant_id) : undefined;
    if (!p || (it.variant_id !== null && (!v || v.product_id !== p.id)) || (p.has_variants && !v)) return fail(409, "gone", { product_id: it.product_id });
    const stock = v ? v.stock : p.stock;
    if (stock !== null && stock < it.quantity) return fail(409, "stock", { product_id: p.id, variant_id: it.variant_id, available: Math.max(0, stock) });
    let variantText = "";
    try {
      variantText = v ? Object.values(JSON.parse(v.options) as Record<string, string>).join(" / ") : "";
    } catch {}
    lines.push({ product_id: p.id, variant_id: v?.id ?? null, name: p.name, variant_text: variantText, price: v?.price ?? p.price, quantity: it.quantity });
  }
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  if (store.orders.min_amount > 0 && total < store.orders.min_amount) return fail(400, "min", { min_amount: store.orders.min_amount });

  // one transaction: stock guards first (a failing guard aborts everything),
  // then the order, its lines, the stock and the popularity counters
  const now = new Date().toISOString();
  const db = env.DB;
  const guard = (table: "products" | "product_variants", id: number, qty: number) =>
    db
      .prepare(`SELECT json(CASE WHEN COALESCE((SELECT stock FROM ${table} WHERE id = ?), 1000000000) >= ? THEN '1' ELSE 'out of stock' END)`)
      .bind(id, qty);
  const stmts: D1PreparedStatement[] = [];
  for (const l of lines) stmts.push(l.variant_id ? guard("product_variants", l.variant_id, l.quantity) : guard("products", l.product_id, l.quantity));
  stmts.push(
    db
      .prepare(
        `INSERT INTO orders (order_number, customer_name, customer_phone, customer_data, total, status, created_at, updated_at, lang)
         VALUES ('S-' || (1001 + COALESCE((SELECT MAX(id) FROM orders), 0)), ?, ?, ?, ?, 'new', ?, ?, ?)`,
      )
      .bind(name, phone, JSON.stringify(fields), total, now, now, body.lang ?? store.language),
  );
  for (const l of lines) {
    stmts.push(
      db
        .prepare(
          "INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_text, price, quantity) VALUES ((SELECT MAX(id) FROM orders), ?, ?, ?, ?, ?, ?)",
        )
        .bind(l.product_id, l.variant_id, l.name, l.variant_text || null, l.price, l.quantity),
    );
    if (l.variant_id) stmts.push(db.prepare("UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL").bind(l.quantity, l.variant_id));
    else stmts.push(db.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL").bind(l.quantity, l.product_id));
    stmts.push(db.prepare("UPDATE products SET sold_count = sold_count + ? WHERE id = ?").bind(l.quantity, l.product_id));
  }
  stmts.push(db.prepare("SELECT id, order_number FROM orders WHERE id = (SELECT MAX(id) FROM orders)"));

  let saved: { id: number; order_number: string };
  try {
    const res = await db.batch(stmts);
    saved = res[res.length - 1].results[0] as { id: number; order_number: string };
  } catch (e) {
    // a stock guard fired: someone bought the last pieces a moment ago
    if (String(e).includes("JSON")) return fail(409, "stock");
    throw e;
  }

  // notify after the order is safe; the customer does not wait for Telegram
  const token = String(parseValue(raw["notify.telegram_token"] ?? "") ?? "");
  const chat = String(parseValue(raw["notify.telegram_chat_id"] ?? "") ?? "");
  const on = raw["notify.telegram_enabled"] === undefined ? !!(token && chat) : parseValue(raw["notify.telegram_enabled"]) === true;
  if (on && token && chat) {
    const money = (q: number) => `${(q / 100).toFixed(2)} ${store.currency.symbol}`;
    const text = [
      `🛒 <b>Yeni sifariş #${saved.order_number}</b>`,
      "",
      `👤 ${escHtml(name)}`,
      `📞 ${phone}`,
      fields.address ? `📍 ${escHtml(fields.address)}` : "",
      "",
      ...lines.map((l) => `• ${escHtml(l.name)}${l.variant_text ? ` (${escHtml(l.variant_text)})` : ""} × ${l.quantity} — ${money(l.price * l.quantity)}`),
      "",
      `💰 Cəmi: <b>${money(total)}</b>`,
      fields.note ? `📝 Qeyd: ${escHtml(fields.note)}` : "",
      "",
      `Admin paneldə bax: ${url.origin}/admin/orders/?id=${saved.id}`,
    ]
      .filter((x, i, a) => x !== "" || a[i - 1] !== "")
      .join("\n");
    exec.waitUntil(
      sendTelegram(token, chat, text).then((ok) =>
        ok ? env.DB.prepare("UPDATE orders SET notified = 1 WHERE id = ?").bind(saved.id).run().then(() => undefined) : undefined,
      ),
    );
  }

  return json({ order_number: saved.order_number, total, items: lines } satisfies OrderResponse, { status: 201 });
}
