/** A stable, non-reversible id for the caller's IP (raw IPs are never stored). */
export async function ipKey(req: Request): Promise<string> {
  const ip = req.headers.get("cf-connecting-ip") ?? "local";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return [...new Uint8Array(hash).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fixed-window counter in D1. Returns true while `key` is within `max` hits
 * per `windowSec`. One statement, so concurrent requests count correctly.
 */
export async function allow(env: Env, key: string, max: number, windowSec: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, window_end) VALUES (?1, 1, ?2 + ?3)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_end <= ?2 THEN 1 ELSE count + 1 END,
       window_end = CASE WHEN window_end <= ?2 THEN ?2 + ?3 ELSE window_end END
     RETURNING count`,
  )
    .bind(key, now, windowSec)
    .first<{ count: number }>();
  // now and then, drop windows that ended a day ago
  if (Math.random() < 0.02) await env.DB.prepare("DELETE FROM rate_limits WHERE window_end < ?").bind(now - 86400).run();
  return (row?.count ?? 0) <= max;
}
