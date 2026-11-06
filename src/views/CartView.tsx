"use client";

import { useSite } from "@/lib/site";
import { CartLines } from "@/components/CartDrawer";

export function CartView() {
  const { t } = useSite();
  return (
    <div className="wrap max-w-2xl pb-10 pt-6 md:pt-10">
      <h1 className="page-title">{t.cart.title}</h1>
      <div className="mt-6 [animation:rise_.6s_var(--curve)]">
        <CartLines />
      </div>
    </div>
  );
}
