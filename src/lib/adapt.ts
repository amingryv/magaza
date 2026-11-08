import type { ApiAttribute, ApiCategory, ApiProduct, ApiStore, Bootstrap, FormField, Lang, Text, Translations } from "@/shared/api-types";
import { LANGS, type LocalText } from "./i18n";
import { UNLIMITED, type Category, type Product, type ProductOption, type Spec, type Variant } from "./catalog-types";

/* ── shop settings as the components use them ────────────── */

export type StoreSettings = {
  name: string;
  tagline: LocalText;
  /** owner's SEO title for the home page ("" = name — tagline) */
  seoTitle: string;
  logo: string | null;
  /** digits only, for wa.me links */
  whatsapp: string;
  phoneDisplay: string;
  email: string;
  currency: { code: string; symbol: string };
  languages: Lang[];
  defaultLang: Lang;
  address: LocalText;
  hours: LocalText;
  mapUrl: string;
  socials: { instagram?: string; tiktok?: string; facebook?: string };
  theme: { paper: string; ink: string; accent: string; font: string; layout: "grid" | "list" };
  banners: { image: string; title: LocalText; subtitle: LocalText; link: string }[];
  featuredCategoryIds: number[];
  orders: { enabled: boolean; minAmount: number; deliveryNote: LocalText; formFields: FormField[] };
  whatsappButton: boolean;
};

const fill = (pick: (l: Lang) => string | undefined, fallback: string): LocalText => {
  const out = { az: "" } as LocalText;
  for (const l of LANGS) out[l] = pick(l) || fallback;
  return out;
};

/** Text (plain or per language) → LocalText with every language filled. */
export function localText(t: Text | null | undefined, main: Lang): LocalText {
  if (!t) return fill(() => "", "");
  if (typeof t === "string") return fill(() => t, t);
  const base = t[main] || Object.values(t).find(Boolean) || "";
  return fill((l) => t[l], base);
}

/** A row's main-language text plus its `translations` overrides for one field. */
function rowText(base: string, tr: Translations | null, field: string, main: Lang): LocalText {
  return fill((l) => (l === main ? base : (tr?.[l]?.[field] as string | undefined)), base);
}

export function adaptStore(s: ApiStore): StoreSettings {
  const m = s.language;
  return {
    name: s.name,
    tagline: localText(s.description, m),
    seoTitle: s.seo.title,
    logo: s.logo,
    whatsapp: s.contact.whatsapp,
    phoneDisplay: s.contact.phone,
    email: s.contact.email,
    currency: s.currency,
    languages: s.languages,
    defaultLang: m,
    address: localText(s.contact.address, m),
    hours: localText(s.contact.hours, m),
    mapUrl: s.contact.map_url,
    socials: {
      instagram: s.contact.instagram || undefined,
      tiktok: s.contact.tiktok || undefined,
      facebook: s.contact.facebook || undefined,
    },
    theme: { paper: s.theme.paper, ink: s.theme.primary, accent: s.theme.secondary, font: s.theme.font, layout: s.theme.layout },
    banners: s.home.banners
      .filter((b) => b && typeof b.image === "string" && b.image)
      .map((b) => ({ image: b.image, title: localText(b.title, m), subtitle: localText(b.subtitle, m), link: typeof b.link === "string" ? b.link : "" })),
    featuredCategoryIds: s.home.featured_category_ids,
    orders: {
      enabled: s.orders.enabled,
      minAmount: s.orders.min_amount,
      deliveryNote: localText(s.orders.delivery_note, m),
      formFields: s.orders.form_fields,
    },
    whatsappButton: s.whatsapp_button,
  };
}

/* ── categories ──────────────────────────────────────────── */

export function adaptCategories(tree: ApiCategory[], main: Lang): Category[] {
  const walk = (c: ApiCategory, parent?: string): Category => ({
    id: c.slug,
    dbId: c.id,
    name: rowText(c.name, c.translations, "name", main),
    image: c.image ?? undefined,
    parent,
    children: c.children.map((x) => walk(x, c.slug)),
  });
  return tree.map((c) => walk(c));
}

export function flatCategories(tree: Category[]): Category[] {
  return tree.flatMap((c) => [c, ...flatCategories(c.children)]);
}

/* ── products ────────────────────────────────────────────── */

export type CatalogContext = { main: Lang; attributes: ApiAttribute[]; yes: LocalText; no: LocalText };

const optionValue = (o: ApiAttribute["options"][number]) => (typeof o === "string" ? o : o.value);

function optionName(a: ApiAttribute | undefined, value: string, main: Lang): LocalText {
  return fill((l) => (l === main ? value : (a?.translations?.[l]?.options as Record<string, string> | undefined)?.[value]), value);
}

