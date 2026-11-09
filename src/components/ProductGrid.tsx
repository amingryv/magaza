import type { Product } from "@/lib/catalog-types";
import { ProductCard } from "./ProductCard";

/**
 * Two columns on a phone, three on a tablet, four on a desktop; every card
 * on the same line. When the list changes (a chip, a filter) the new list
 * fades up once with plain CSS. Earlier each card was a motion layout node,
 * and every re-render anywhere on the page made motion measure all of them.
 * While the first page is on its way, `skeleton` grey cards hold the place.
 */
export function ProductGrid({ products, listKey = "", skeleton = 0 }: { products: Product[]; listKey?: string; skeleton?: number }) {
  return (
    <div key={listKey} className="grid-products">
      {products.map((p, i) => (
        <div key={p.id} className="grid-item" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
          <ProductCard product={p} priority={i < 4} />
        </div>
      ))}
      {Array.from({ length: skeleton }, (_, i) => (
        <div key={`skel-${i}`} aria-hidden>
          <div className="card card-skel">
            <span className="frame" />
            <span className="card-info">
              <span className="card-dots" />
              <span className="card-eyebrow" />
              <span className="card-name" />
              <span className="card-price" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
