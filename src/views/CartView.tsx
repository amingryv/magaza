"use client";

import { useSite } from "@/lib/site";
import { useCart } from "@/lib/cart";
import { CartLines } from "@/components/CartDrawer";

export function CartView() {
  const { t } = useSite();
  const { lines, ready } = useCart();
  const count = lines.reduce((s, l) => s + l.qty, 0);
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
