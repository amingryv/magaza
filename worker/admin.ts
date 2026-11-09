import type { Ctx } from "./router";
import { HttpError, json, readJson } from "./http";
import { allow, ipKey } from "./ratelimit";
import { IMAGE_FOLDERS } from "./images";
import {
  admin,
  currentSession,
  endSession,
  hashPassword,
  passwordProblem,
  requireAdminHeader,
  startSession,
  verifyPassword,
} from "./auth";
import { APP_VERSION, DEFAULTS, SECRET_PREFIXES, parseValue } from "../src/shared/settings";
import { SECTORS, sectorStatements } from "./sectors";
import { escHtml, sendTelegram } from "./telegram";

const now = () => new Date().toISOString();

async function settingsRows(env: Env): Promise<Record<string, unknown>> {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r) => [r.key, parseValue(r.value)]));
}

const putSetting = (env: Env, key: string, value: unknown) =>
  // always JSON, so a name like "123" stays a string when read back
  env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(
    key,
    JSON.stringify(value),
  );

/** Five tries per 15 minutes per IP for login and setup. */
async function guard(c: Ctx, what: string): Promise<void> {
  if (!(await allow(c.env, `${what}:${await ipKey(c.req)}`, 5, 900)))
    throw new HttpError(429, "Çox cəhd edildi. 15 dəqiqə sonra yenidən yoxlayın");
}

/* ---------- open endpoints ---------- */

export async function setupStatus({ env, req }: Ctx): Promise<Response> {
  const [adm, done] = await env.DB.batch<{ v: unknown }>([
    env.DB.prepare("SELECT 1 AS v FROM admin WHERE id = 1"),
    env.DB.prepare("SELECT value AS v FROM settings WHERE key = 'setup.completed'"),
  ]);
  return json({
    admin: adm.results.length > 0,
    completed: parseValue(String(done.results[0]?.v ?? "false")) === true,
    logged_in: !!(await currentSession(env, req)),
    version: APP_VERSION,
  });
}

/** First run only: creates the admin and logs in. Closed once an admin exists. */
export async function setup(c: Ctx): Promise<Response> {
  requireAdminHeader(c.req);
  await guard(c, "setup");
  const { password } = await readJson<{ password?: string }>(c.req);
  const bad = passwordProblem(password);
  if (bad) throw new HttpError(400, bad);
  const { hash, salt } = await hashPassword(password!);
  const [ins] = await c.env.DB.batch([
    c.env.DB.prepare("INSERT OR IGNORE INTO admin (id, password_hash, salt, updated_at) VALUES (1, ?, ?, ?)").bind(hash, salt, now()),
  ]);
  if (!ins.meta.changes) throw new HttpError(409, "Admin artıq yaradılıb");
  // a reset (DELETE FROM admin) must also end every old session
  await c.env.DB.prepare("DELETE FROM sessions").run();
  return json({ ok: true }, { headers: { "set-cookie": await startSession(c.env, c.url) } });
}

export async function login(c: Ctx): Promise<Response> {
  requireAdminHeader(c.req);
  await guard(c, "login");
  const { password } = await readJson<{ password?: string }>(c.req);
  const row = await c.env.DB.prepare("SELECT password_hash, salt FROM admin WHERE id = 1").first<{ password_hash: string; salt: string }>();
  if (!row) throw new HttpError(409, "Admin hələ yaradılmayıb");
  if (typeof password !== "string" || !(await verifyPassword(password, row.password_hash, row.salt)))
    throw new HttpError(401, "Şifrə yanlışdır");
  return json({ ok: true }, { headers: { "set-cookie": await startSession(c.env, c.url) } });
}

export async function logout(c: Ctx): Promise<Response> {
  requireAdminHeader(c.req);
  return json({ ok: true }, { headers: { "set-cookie": await endSession(c.env, c.req, c.url) } });
}

/* ---------- account ---------- */

