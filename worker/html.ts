import type { Bootstrap, Lang, Translations } from "../src/shared/api-types";
import { FONTS, pickText, publicStore } from "../src/shared/settings";
import { EFFECTIVE, imageUrl, loadBootstrap } from "./catalog";
import { canonicalPath, langUrl } from "./seo";

/**
 * The built HTML holds no shop data. On the way out, the Worker writes the
 * shop into it: name, colours, <title>, description, Open Graph tags and the
 * bootstrap JSON the front reads on start. Shoppers and crawlers get the
 * right page on first paint; nothing is rebuilt when the owner edits.
 */

const LANGS: Lang[] = ["az", "ru", "en"];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** JSON inside <script>: no "</script>" or "<!--" can break out. */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\" + "u003c");

function tx(base: string, translations: Translations | null, field: string, lang: Lang, main: Lang): string {
  if (lang === main) return base;
  const v = translations?.[lang]?.[field];
  return typeof v === "string" && v ? v : base;
}

function clip(s: string, n = 160): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n - 1).trimEnd()}…` : flat;
}

type Meta = { title: string; description: string; image: string | null; ld?: Record<string, unknown> };

type ProductRow = {
  name: string;
  description: string | null;
  images: string | null;
  translations: string | null;
  sku: string | null;
  attributes: string | null;
  eff_price: number;
  max_price: number;
  in_stock: number;
};

function parse<T>(s: string | null, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function pageMeta(env: Env, url: URL, lang: Lang, boot: Bootstrap, pageUrl: string): Promise<Meta> {
  const s = boot.store;
  const main = s.language;
  const tagline = pickText(s.description, lang, main);
  const home: Meta = {
    title: s.seo.title || (tagline ? `${s.name} — ${tagline}` : s.name),
    description: s.seo.description || tagline,
    image: s.logo,
  };
  const parts = url.pathname.split("/").filter(Boolean);
  const section = parts[1];
  const slug = url.searchParams.get("s");
  const titled = (t: string, d?: string, image?: string | null): Meta => ({
    title: `${t} — ${s.name}`,
    description: d || home.description,
    image: image ?? home.image,
  });

  if (section === "p" && slug) {
    const p = await env.DB.prepare(
      `SELECT p.name, p.description, p.images, p.translations, p.sku, p.attributes, ${EFFECTIVE},
         COALESCE((SELECT MAX(COALESCE(v.price, p.price)) FROM product_variants v WHERE v.product_id = p.id), p.price) AS max_price
       FROM products p WHERE p.slug = ? AND p.is_active = 1`,
    )
      .bind(slug)
      .first<ProductRow>();
    if (!p) return home;
    const tr = parse<Translations | null>(p.translations, null);
    const images = parse<unknown[]>(p.images, [])
      .filter((k): k is string => typeof k === "string" && k !== "")
      .map(imageUrl);
    const name = tx(p.name, tr, "name", lang, main);
    const description = clip(tx(p.description ?? "", tr, "description", lang, main), 300);
    const brand = parse<Record<string, unknown>>(p.attributes, {}).brand;
    const money = (n: number) => (n / 100).toFixed(2);
    const availability = `https://schema.org/${p.in_stock ? "InStock" : "OutOfStock"}`;
    const priceCurrency = s.currency.code;
    // Google shows the price and stock state in search results from this
    const ld: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      url: pageUrl,
      ...(description && { description }),
      ...(images.length && { image: images.slice(0, 5).map((i) => new URL(i, url.origin).toString()) }),
      ...(p.sku && { sku: p.sku }),
      ...(typeof brand === "string" && brand && { brand: { "@type": "Brand", name: brand } }),
      offers:
        p.max_price > p.eff_price
          ? { "@type": "AggregateOffer", lowPrice: money(p.eff_price), highPrice: money(p.max_price), priceCurrency, availability }
          : { "@type": "Offer", price: money(p.eff_price), priceCurrency, availability, url: pageUrl },
    };
    return { ...titled(name, clip(description), images[0] ?? null), ld };
  }
  if (section === "catalog") {
    const c = url.searchParams.get("c");
    const flat = boot.categories.flatMap(function walk(x): typeof boot.categories {
      return [x, ...x.children.flatMap(walk)];
    });
    const cat = c ? flat.find((x) => x.slug === c) : undefined;
    return cat ? titled(tx(cat.name, cat.translations, "name", lang, main)) : home;
  }
  if (section === "page" && slug) {
    const m = boot.menu.find((x) => x.slug === slug);
    if (m) return titled(tx(m.title, m.translations, "title", lang, main));
    const r = await env.DB.prepare("SELECT title, translations FROM pages WHERE slug = ? AND is_active = 1")
      .bind(slug)
      .first<{ title: string; translations: string | null }>();
    return r ? titled(tx(r.title, r.translations ? JSON.parse(r.translations) : null, "title", lang, main)) : home;
  }
  return home;
}

