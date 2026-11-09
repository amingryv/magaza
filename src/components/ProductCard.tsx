"use client";

import { useRef } from "react";
import type { Product } from "@/lib/catalog-types";
import { defaultVariant, hasPriceRange, minPrice, totalStock } from "@/lib/catalog";
import { tr } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { useSite } from "@/lib/site";
import { useFavorites } from "@/lib/favorites";
import { jump } from "@/lib/spring";
import { useQuickView } from "./QuickView";
import { IconHeart } from "./Icons";
import { ProductImage } from "./ProductImage";

export function productHref(href: (p: string) => string, p: Product) {
  return href(`/p/?s=${p.slug}`);
}

/** Added within the last two weeks counts as new. */
function isNew(p: Product) {
  return Date.now() - Date.parse(p.addedAt) <= 14 * 864e5;
}

/**
 * A product card: the picture in its grey frame on top, colour dots (an
 * empty line when there are none), then one small line
 * (a sale, "new", or the brand), the name on one line and the price.
 * Every line has a fixed height, so the cards in a row always line up,
 * whatever the picture or the name. Tapping does not navigate: the picture,
 * name and price fly into the quick view. A real link stays underneath for
 * new tabs and crawlers.
 */
export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { lang, t, href, findCategory } = useSite();
  const { open } = useQuickView();
  const fav = useFavorites();
  const photo = useRef<HTMLSpanElement>(null);
  const name = useRef<HTMLSpanElement>(null);
  const price = useRef<HTMLElement>(null);
  const heart = useRef<HTMLButtonElement>(null);
  const v = defaultVariant(product);
  const stock = totalStock(product);
  const label = tr(product.name, lang);
  const saved = fav.has(product.id);
  // colour dots under the picture, when the product comes in colours
  const colours = product.options.find((o) => o.values.length > 1 && o.values.every((x) => x.swatch))?.values ?? [];

  const sale = v.oldPrice && v.oldPrice > v.price ? Math.round((1 - v.price / v.oldPrice) * 100) : 0;
  const eyebrow =
    stock <= 0
      ? { text: t.product.outOfStock, hot: false }
      : sale
        ? { text: t.product.sale(sale), hot: true }
        : isNew(product)
          ? { text: t.product.isNew, hot: true }
          : { text: product.brand || tr(findCategory(product.category)?.name, lang), hot: false };

  return (
    <article className="card" data-out={stock <= 0 || undefined}>
      <a
        href={productHref(href, product)}
        className="card-open"
        aria-label={`${label}, ${formatPrice(minPrice(product))}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab: let the link work
          e.preventDefault();
          if (photo.current && name.current && price.current) open(product, { photo: photo.current, name: name.current, price: price.current });
        }}
      >
        <span ref={photo} className="frame">
          <ProductImage product={product} priority={priority} />
        </span>
        <span className="card-info">
          <span className="card-dots" aria-hidden>
            {colours.slice(0, 5).map((c) => (
              <i key={c.id} style={{ "--c": c.swatch } as React.CSSProperties} />
            ))}
            {colours.length > 5 && <em>+{colours.length - 5}</em>}
          </span>
          <span className="card-eyebrow" data-tone={eyebrow.hot ? "hot" : undefined}>
            {eyebrow.text}
          </span>
          <span className="card-name">
            <span ref={name}>{label}</span>
          </span>
          <span className="card-price">
            {hasPriceRange(product) && <span className="card-from">{t.product.from}</span>}
            <b ref={price}>{formatPrice(minPrice(product))}</b>
            {sale > 0 && !hasPriceRange(product) && <s>{formatPrice(v.oldPrice!)}</s>}
          </span>
        </span>
      </a>
      <button
        ref={heart}
        type="button"
        className="heart"
        aria-pressed={saved}
        aria-label={`${saved ? t.fav.remove : t.fav.save}: ${label}`}
        onClick={() => {
          fav.toggle(product.id);
          jump(heart.current?.querySelector("svg"), 1.3);
        }}
      >
        <IconHeart size={18} />
      </button>
    </article>
  );
}
