import { admin } from "./auth";
import { HttpError, json, readJson } from "./http";
import { parseValue, publicStore } from "../src/shared/settings";
import { orderMessage, sendTelegram, type MsgLine } from "./telegram";

/*
 * Orders, the dashboard numbers and "send the Telegram message again".
 * notified: 0 = message not delivered (warn), 1 = delivered, 2 = Telegram was
 * not set up when the order came in (nothing to warn about).
 */

export const STATUSES = ["new", "confirmed", "shipped", "completed", "cancelled"] as const;
type Status = (typeof STATUSES)[number];
const isStatus = (v: unknown): v is Status => typeof v === "string" && (STATUSES as readonly string[]).includes(v);

type OrderRow = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_data: string | null;
  total: number;
  status: Status;
  admin_note: string | null;
  notified: number;
  created_at: string;
  updated_at: string;
  lang: string | null;
};
type ItemRow = MsgLine & { id: number; product_id: number | null; variant_id: number | null };

const data = (raw: string | null): { address: string; note: string } => {
  try {
    const d = JSON.parse(raw ?? "{}") as Record<string, unknown>;
    return { address: typeof d.address === "string" ? d.address : "", note: typeof d.note === "string" ? d.note : "" };
  } catch {
    return { address: "", note: "" };
  }
};

const iso = (v: string | null) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

/** GET /api/admin/orders?status=&q=&from=&to=&failed=1&page=&limit= */
export const listOrders = admin(async ({ env, url }) => {
  const p = url.searchParams;
  const page = Math.max(1, Number(p.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(p.get("limit")) || 30));
  const where: string[] = [];
  const args: unknown[] = [];

  const status = p.get("status");
  if (isStatus(status)) {
    where.push("status = ?");
    args.push(status);
  }
  if (p.get("failed") === "1") where.push("notified = 0 AND status != 'cancelled'");
  const from = iso(p.get("from"));
  if (from) {
    where.push("created_at >= ?");
    args.push(from);
  }
  const to = iso(p.get("to"));
  if (to) {
    where.push("created_at < ?");
    args.push(to);
  }
  const q = (p.get("q") ?? "").trim().slice(0, 60);
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.push(`(instr(lower(customer_name), lower(?)) > 0 OR instr(lower(order_number), lower(?)) > 0${digits.length >= 3 ? " OR instr(customer_phone, ?) > 0" : ""})`);
    args.push(q, q);
    if (digits.length >= 3) args.push(digits);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows, count, counts] = await env.DB.batch([
    env.DB.prepare(
      `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.total, o.status, o.notified, o.created_at,
              (SELECT COALESCE(SUM(quantity), 0) FROM order_items i WHERE i.order_id = o.id) AS items
       FROM orders o ${w} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    ).bind(...args, limit, (page - 1) * limit),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM orders ${w}`).bind(...args),
    env.DB.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status"),
  ]);
  return json({
    items: rows.results,
    total: (count.results[0] as { n: number }).n,
    page,
    limit,
    counts: Object.fromEntries((counts.results as { status: string; n: number }[]).map((r) => [r.status, r.n])),
  });
});

async function loadOrder(env: Env, id: number): Promise<{ order: OrderRow; items: ItemRow[] }> {
  const [o, i] = await env.DB.batch([
    env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id),
    env.DB.prepare("SELECT id, product_id, variant_id, product_name AS name, variant_text, price, quantity FROM order_items WHERE order_id = ? ORDER BY id").bind(id),
  ]);
  const order = o.results[0] as OrderRow | undefined;
  if (!order) throw new HttpError(404, "Sifariş tapılmadı");
  return { order, items: i.results as ItemRow[] };
}

const orderId = (raw: string | undefined) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Yanlış nömrə");
  return id;
};

const view = (order: OrderRow, items: ItemRow[]) => {
  const { customer_data, ...rest } = order;
  return { ...rest, ...data(customer_data), items };
};

export const getOrder = admin(async ({ env, params }) => {
  const { order, items } = await loadOrder(env, orderId(params.id));
  return json(view(order, items));
});

/**
 * PATCH { status?, admin_note? }. Stock is never changed by orders: the
 * owner sets it on the product. Only the hidden popularity counter follows
 * cancelling (conditioned on the old status, so it moves once).
 */