export const changePassword = admin(async (c) => {
  await guard(c, "password");
  const { current, password } = await readJson<{ current?: string; password?: string }>(c.req);
  const row = await c.env.DB.prepare("SELECT password_hash, salt FROM admin WHERE id = 1").first<{ password_hash: string; salt: string }>();
  if (!row || typeof current !== "string" || !(await verifyPassword(current, row.password_hash, row.salt)))
    throw new HttpError(400, "Hazırkı şifrə yanlışdır");
  const bad = passwordProblem(password);
  if (bad) throw new HttpError(400, bad);
  const { hash, salt } = await hashPassword(password!);
  // other devices are logged out; this one stays
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE admin SET password_hash = ?, salt = ?, updated_at = ? WHERE id = 1").bind(hash, salt, now()),
    c.env.DB.prepare("DELETE FROM sessions WHERE token != ?").bind(c.session),
  ]);
  return json({ ok: true });
});

/* ---------- settings ---------- */

const EDITABLE = new Set([...Object.keys(DEFAULTS), "notify.telegram_enabled"]);
const isSecret = (k: string) => SECRET_PREFIXES.some((p) => k.startsWith(p));

/** Every setting (defaults filled in); secrets are summarised, never returned. */
export const getSettings = admin(async ({ env }) => {
  const rows = await settingsRows(env);
  const out: Record<string, unknown> = { ...DEFAULTS };
  for (const [k, v] of Object.entries(rows)) if (!isSecret(k)) out[k] = v;
  return json({
    settings: out,
    telegram: {
      bot: (rows["notify.telegram_bot"] as string) || null,
      has_token: !!rows["notify.telegram_token"],
      connected: !!rows["notify.telegram_chat_id"],
      enabled: rows["notify.telegram_enabled"] === true,
    },
    version: APP_VERSION,
  });
});

/** Partial update: `{ "store.name": "...", ... }`. Unknown keys are refused. */
export const putSettings = admin(async ({ env, req }) => {
  const body = await readJson(req, 200_000);
  const entries = Object.entries(body);
  for (const [k, v] of entries) {
    if (!EDITABLE.has(k)) throw new HttpError(400, `Naməlum ayar: ${k}`);
    if (v === undefined || JSON.stringify(v).length > 50_000) throw new HttpError(400, `Yanlış dəyər: ${k}`);
  }
  if (entries.length) await env.DB.batch(entries.map(([k, v]) => putSetting(env, k, v)));
  return json({ ok: true });
});

/** Setup wizard: starter attributes for a sector. */
export const applySector = admin(async ({ env, req }) => {
  const { sector } = await readJson<{ sector?: string }>(req);
  if (!sector || !(sector in SECTORS)) throw new HttpError(400, "Naməlum sektor");
  const stmts = sectorStatements(env, sector);
  if (stmts.length) await env.DB.batch(stmts);
  await putSetting(env, "store.sector", sector).run();
  return json({ ok: true, created: stmts.length });
});

/* ---------- Telegram ---------- */

type TgResult<T> = { ok: boolean; result?: T; description?: string };

async function tg<T>(token: string, method: string, body?: unknown): Promise<TgResult<T>> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return (await r.json()) as TgResult<T>;
  } catch {
    return { ok: false, description: "network" };
  }
}

const storedToken = async (env: Env) => {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'notify.telegram_token'").first<{ value: string }>();
  return r ? String(parseValue(r.value)) : "";
};

/** Saves the bot token after Telegram confirms it; returns the bot's username. */
export const telegramToken = admin(async ({ env, req }) => {
  const { token } = await readJson<{ token?: string }>(req);
  const t = (token ?? "").trim();
  if (!/^\d{5,}:[\w-]{30,}$/.test(t)) throw new HttpError(400, "Token düzgün deyil");
  const me = await tg<{ username: string }>(t, "getMe");
  if (!me.ok || !me.result) throw new HttpError(400, "Telegram bu tokeni qəbul etmədi");
  await env.DB.batch([
    putSetting(env, "notify.telegram_token", t),
    putSetting(env, "notify.telegram_bot", me.result.username),
    env.DB.prepare("DELETE FROM settings WHERE key = 'notify.telegram_chat_id'"),
    putSetting(env, "notify.telegram_enabled", false),
  ]);
  return json({ bot: me.result.username });
});

