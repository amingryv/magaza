import type { Product, Variant } from "./catalog-types";

export function minPrice(p: Product): number {
  return Math.min(...p.variants.map((v) => v.price));
}

export function totalStock(p: Product): number {
  return p.variants.reduce((s, v) => s + v.stock, 0);
}

export function hasPriceRange(p: Product): boolean {
  return new Set(p.variants.map((v) => v.price)).size > 1;
}

/** Variant matching every chosen option value, if one exists. */
export function findVariant(p: Product, chosen: Record<string, string>): Variant | undefined {
  return p.variants.find((v) => p.options.every((o) => v.values[o.id] === chosen[o.id]));
}

/** The first variant in stock (or the first at all) — the page's default pick. */
export function defaultVariant(p: Product): Variant {
  return p.variants.find((v) => v.stock > 0) ?? p.variants[0];
}

/** Is there any in-stock variant with this option value, given the other picks? */
export function valueAvailable(
  p: Product,
  chosen: Record<string, string>,
  optionId: string,
  valueId: string,
): boolean {
  const want = { ...chosen, [optionId]: valueId };
  return p.variants.some((v) => v.stock > 0 && p.options.every((o) => v.values[o.id] === want[o.id]));
}