export const patchOrder = admin(async ({ env, req, params }) => {
  const id = orderId(params.id);
  const body = await readJson<{ status?: unknown; admin_note?: unknown }>(req, 20_000);
  const { order, items } = await loadOrder(env, id);
  const db = env.DB;
  const now = new Date().toISOString();
  const stmts: D1PreparedStatement[] = [];

  if (body.admin_note !== undefined) {
    if (body.admin_note !== null && typeof body.admin_note !== "string") throw new HttpError(400, "Yanlış qeyd");
    const note = (body.admin_note ?? "").trim().slice(0, 2000);
    stmts.push(db.prepare("UPDATE orders SET admin_note = ?, updated_at = ? WHERE id = ?").bind(note || null, now, id));
  }

  if (body.status !== undefined && body.status !== order.status) {
    if (!isStatus(body.status)) throw new HttpError(400, "Yanlış status");
    const from = order.status;
    const to = body.status;
    const sign = to === "cancelled" ? 1 : from === "cancelled" ? -1 : 0;
    const when = "EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = ?)";
    if (sign) {
      for (const it of items) {
        if (!it.product_id) continue;
        const q = it.quantity * sign;
        stmts.push(db.prepare(`UPDATE products SET sold_count = MAX(0, sold_count - ?) WHERE id = ? AND ${when}`).bind(q, it.product_id, id, from));
      }
    }
    stmts.push(db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?").bind(to, now, id, from));
  }

  if (stmts.length) await db.batch(stmts);
  const fresh = await loadOrder(env, id);
  return json(view(fresh.order, fresh.items));
});

/** POST /api/admin/orders/:id/notify — sends the Telegram message again. */
export const notifyOrder = admin(async ({ env, params, url }) => {
  const id = orderId(params.id);
  const { order, items } = await loadOrder(env, id);
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const raw = Object.fromEntries(results.map((r) => [r.key, r.value]));
  const token = String(parseValue(raw["notify.telegram_token"] ?? "") ?? "");
  const chat = String(parseValue(raw["notify.telegram_chat_id"] ?? "") ?? "");
  if (!token || !chat) throw new HttpError(400, "Telegram qoşulmayıb. Ayarlar bölməsindən qoşun");
  const d = data(order.customer_data);
  const text = orderMessage(
    { id, order_number: order.order_number, name: order.customer_name, phone: order.customer_phone, ...d, total: order.total },
    items,
    publicStore(raw).currency.symbol,
    url.origin,
  );
  if (!(await sendTelegram(token, chat, text))) throw new HttpError(502, "Mesaj getmədi. Telegram qoşulmasını yoxlayın");
  await env.DB.prepare("UPDATE orders SET notified = 1 WHERE id = ?").bind(id).run();
  return json({ ok: true });
});

/**
 * GET /api/admin/stats?today=&week=&month= — the browser sends the start of
 * its own day/week/month (the owner's time zone), as ISO strings.
 */
export const stats = admin(async ({ env, url }) => {
  const p = url.searchParams;
  const day = iso(p.get("today")) ?? new Date(Date.now() - 864e5).toISOString();
  const week = iso(p.get("week")) ?? new Date(Date.now() - 7 * 864e5).toISOString();
  const month = iso(p.get("month")) ?? new Date(Date.now() - 30 * 864e5).toISOString();
  const sum = (since: string) =>
    env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS sum FROM orders WHERE created_at >= ? AND status != 'cancelled'").bind(since);
  const [d, w, m, fresh, failed, recent, tg] = await env.DB.batch([
    sum(day),
    sum(week),
    sum(month),
    env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'"),
    env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE notified = 0 AND status != 'cancelled'"),
    env.DB.prepare(
      "SELECT id, order_number, customer_name, total, status, notified, created_at FROM orders ORDER BY id DESC LIMIT 5",
    ),
    env.DB.prepare("SELECT COUNT(*) AS n FROM settings WHERE key = 'notify.telegram_chat_id'"),
  ]);
  const one = (r: D1Result) => r.results[0] as { n: number; sum?: number };
  return json({
    today: one(d),
    week: one(w),
    month: one(m),
    new_orders: one(fresh).n,
    failed_notifications: one(failed).n,
    telegram_connected: one(tg).n > 0,
    recent: recent.results,
  });
});
