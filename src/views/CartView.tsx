"use client";

import { useSite } from "@/lib/site";
import { useCart } from "@/lib/cart";
import { useProductsById } from "@/lib/api";
import { resolveLines } from "@/lib/order";
import { CartLines } from "@/components/CartDrawer";

export function CartView() {
  const { t, lang } = useSite();
  const { lines, ready } = useCart();
  // Count only lines that still resolve to a product, so the title agrees with the summary.
  const { map, loading } = useProductsById(lines.map((l) => l.productId));
  const count = loading ? 0 : resolveLines(lines, map, lang).reduce((s, l) => s + l.qty, 0);
  return (
    <div className="wrap pb-14 pt-6 md:pt-12">
      <div className="flex items-baseline justify-between gap-4 border-b border-ink-line pb-5 md:pb-7">
        <h1 className="page-title">{t.cart.title}</h1>
        {ready && count > 0 && <span className="num text-ink-soft md:text-lg">{t.cart.items(count)}</span>}
      </div>
      <div className="mt-2 [animation:rise_.6s_var(--curve)] md:mt-4">
        <CartLines />
      </div>
    </div>
  );
}