export async function injectShop(env: Env, req: Request, res: Response): Promise<Response> {
  const url = new URL(req.url);
  const boot = await loadBootstrap(env);
  const first = url.pathname.split("/")[1] as Lang;
  const lang = LANGS.includes(first) ? first : boot.store.language;
  const store = boot.store;
  const enabled = store.languages.length ? store.languages : [store.language];
  // a language the shop has switched off points search engines at the main one
  const canonLang = enabled.includes(lang) ? lang : store.language;
  const rest = canonicalPath(url);
  const canonical = rest === null ? null : langUrl(url.origin, canonLang, rest);
  const meta = await pageMeta(env, url, lang, boot, canonical ?? url.toString());
  const abs = (u: string | null) => (u ? new URL(u, url.origin).toString() : null);
  const t = boot.store.theme;

  const head = [
    `<style id="brand">:root{--brand-paper:${t.paper};--brand-ink:${t.primary};--brand-accent:${t.secondary}${
      t.font !== "Geist" ? `;--font-sans:${FONTS[t.font]},system-ui,-apple-system,"Segoe UI",sans-serif` : ""
    }}</style>`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(boot.store.name)}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    meta.description ? `<meta property="og:description" content="${esc(meta.description)}">` : "",
    `<meta property="og:url" content="${esc(canonical ?? url.toString())}">`,
    canonical === null ? `<meta name="robots" content="noindex">` : `<link rel="canonical" href="${esc(canonical)}">`,
    rest !== null && enabled.length > 1
      ? enabled.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(langUrl(url.origin, l, rest))}">`).join("") +
        `<link rel="alternate" hreflang="x-default" href="${esc(langUrl(url.origin, store.language, rest))}">`
      : "",
    meta.ld ? `<script type="application/ld+json">${scriptJson(meta.ld)}</script>` : "",
    meta.image ? `<meta property="og:image" content="${esc(abs(meta.image)!)}">` : "",
    `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}">`,
    boot.store.favicon ? `<link rel="icon" href="${esc(boot.store.favicon)}">` : "",
    `<script id="__boot" type="application/json">${scriptJson(boot)}</script>`,
  ].join("");

  let hasTitle = false;
  const rewritten = new HTMLRewriter()
    .on("html", {
      element(el) {
        el.setAttribute("lang", lang);
        if (t.layout === "list") el.setAttribute("data-layout", "list");
      },
    })
    .on("title", {
      element(el) {
        hasTitle = true;
        el.setInnerContent(meta.title);
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute("content", meta.description);
      },
    })
    .on('meta[name="theme-color"]', {
      element(el) {
        el.setAttribute("content", t.paper);
      },
    })
    .on("head", {
      element(el) {
        el.append(head, { html: true });
        // the store pages have no <title> in the build (React would put a
        // generic one back after loading), so it is written here
        el.onEndTag((end) => {
          if (!hasTitle) end.before(`<title>${esc(meta.title)}</title>`, { html: true });
        });
      },
    })
    // the shop's name wherever the build left a placeholder for it
    .on('[data-store="name"]', {
      element(el) {
        el.setInnerContent(boot.store.name);
      },
    })
    .transform(res);

  const headers = new Headers(rewritten.headers);
  headers.delete("etag");
  headers.delete("content-length");
  headers.set("cache-control", "no-cache");
  return new Response(rewritten.body, { status: res.status, statusText: res.statusText, headers });
}

/**
 * "/" → the visitor's saved language (cookie set by the language switch),
 * otherwise the shop's main language. The browser's language is not used:
 * many phones here are set to English or Russian while the shop is Azerbaijani.
 */
export async function rootRedirect(env: Env, req: Request): Promise<Response> {
  const row = await env.DB.prepare("SELECT key, value FROM settings WHERE key IN ('store.language', 'store.languages')").all<{
    key: string;
    value: string;
  }>();
  const { language, languages } = publicStore(Object.fromEntries(row.results.map((r) => [r.key, r.value])));
  const cookie = /(?:^|;\s*)lang=(az|ru|en)/.exec(req.headers.get("cookie") ?? "")?.[1] as Lang | undefined;
  const lang = cookie && languages.includes(cookie) ? cookie : language;
  const to = new URL(`/${lang}/`, req.url);
  return new Response(null, { status: 302, headers: { location: to.toString(), "cache-control": "no-store", vary: "cookie" } });
}
