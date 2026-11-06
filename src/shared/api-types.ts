// The public API's JSON shapes, shared by the Worker (which builds them) and
// the front (which reads them). Money is always integer qəpik.

export type Lang = "az" | "ru" | "en";

/** Owner text: plain (main language) or per language. */
export type Text = string | Partial<Record<Lang, string>>;

/** Per-language overrides stored in a row's `translations` column. */
export type Translations = Partial<Record<Lang, Record<string, unknown>>>;

export type FormField = { key: string; visible: boolean; required: boolean };

export type Banner = { image: string; title?: Text; subtitle?: Text; link?: string };

/** GET /api/store — public settings only (never tokens or chat ids). */
export type ApiStore = {
  name: string;
  description: Text;
  logo: string | null;
  favicon: string | null;
  currency: { code: string; symbol: string };
  language: Lang;
  languages: Lang[];
  theme: { primary: string; secondary: string; paper: string; font: string; layout: "grid" | "list" };
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
    address: Text;
    hours: Text;
    instagram: string;
    facebook: string;
    tiktok: string;
    map_url: string;
  };
  orders: { enabled: boolean; min_amount: number; delivery_note: Text; form_fields: FormField[] };
  whatsapp_button: boolean;
  home: { banners: Banner[]; featured_category_ids: number[] };
  seo: { title: string; description: string };
  setup_completed: boolean;
};

export type ApiCategory = {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  image: string | null;
  sort_order: number;
  translations: Translations | null;
  children: ApiCategory[];
};

export type AttributeType = "text" | "number" | "select" | "multiselect" | "color" | "boolean";

/** A select/color choice. Plain strings are allowed; color adds a swatch. */
export type AttributeOption = string | { value: string; hex?: string };

export type ApiAttribute = {
  id: number;
  name: string;
  key: string;
  type: AttributeType;
  options: AttributeOption[];
  unit: string | null;
  filterable: boolean;
  is_variant: boolean;
  category_ids: number[];
  sort_order: number;
  /** {"ru": {"name": "Цвет", "options": {"Qara": "Чёрный"}}} */
  translations: Translations | null;
};

export type ApiVariant = {
  id: number;
  options: Record<string, string>;
  /** already resolved: the product price when the variant has none */
  price: number;
  old_price: number | null;
  /** null = not tracked */
  stock: number | null;
  sku: string | null;
  image: string | null;
};

export type ApiProduct = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  old_price: number | null;
  stock: number | null;
  sku: string | null;
  /** ready URLs (/images/<key> or as stored when absolute) */
  images: string[];
  thumbs: string[];
  category: { id: number; slug: string } | null;
  attributes: Record<string, unknown>;
  is_featured: boolean;
  created_at: string;
  translations: Translations | null;
  variants: ApiVariant[];
};

export type ApiProductList = { items: ApiProduct[]; total: number; page: number; limit: number };

export type ApiPage = {
  slug: string;
  title: string;
  content: string;
  show_in_menu: boolean;
  translations: Translations | null;
};

export type ApiFilter = {
  key: string;
  name: string;
  type: AttributeType;
  unit: string | null;
  translations: Translations | null;
  values: { value: string; hex?: string; count: number }[];
};

export type ApiFilters = { attributes: ApiFilter[]; price: { min: number; max: number } };

/** Everything the front needs on every page; injected into the HTML by the Worker. */
export type Bootstrap = {
  store: ApiStore;
  categories: ApiCategory[];
  attributes: ApiAttribute[];
  menu: { slug: string; title: string; translations: Translations | null }[];
};

/** POST /api/orders. Prices are never sent: the server reads them from D1. */
export type OrderRequest = {
  items: { product_id: number; variant_id: number | null; quantity: number }[];
  name: string;
  phone: string;
  address?: string;
  note?: string;
  lang?: Lang;
  /** honeypot: a hidden field people never fill */
  website?: string;
};

export type OrderError = "closed" | "invalid" | "phone" | "required" | "stock" | "gone" | "min" | "rate";

export type OrderResponse = {
  order_number: string;
  total: number;
  items: { product_id: number; variant_id: number | null; name: string; variant_text: string; price: number; quantity: number }[];
};
