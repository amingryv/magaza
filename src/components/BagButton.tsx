"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/lib/cart";
import { useSite } from "@/lib/site";
import { jump } from "@/lib/spring";
import { IconBag } from "./Icons";

/** The round bag. Its badge springs in, and the whole bag jumps on every add. */
export function BagButton({ variant = "orb", onOpen }: { variant?: "orb" | "tone"; onOpen?: () => void }) {
  const { t } = useSite();
  const { count, pulse, openDrawer, ready } = useCart();
  const el = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pulse) jump(el.current);
  }, [pulse]);

  const n = ready ? count : 0;
  return (
    <button
      ref={el}
      type="button"
      onClick={() => {
        onOpen?.();
        openDrawer();
      }}
      className={variant === "orb" ? "orb" : "t-orb relative"}
      aria-label={`${t.nav.cart}${n ? `, ${t.cart.items(n)}` : ""}`}
    >
      <IconBag size={22} />
      <b className="badge" data-on={n > 0 || undefined} aria-hidden>
        {n}
      </b>
    </button>
  );
}