function attrName(a: ApiAttribute, main: Lang): LocalText {
  return rowText(a.name, a.translations, "name", main);
}

function specValue(a: ApiAttribute, raw: unknown, p: ApiProduct, ctx: CatalogContext): LocalText | null {
  const unit = a.unit ? ` ${a.unit}` : "";
  if (raw === null || raw === undefined || raw === "") return null;
  if (a.type === "boolean") return raw === true || raw === "true" || raw === 1 ? ctx.yes : ctx.no;
  if (Array.isArray(raw)) {
    const parts = raw.map((v) => optionName(a, String(v), ctx.main));
    return fill((l) => parts.map((x) => x[l]).join(", "), parts.map((x) => x.az).join(", "));
  }
  const value = String(raw);
  if (a.type === "select" || a.type === "color") {
    const n = optionName(a, value, ctx.main);
    return fill((l) => n[l] + unit, value + unit);
  }
  // free text: the product's own translation of this attribute, if any
  return fill((l) => {
    if (l === ctx.main) return value + unit;
    const t = (p.translations?.[l]?.attributes as Record<string, string> | undefined)?.[a.key];
    return t ? t + unit : undefined;
  }, value + unit);
}

const paragraphs = (s: string) => s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

export function adaptProduct(p: ApiProduct, ctx: CatalogContext): Product {
  const { main } = ctx;
  const defs = new Map(ctx.attributes.map((a) => [a.key, a]));
  const desc = rowText(p.description, p.translations, "description", main);
  const summary = fill((l) => paragraphs(desc[l] ?? "")[0], "");
  const rest = fill((l) => paragraphs(desc[l] ?? "").slice(1).join("\n\n"), "");

  // options: the variant attributes these variants actually use, in the owner's order
  const keys = [...new Set(p.variants.flatMap((v) => Object.keys(v.options)))];
  keys.sort((a, b) => (defs.get(a)?.sort_order ?? 1e9) - (defs.get(b)?.sort_order ?? 1e9));
  const options: ProductOption[] = keys.map((key) => {
    const a = defs.get(key);
    const used = [...new Set(p.variants.map((v) => v.options[key]).filter(Boolean))];
    const order = (a?.options ?? []).map(optionValue);
    used.sort((x, y) => (order.indexOf(x) + 1 || 1e9) - (order.indexOf(y) + 1 || 1e9));
    return {
      id: key,
      name: a ? attrName(a, main) : fill(() => key, key),
      values: used.map((value) => {
        const def = a?.options.find((o) => optionValue(o) === value);
        return { id: value, name: optionName(a, value, main), swatch: typeof def === "object" ? def.hex : undefined };
      }),
    };
  });

  const variants: Variant[] = p.variants.length
    ? p.variants.map((v) => ({
        id: String(v.id),
        values: v.options,
        price: v.price,
        oldPrice: v.old_price && v.old_price > v.price ? v.old_price : undefined,
        stock: v.stock ?? UNLIMITED,
        image: v.image ?? undefined,
      }))
    : [
        {
          id: "0",
          values: {},
          price: p.price,
          oldPrice: p.old_price && p.old_price > p.price ? p.old_price : undefined,
          stock: p.stock ?? UNLIMITED,
        },
      ];

  const specs: Spec[] = [];
  for (const a of ctx.attributes) {
    if (a.key === "brand" || a.is_variant || !(a.key in p.attributes)) continue;
    const value = specValue(a, p.attributes[a.key], p, ctx);
    if (value) specs.push({ name: attrName(a, main), value });
  }

  const brand = p.attributes.brand;
  return {
    id: String(p.id),
    slug: p.slug,
    category: p.category?.slug ?? "",
    brand: typeof brand === "string" ? brand : "",
    name: rowText(p.name, p.translations, "name", main),
    summary,
    description: rest,
    images: p.images,
    thumbs: p.thumbs,
    options,
    variants,
    specs,
    featured: p.is_featured,
    addedAt: p.created_at,
  };
}

export type SiteData = { store: StoreSettings; categories: Category[]; menu: { slug: string; title: LocalText }[]; ctx: CatalogContext };

export function adaptBootstrap(b: Bootstrap, yes: LocalText, no: LocalText): SiteData {
  const main = b.store.language;
  return {
    store: adaptStore(b.store),
    categories: adaptCategories(b.categories, main),
    menu: b.menu.map((m) => ({ slug: m.slug, title: rowText(m.title, m.translations, "title", main) })),
    ctx: { main, attributes: b.attributes, yes, no },
  };
}
