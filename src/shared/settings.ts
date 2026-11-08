import type { ApiStore, FormField, Lang, Text } from "./api-types";

/**
 * Every setting has a default here, so a shop that never set a key (or an
 * old shop after an update adds a new key) keeps working. Values in D1 are
 * strings: JSON when they parse as JSON, otherwise plain text.
 * Nothing here is shop-specific.
 */
/** Code version, shown in the admin panel; bump it with CHANGELOG.md. */
export const APP_VERSION = "0.7.0";

/** Fonts bundled into the build (CSS family names). Only these reach the page's CSS. */
export const FONTS: Record<string, string> = {
  "Inter Tight": '"Inter Tight Variable"',
  Manrope: '"Manrope Variable"',
  Montserrat: '"Montserrat Variable"',
  Onest: '"Onest Variable"',
  "Playfair Display": '"Playfair Display Variable"',
  System: "system-ui",
};

export const DEFAULT_FORM_FIELDS: FormField[] = [
  { key: "name", visible: true, required: true },
  { key: "phone", visible: true, required: true },
  { key: "address", visible: true, required: false },
  { key: "note", visible: true, required: false },
];

export const DEFAULTS: Record<string, unknown> = {
  "store.name": "Mağaza",
  "store.description": "",
  "store.logo": null,
  "store.favicon": null,
  "store.currency": "AZN",
  "store.currency_symbol": "₼",
  "store.language": "az",
  "store.languages": ["az", "ru", "en"],
  "theme.primary_color": "#0a0a0a",
  "theme.secondary_color": "#ff6f5e",
  "theme.paper_color": "#ffffff",
  "theme.font": "Inter Tight",
  "theme.layout": "grid",
  "contact.phone": "",
  "contact.whatsapp": "",
  "contact.email": "",
  "contact.address": "",
  "contact.hours": "",
  "contact.instagram": "",
  "contact.facebook": "",
  "contact.tiktok": "",
  "contact.map_url": "",
  "orders.enabled": true,
  "orders.min_amount": 0,
  "orders.delivery_note": "",
  "orders.form_fields": DEFAULT_FORM_FIELDS,
  "notify.whatsapp_button_enabled": false,
  "home.banners": [],
  "home.featured_category_ids": [],
  "seo.title": "",
  "seo.description": "",
  "setup.completed": false,
};

/** Keys that must never leave the server through a public endpoint. */
export const SECRET_PREFIXES = ["notify.telegram_", "admin."];

export function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const LANGS: Lang[] = ["az", "ru", "en"];
const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANGS as string[]).includes(v);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const bool = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const text = (v: unknown): Text => (v && typeof v === "object" && !Array.isArray(v) ? (v as Text) : str(v));
const color = (v: unknown, fallback: string) => (/^#[0-9a-f]{3,8}$/i.test(str(v)) ? str(v) : fallback);

/** Raw D1 rows → the public store object. Only whitelisted fields are read. */
export function publicStore(rows: Record<string, string>): ApiStore {
  const get = (key: string) => (key in rows ? parseValue(rows[key]) : DEFAULTS[key]);
  const language = isLang(get("store.language")) ? (get("store.language") as Lang) : "az";
  const langsRaw = get("store.languages");
  const languages = (Array.isArray(langsRaw) ? langsRaw.filter(isLang) : []) as Lang[];
  if (!languages.includes(language)) languages.unshift(language);
  const fields = get("orders.form_fields");

  return {
    name: str(get("store.name")) || str(DEFAULTS["store.name"]),
    description: text(get("store.description")),
    logo: str(get("store.logo")) || null,
    favicon: str(get("store.favicon")) || null,
    currency: { code: str(get("store.currency")) || "AZN", symbol: str(get("store.currency_symbol")) || "₼" },
    language,
    languages,
    theme: {
      primary: color(get("theme.primary_color"), "#0a0a0a"),
      secondary: color(get("theme.secondary_color"), "#ff6f5e"),
      paper: color(get("theme.paper_color"), "#ffffff"),
      font: str(get("theme.font")) in FONTS ? str(get("theme.font")) : "Inter Tight",
      layout: get("theme.layout") === "list" ? "list" : "grid",
    },
    contact: {
      phone: str(get("contact.phone")),
      whatsapp: str(get("contact.whatsapp")).replace(/\D/g, ""),
      email: str(get("contact.email")),
      address: text(get("contact.address")),
      hours: text(get("contact.hours")),
      instagram: str(get("contact.instagram")),
      facebook: str(get("contact.facebook")),
      tiktok: str(get("contact.tiktok")),
      map_url: str(get("contact.map_url")),
    },
    orders: {
      enabled: bool(get("orders.enabled")),
      min_amount: num(get("orders.min_amount")),
      delivery_note: text(get("orders.delivery_note")),
      form_fields: Array.isArray(fields) ? (fields as FormField[]) : DEFAULT_FORM_FIELDS,
    },
    whatsapp_button: bool(get("notify.whatsapp_button_enabled")),
    home: {
      banners: Array.isArray(get("home.banners")) ? (get("home.banners") as ApiStore["home"]["banners"]) : [],
      featured_category_ids: Array.isArray(get("home.featured_category_ids"))
        ? (get("home.featured_category_ids") as unknown[]).map(Number).filter(Number.isFinite)
        : [],
    },
    seo: { title: str(get("seo.title")), description: str(get("seo.description")) },
    setup_completed: bool(get("setup.completed")),
  };
}

/** Picks the visitor's language out of a Text, falling back to the main one. */
export function pickText(t: Text | null | undefined, lang: Lang, main: Lang): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  return t[lang] || t[main] || Object.values(t).find(Boolean) || "";
}
