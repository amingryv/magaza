import type { Lang } from "../src/shared/api-types";
import { publicStore } from "../src/shared/settings";
import type { Ctx } from "./router";

/**
 * Search-engine plumbing. Every indexable page exists once per enabled
 * language; the canonical URL drops search/filter/sort parameters, and the
 * language versions point at each other (hreflang).
 */

/** Pages a crawler should index, by the first path segment after the language. */
const INDEXABLE = new Set(["", "about", "catalog", "p", "page"]);

/** The page's address without filters, search or sort — null when the page should not be indexed. */
export function canonicalPath(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (!["az", "ru", "en"].includes(parts[0] ?? "")) return null; // /admin and the like
  const section = parts[1] ?? "";
  if (parts.length > 2 || !INDEXABLE.has(section)) return null;
  if (section === "catalog" && url.searchParams.get("q")) return null; // search results
  const s = url.searchParams.get("s");
  if ((section === "p" || section === "page") && !s) return null;
  const c = url.searchParams.get("c");
  const query = section === "p" || section === "page" ? `?s=${encodeURIComponent(s!)}` : section === "catalog" && c ? `?c=${encodeURIComponent(c)}` : "";
  return `${section ? `${section}/` : ""}${query}`;
}

/** "/ru/p/?s=x" for lang "ru" and rest "p/?s=x". */
export const langUrl = (origin: string, lang: Lang, rest: string) => `${origin}/${lang}/${rest}`;

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function langs(env: Env): Promise<{ main: Lang; all: Lang[] }> {
  const rows = await env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('store.language', 'store.languages')").all<{
    key: string;
    value: string;
  }>();
  const { language, languages } = publicStore(Object.fromEntries(rows.results.map((r) => [r.key, r.value])));
  return { main: language, all: languages.length ? languages : [language] };
}

export async function robots({ url }: Ctx): Promise<Response> {
  // /api stays open: crawlers render the pages and the product lists come from it
  const body = `User-agent: *\nDisallow: /admin\n\nSitemap: ${url.origin}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

export async function sitemap({ env, url }: Ctx): Promise<Response> {
  const [{ main, all }, products, categories, pages] = await Promise.all([
    langs(env),
    env.DB.prepare("SELECT slug, updated_at FROM products WHERE is_active = 1 ORDER BY id").all<{ slug: string; updated_at: string }>(),
    env.DB.prepare("SELECT slug FROM categories WHERE is_active = 1 ORDER BY sort_order, id").all<{ slug: string }>(),
    env.DB.prepare("SELECT slug FROM pages WHERE is_active = 1 ORDER BY sort_order, id").all<{ slug: string }>(),
  ]);

  const entries: { rest: string; lastmod?: string }[] = [
    { rest: "" },
    { rest: "catalog/" },
    { rest: "about/" },
    ...categories.results.map((c) => ({ rest: `catalog/?c=${encodeURIComponent(c.slug)}` })),
    ...pages.results.map((p) => ({ rest: `page/?s=${encodeURIComponent(p.slug)}` })),
    ...products.results.map((p) => ({ rest: `p/?s=${encodeURIComponent(p.slug)}`, lastmod: p.updated_at.slice(0, 10) })),
  ];

  const out: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`,
  ];
  for (const e of entries) {
    const alts =
      all.length > 1
        ? all.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${xml(langUrl(url.origin, l, e.rest))}"/>`).join("") +
          `<xhtml:link rel="alternate" hreflang="x-default" href="${xml(langUrl(url.origin, main, e.rest))}"/>`
        : "";
    for (const l of all) {
      out.push(`<url><loc>${xml(langUrl(url.origin, l, e.rest))}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}${alts}</url>`);
    }
  }
  out.push(`</urlset>`);
  return new Response(out.join("\n"), {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
