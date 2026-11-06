import type { Ctx } from "./router";
import { HttpError } from "./http";

/*
 * Own admin auth (no Cloudflare Access): one admin row, PBKDF2-SHA256 with a
 * random salt, random session tokens stored as their SHA-256 in `sessions`,
 * sent as an HttpOnly + SameSite=Strict cookie.
 */

const ITERATIONS = 100_000; // the most PBKDF2 iterations Workers allow
const SESSION_DAYS = 30;
const COOKIE = "admin_session";
const enc = new TextEncoder();

const hex = (b: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)));
const randomHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)));

async function derive(password: string, salt: string, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(salt), iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Stored as `pbkdf2-sha256$<iterations>$<hex>` so the cost can change later. */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomHex(16);
  return { hash: `pbkdf2-sha256$${ITERATIONS}$${hex(await derive(password, salt, ITERATIONS))}`, salt };
}

export async function verifyPassword(password: string, stored: string, salt: string): Promise<boolean> {
  const [algo, iter, want] = stored.split("$");
  if (algo !== "pbkdf2-sha256" || !want) return false;
  const got = await derive(password, salt, Number(iter));
  const exp = unhex(want);
  return got.byteLength === exp.byteLength && crypto.subtle.timingSafeEqual(got, exp);
}

export const passwordProblem = (p: unknown): string | null =>
  typeof p !== "string" || p.length < 8 ? "Şifrə ən azı 8 simvol olmalıdır" : p.length > 200 ? "Şifrə çox uzundur" : null;

const sha = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

function readCookie(req: Request): string | null {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9a-f]{64})`));
  return m ? m[1] : null;
}

function cookie(url: URL, value: string, maxAge: number): string {
  // browsers accept Secure on http://localhost, but not every dev setup does
  const local = url.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(url.hostname);
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${local ? "" : "; Secure"}`;
}

/** Creates a session and returns its Set-Cookie header. */
export async function startSession(env: Env, url: URL): Promise<string> {
  const token = randomHex(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(new Date().toISOString()),
    env.DB.prepare("INSERT INTO sessions (token, expires_at) VALUES (?, ?)").bind(await sha(token), expires),
  ]);
  return cookie(url, token, SESSION_DAYS * 86400);
}

export async function endSession(env: Env, req: Request, url: URL): Promise<string> {
  const token = readCookie(req);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(await sha(token)).run();
  return cookie(url, "", 0);
}

/** The hashed token of a live session, or null. */
export async function currentSession(env: Env, req: Request): Promise<string | null> {
  const token = readCookie(req);
  if (!token) return null;
  const id = await sha(token);
  const row = await env.DB.prepare("SELECT 1 FROM sessions WHERE token = ? AND expires_at > ?")
    .bind(id, new Date().toISOString())
    .first();
  return row ? id : null;
}

/**
 * Admin writes must carry `x-admin: 1`. A cross-site page cannot add that
 * header without a CORS preflight (which we never allow), so together with
 * SameSite=Strict this closes CSRF, uploads included.
 */
export function requireAdminHeader(req: Request): void {
  if (req.method !== "GET" && req.method !== "HEAD" && req.headers.get("x-admin") !== "1") throw new HttpError(403, "İcazə yoxdur");
}

type Handler = (c: Ctx & { session: string }) => Response | Promise<Response>;

/** Wraps an admin handler: no live session → 401. */
export const admin =
  (h: Handler) =>
  async (c: Ctx): Promise<Response> => {
    requireAdminHeader(c.req);
    const session = await currentSession(c.env, c.req);
    if (!session) throw new HttpError(401, "Giriş tələb olunur");
    return h({ ...c, session });
  };
