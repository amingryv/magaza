"use client";

import { useState } from "react";
import type { Product } from "@/lib/catalog-types";

/* ══ One frame for every product picture ═══════════════════
   Owners will upload whatever they have: cut-outs on white, phone photos
   on a desk, wide supplier banners, or nothing at all. Every picture sits
   the same way inside a soft grey square:

   - the image keeps its own proportions and is centred at most 78% of the
     frame, so tall, wide and square pictures all read the same size;
   - `mix-blend-mode: multiply` lets white studio grounds melt into the grey,
     so cut-outs float like on a store shelf;
   - a photo with its own background gets rounded corners (the radius sits
     on the image box itself, which is the picture's real size), so it reads
     as a neat print in the frame rather than a crooked crop;
   - no picture, or a broken link: a quiet line drawing for the category and
     the brand name — never an empty box or a broken-image icon. */

export function ProductImage({
  product,
  size = "card",
  src = size === "thumb" ? (product.thumbs?.[0] ?? product.images[0]) : product.images[0],
  priority = false,
  alt = "",
}: {
  product: Pick<Product, "category" | "brand" | "images"> & { thumbs?: string[] };
  src?: string;
  priority?: boolean;
  /** "thumb" drops the brand line in small thumbnails */
  size?: "card" | "thumb" | "hero";
  alt?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const failed = !src || broken === src;

  if (failed) return <Placeholder category={product.category} brand={size === "thumb" ? "" : product.brand} label={alt} />;
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className="pic"
      data-size={size}
      onError={() => setBroken(src)}
    />
  );
}

function Placeholder({ category, brand, label }: { category: string; brand: string; label: string }) {
  return (
    <span className="pic-none" role={label ? "img" : undefined} aria-label={label || undefined}>
      <svg viewBox="0 0 48 48" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        {SHAPES[category] ?? SHAPES.default}
      </svg>
      {brand && <span className="pic-none-brand">{brand}</span>}
    </span>
  );
}

/* Minimal line drawings, one per kind of goods. Unknown categories (another
   sector's template) fall back to a parcel. Keys match category ids, plus a
   few common synonyms so a new shop works without touching this file. */
const phone = (
  <>
    <rect x="15" y="5" width="18" height="38" rx="4" />
    <path d="M21 9h6" />
  </>
);
const laptop = (
  <>
    <rect x="9" y="11" width="30" height="20" rx="2" />
    <path d="M4 37h40l-3-6H7z" />
  </>
);
const tablet = (
  <>
    <rect x="10" y="6" width="28" height="36" rx="4" />
    <path d="M22 37h4" />
  </>
);
const audio = (
  <>
    <path d="M10 28v-4a14 14 0 0 1 28 0v4" />
    <rect x="7" y="27" width="7" height="12" rx="3" />
    <rect x="34" y="27" width="7" height="12" rx="3" />
  </>
);
const watch = (
  <>
    <rect x="13" y="13" width="22" height="22" rx="6" />
    <path d="M18 13l1.5-7h9L30 13M18 35l1.5 7h9L30 35M24 19v5l3 2" />
  </>
);
const gaming = (
  <>
    <path d="M14 16h20a8 8 0 0 1 7.8 9.6l-1.5 7a4.5 4.5 0 0 1-7.7 2L29 31H19l-3.6 3.6a4.5 4.5 0 0 1-7.7-2l-1.5-7A8 8 0 0 1 14 16z" />
    <path d="M15 21v6M12 24h6M31 22.5h.01M34 25.5h.01" />
  </>
);
const accessory = (
  <>
    <path d="M24 6c-7 0-11 5-11 12v12c0 7 4 12 11 12s11-5 11-12V18c0-7-4-12-11-12z" />
    <path d="M24 6v12M13 18h22" />
  </>
);
const parcel = (
  <>
    <path d="M24 5 41 14v20L24 43 7 34V14z" />
    <path d="M7 14l17 9 17-9M24 23v20" />
  </>
);
const clothing = (
  <>
    <path d="M18 7 9 11.5l-4 9 6 3 2.5-4V41h21V19.5l2.5 4 6-3-4-9L30 7" />
    <path d="M18 7c1.2 3 3.2 4.5 6 4.5S28.8 10 30 7" />
  </>
);
const home = (
  <>
    <path d="M19 6h10M20 6c0 5-7 9-7 20 0 9 4.5 16 11 16s11-7 11-16c0-11-7-15-7-20" />
    <path d="M15 24h18" />
  </>
);
const bag = (
  <>
    <path d="M9 17h30l-2.5 25h-25z" />
    <path d="M17 21v-7a7 7 0 0 1 14 0v7" />
  </>
);
const beauty = (
  <>
    <rect x="14" y="18" width="20" height="24" rx="4" />
    <path d="M19 18v-5h10v5M22 13V7h4v6" />
  </>
);
const food = (
  <>
    <path d="M6 20h36l-4 20H10z" />
    <path d="M15 20l6-12M33 20l-6-12M17 27v6M24 27v6M31 27v6" />
  </>
);
/* Keys: category slugs, English and Azerbaijani (as the admin slugifies them). */
const SHAPES: Record<string, React.ReactNode> = {
  clothing,
  clothes: clothing,
  fashion: clothing,
  geyim: clothing,
  home,
  "home-decor": home,
  furniture: home,
  ev: home,
  "ev-ve-dekor": home,
  mebel: home,
  bags: bag,
  aksesuarlar: bag,
  cantalar: bag,
  beauty,
  cosmetics: beauty,
  kosmetika: beauty,
  food,
  grocery: food,
  qida: food,
  erzaq: food,
  electronics: phone,
  elektronika: phone,
  phones: phone,
  phone,
  smartphones: phone,
  laptops: laptop,
  laptop,
  computers: laptop,
  tablets: tablet,
  tablet,
  audio,
  headphones: audio,
  watches: watch,
  watch,
  gaming,
  games: gaming,
  consoles: gaming,
  accessories: accessory,
  default: parcel,
};
