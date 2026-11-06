import type { LocalText } from "./i18n";

/**
 * The front's own shapes. The API (src/shared/api-types.ts) is mapped onto
 * these in src/lib/adapt.ts, so components never see database rows.
 * Ids are strings here; money is integer qəpik.
 */

/** id = slug: it is what the catalogue URL carries (?c=phones). */
export type Category = { id: string; dbId: number; name: LocalText; image?: string; parent?: string; children: Category[] };

export type OptionValue = { id: string; name: LocalText; swatch?: string };
export type ProductOption = { id: string; name: LocalText; values: OptionValue[] };

/** Stock that is not tracked counts as this many: always buyable. */
export const UNLIMITED = 9999;

/** One sellable combination of option values, with its own price and stock. */
export type Variant = {
  id: string;
  values: Record<string, string>;
  price: number;
  oldPrice?: number;
  stock: number;
  image?: string;
};

export type Spec = { name: LocalText; value: LocalText };

export type Product = {
  id: string;
  slug: string;
  /** category slug, "" when none */
  category: string;
  /** the "brand" attribute when the shop uses one, else "" */
  brand: string;
  name: LocalText;
  /** first paragraph of the description */
  summary: LocalText;
  description: LocalText;
  images: string[];
  thumbs: string[];
  options: ProductOption[];
  /** always at least one: a product without variants gets one built from its own price and stock */
  variants: Variant[];
  specs: Spec[];
  featured?: boolean;
  addedAt: string;
};
