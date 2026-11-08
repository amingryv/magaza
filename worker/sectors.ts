/**
 * Starter attributes the setup wizard offers per sector. They are ordinary
 * rows afterwards: the owner can rename or delete any of them.
 */
type Tr = { ru: string; en: string };
type Preset = {
  key: string;
  name: string;
  tr: Tr;
  type: "text" | "number" | "select" | "multiselect" | "color" | "boolean";
  options?: (string | { value: string; hex: string })[];
  unit?: string;
  filterable?: boolean;
  variant?: boolean;
};

const brand: Preset = { key: "brand", name: "Brend", tr: { ru: "Бренд", en: "Brand" }, type: "select", options: [], filterable: true };
const color: Preset = {
  key: "color",
  name: "Rəng",
  tr: { ru: "Цвет", en: "Colour" },
  type: "color",
  options: [
    { value: "Qara", hex: "#111111" },
    { value: "Ağ", hex: "#ffffff" },
    { value: "Boz", hex: "#9a9a9a" },
    { value: "Qırmızı", hex: "#c62828" },
    { value: "Göy", hex: "#1e4fd8" },
    { value: "Yaşıl", hex: "#2e7d32" },
  ],
  filterable: true,
  variant: true,
};

export const SECTORS: Record<string, Preset[]> = {
  clothing: [
    { key: "size", name: "Ölçü", tr: { ru: "Размер", en: "Size" }, type: "select", options: ["XS", "S", "M", "L", "XL", "XXL"], filterable: true, variant: true },
    color,
    { key: "material", name: "Material", tr: { ru: "Материал", en: "Material" }, type: "text", filterable: true },
    brand,
  ],
  furniture: [
    { key: "material", name: "Material", tr: { ru: "Материал", en: "Material" }, type: "select", options: ["Taxta", "MDF", "Metal", "Parça", "Dəri"], filterable: true },
    { ...color, variant: false },
    { key: "width", name: "En", tr: { ru: "Ширина", en: "Width" }, type: "number", unit: "sm" },
    { key: "height", name: "Hündürlük", tr: { ru: "Высота", en: "Height" }, type: "number", unit: "sm" },
    { key: "depth", name: "Dərinlik", tr: { ru: "Глубина", en: "Depth" }, type: "number", unit: "sm" },
  ],
  cosmetics: [
    brand,
    { key: "volume", name: "Həcm", tr: { ru: "Объём", en: "Volume" }, type: "select", options: ["30", "50", "100", "200"], unit: "ml", filterable: true, variant: true },
    { key: "skin_type", name: "Dəri tipi", tr: { ru: "Тип кожи", en: "Skin type" }, type: "multiselect", options: ["Normal", "Quru", "Yağlı", "Həssas"], filterable: true },
  ],
  electronics: [
    brand,
    { key: "memory", name: "Yaddaş", tr: { ru: "Память", en: "Storage" }, type: "select", options: ["64 GB", "128 GB", "256 GB", "512 GB"], filterable: true, variant: true },
    color,
    { key: "warranty", name: "Zəmanət", tr: { ru: "Гарантия", en: "Warranty" }, type: "text" },
  ],
  food: [
    { key: "weight", name: "Çəki", tr: { ru: "Вес", en: "Weight" }, type: "select", options: ["250", "500", "1000"], unit: "q", filterable: true, variant: true },
    { key: "origin", name: "İstehsal ölkəsi", tr: { ru: "Страна производства", en: "Country of origin" }, type: "text", filterable: true },
    brand,
  ],
  other: [],
};

/** INSERT statements for a sector; existing keys are left alone. */
export function sectorStatements(env: Env, sector: string): D1PreparedStatement[] {
  return (SECTORS[sector] ?? []).map((a, i) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO attributes (name, key, type, options, unit, filterable, is_variant, category_ids, sort_order, translations)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?8, ?9
       WHERE NOT EXISTS (SELECT 1 FROM attributes WHERE lower(name) = lower(?1))`, // a same-named one (e.g. from a template or earlier sector) is kept as it is
    ).bind(
      a.name,
      a.key,
      a.type,
      a.options ? JSON.stringify(a.options) : null,
      a.unit ?? null,
      a.filterable ? 1 : 0,
      a.variant ? 1 : 0,
      i,
      JSON.stringify({ ru: { name: a.tr.ru }, en: { name: a.tr.en } }),
    ),
  );
}