type Chat = { id: number; title?: string; first_name?: string };
type Update = { message?: { chat: Chat }; my_chat_member?: { chat: Chat }; channel_post?: { chat: Chat } };

/** Finds the chat that last wrote to the bot (or added it to a group), saves it, sends a test. */
export const telegramConnect = admin(async ({ env }) => {
  const token = await storedToken(env);
  if (!token) throw new HttpError(400, "Əvvəlcə bot tokenini daxil edin");
  const up = await tg<Update[]>(token, "getUpdates", { limit: 100, timeout: 0 });
  if (!up.ok) throw new HttpError(400, "Telegram cavab vermədi. Bir az sonra yenidən yoxlayın");
  const chat = (up.result ?? [])
    .map((u) => (u.message ?? u.my_chat_member ?? u.channel_post)?.chat)
    .filter(Boolean)
    .pop();
  if (!chat) throw new HttpError(404, "Mesaj tapılmadı. Botunuza Telegram-da /start yazın və yenidən basın");
  await env.DB.batch([putSetting(env, "notify.telegram_chat_id", String(chat.id)), putSetting(env, "notify.telegram_enabled", true)]);
  const sent = await sendTelegram(token, String(chat.id), "✅ Mağaza bildirişləri bura gələcək.");
  return json({ ok: true, chat: chat.title || chat.first_name || "", test_sent: sent });
});

export const telegramTest = admin(async ({ env }) => {
  const rows = await settingsRows(env);
  const name = escHtml(String(rows["store.name"] ?? DEFAULTS["store.name"]));
  const sent = await sendTelegram(
    String(rows["notify.telegram_token"] ?? ""),
    String(rows["notify.telegram_chat_id"] ?? ""),
    `🔔 <b>${name}</b>: test bildirişi. Hər şey işləyir.`,
  );
  if (!sent) throw new HttpError(400, "Mesaj getmədi. Telegram-ı yenidən qoşun");
  return json({ ok: true });
});

/* ---------- images ---------- */

const TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/avif": "avif",
};
const FOLDERS = IMAGE_FOLDERS;
const MAX_BYTES = 5 * 1024 * 1024;

/** Raw image body → R2. `?folder=` picks the prefix, `?name=` (uuid[_thumb]) pairs a thumbnail. */
export const upload = admin(async ({ env, req, url }) => {
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = TYPES[type];
  if (!ext) throw new HttpError(415, "Yalnız şəkil faylı (WebP, JPEG, PNG, GIF, AVIF)");
  const folder = url.searchParams.get("folder") ?? "products";
  if (!FOLDERS.has(folder)) throw new HttpError(400, "Yanlış qovluq");
  const name = url.searchParams.get("name") ?? crypto.randomUUID();
  if (!/^[0-9a-f-]{36}(_thumb)?$/.test(name)) throw new HttpError(400, "Yanlış ad");
  const body = await req.arrayBuffer();
  if (!body.byteLength) throw new HttpError(400, "Fayl boşdur");
  if (body.byteLength > MAX_BYTES) throw new HttpError(413, "Şəkil 5 MB-dan böyük ola bilməz");
  const key = `${folder}/${name}.${ext}`;
  await env.IMAGES.put(key, body, { httpMetadata: { contentType: type } });
  return json({ key, url: `/images/${key}` });
});

export const deleteUpload = admin(async ({ env, params }) => {
  const key = params.key;
  if (!key || key.includes("..") || !FOLDERS.has(key.split("/")[0])) throw new HttpError(400, "Yanlış açar");
  await env.IMAGES.delete(key);
  return json({ ok: true });
});
