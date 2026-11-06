"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useSite } from "@/lib/site";
import { useCart } from "@/lib/cart";
import { jump } from "@/lib/spring";
import { useQuickView } from "./QuickView";
import { IconBag, IconGrid, IconHeart, IconHome, IconSearch } from "./Icons";
import { useSearch } from "./Search";

/**
 * The phone's frosted glass bar. It stays on top of everything — the product
 * detail included — and the dot under the current place slides between tabs.
 * Any tab first closes an open detail, so the bar always takes you somewhere.
 */
export function MobileBar() {
  const { t, href } = useSite();
  const { count, openDrawer, ready, pulse } = useCart();
  const quick = useQuickView();
  const path = usePathname();
  const bag = useRef<HTMLSpanElement>(null);
  const search = useSearch();

  useEffect(() => {
    if (pulse) jump(bag.current, 1.25);
  }, [pulse]);

  const home = path === href("/") || path === href("/").replace(/\/$/, "");
  const tabs = [
    { key: "home", to: "/", label: t.nav.home, icon: <IconHome size={23} />, on: home },
    { key: "catalog", to: "/catalog/", label: t.nav.catalog, icon: <IconGrid size={23} />, on: path.includes("/catalog") },
    { key: "fav", to: "/favorites/", label: t.nav.favorites, icon: <IconHeart size={23} />, on: path.includes("/favorites") },
  ];
  const n = ready ? count : 0;

  return (
    <nav aria-label={t.nav.menu} className="tabs md:hidden">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={href(tab.to)}
          className="tab"
          aria-current={tab.on ? "page" : undefined}
          aria-label={tab.label}
          onClick={() => quick.dismiss()}
        >
          {tab.icon}
          {tab.on && <motion.i layoutId="tab-dot" className="tab-dot" transition={{ type: "spring", stiffness: 520, damping: 34 }} />}
        </Link>
      ))}
      <button
        type="button"
        className="tab"
        aria-label={t.nav.search}
        aria-haspopup="dialog"
        onClick={() => {
          quick.dismiss();
          search.open();
        }}
      >
        <IconSearch size={23} />
      </button>
      <button
        type="button"
        onClick={() => {
          quick.dismiss();
          openDrawer();
        }}
        className="tab"
        aria-label={`${t.nav.cart}${n ? `, ${t.cart.items(n)}` : ""}`}
      >
        <span ref={bag} className="relative">
          <IconBag size={23} />
          <b className="badge !-right-2.5 !-top-2" data-on={n > 0 || undefined} aria-hidden>
            {n}
          </b>
        </span>
      </button>
    </nav>
  );
}
