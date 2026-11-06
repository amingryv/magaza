import type { AttributeOption, AttributeType, Translations } from "@/shared/api-types";
import { call, shrink } from "./api";

export type { AttributeOption, AttributeType, Translations };

export type ImageRef = { key: string; url: string; thumb: string };

export type AdminCategory = {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  image: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  translations: Translations | null;
  products: number;
};

export type AdminAttribute = {
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
  translations: Translations | null;
};

export type ProductRow = {
  id: number;
  name: string;
  slug: string;
  price: number;
  old_price: number | null;
  sku: string | null;
  category_id: number | null;
  is_active: boolean;
  is_featured: boolean;
  thumb: string | null;
  variants: number;
  stock: number | null;
};

export type AdminVariant = {
  id: number | null;
  options: Record<string, string>;
  price: number | null;
  old_price: number | null;
  stock: number | null;
  sku: string | null;
  image: string | null;
};

export type AdminProduct = {
  id: number;
  category_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  old_price: number | null;
  stock: number | null;
  sku: string | null;
  images: ImageRef[];
  attributes: Record<string, unknown>;
  is_active: boolean;
  is_featured: boolean;
  translations: Translations | null;
  variants: AdminVariant[];
};

export const TYPE_NAMES: Record<AttributeType, string> = {
  text: "Mətn",
  number: "Rəqəm",
  select: "Siyahıdan seçim",
  multiselect: "Bir neçə seçim",
  color: "Rəng",
  boolean: "Bəli / Xeyr",
};

export const optValue = (o: AttributeOption) => (typeof o === "string" ? o : o.value);
export const optHex = (o: AttributeOption) => (typeof o === "string" ? undefined : o.hex);

/* ── money: qəpik ⇄ "12.50" ── */
export const toMoney = (q: number | null | undefined) => (q == null ? "" : (q / 100).toFixed(2).replace(/\.00$/, ""));
/** "" → null, "12,5" → 1250, nonsense → NaN */
export function fromMoney(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
export function fromCount(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

/** Product picture: big (≤1600px) and thumbnail (≤400px) under one uuid → products/<uuid>.webp */
export async function uploadProductImage(file: File): Promise<ImageRef> {
  const [big, small] = await Promise.all([shrink(file, 1600), shrink(file, 400, 0.8)]);
  const name = crypto.randomUUID();
  const r = await call<{ key: string; url: string }>("POST", `upload?folder=products&name=${name}`, big);
  const t = await call<{ url: string }>("POST", `upload?folder=products&name=${name}_thumb`, small);
  return { key: r.key, url: r.url, thumb: t.url };
}

export const uploadKey = (blob: Blob, folder: string) => call<{ key: string; url: string }>("POST", `upload?folder=${folder}`, blob);

/** Removes freshly uploaded pictures that were never saved (form left without saving). */
export function dropUploads(keys: string[]) {
  for (const k of keys) {
    void call("DELETE", `upload/${k}`).catch(() => {});
    if (k.endsWith(".webp")) void call("DELETE", `upload/${k.replace(/\.webp$/, "_thumb.webp")}`).catch(() => {});
  }
}

/** Categories in tree order with their depth. */
export function flatTree(cats: AdminCategory[]): (AdminCategory & { depth: number })[] {
  const ids = new Set(cats.map((c) => c.id));
  const kids = new Map<number | null, AdminCategory[]>();
  for (const c of cats) {
    const p = c.parent_id != null && ids.has(c.parent_id) ? c.parent_id : null;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p)!.push(c);
  }
  const out: (AdminCategory & { depth: number })[] = [];
  const walk = (p: number | null, depth: number) => {
    for (const c of (kids.get(p) ?? []).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)) {
      out.push({ ...c, depth });
      if (depth < 20) walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** The category and all of its ancestors (attributes limited to a parent apply below it too). */
export function chain(cats: AdminCategory[], id: number | null): number[] {
  const up = new Map(cats.map((c) => [c.id, c.parent_id]));
  const out: number[] = [];
  for (let at: number | null | undefined = id, n = 0; at != null && n < 50; at = up.get(at), n++) out.push(at);
  return out;
}

export const applies = (a: AdminAttribute, path: number[]) => !a.category_ids.length || a.category_ids.some((c) => path.includes(c));

/** Translation editing: `{ru:{name:"..."}}` getters/setters that keep other fields. */
export function trGet(t: Translations | null, lang: string, field: string): string {
  const v = (t as Record<string, Record<string, unknown>> | null)?.[lang]?.[field];
  return typeof v === "string" ? v : "";
}
export function trSet(t: Translations | null, lang: string, field: string, value: string): Translations {
  const all = { ...((t ?? {}) as Record<string, Record<string, unknown>>) };
  all[lang] = { ...(all[lang] ?? {}), [field]: value };
  return all as Translations;
}

export const LANG_NAMES: Record<string, string> = { az: "Azərbaycanca", ru: "Rusca", en: "İngiliscə" };
