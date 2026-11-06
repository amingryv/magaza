"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSite } from "@/lib/site";
import { useFavorites } from "@/lib/favorites";
import { useHydrated } from "@/lib/local";
import { useProductsById } from "@/lib/api";
import { ProductGrid } from "@/components/ProductGrid";
import { IconHeart } from "@/components/Icons";

export function FavoritesView() {
  const { t, href, store } = useSite();
  const fav = useFavorites();
  const hydrated = useHydrated();
  const { map, loading } = useProductsById(hydrated ? fav.ids : []);
  const list = fav.ids.map((id) => map.get(id)).filter((p) => !!p);

  useEffect(() => {
    document.title = `${t.fav.title} — ${store.name}`;
  }, [t.fav.title, store.name]);

  return (
    <div className="wrap pb-10 pt-6 md:pt-12">
      
      <h1 className="page-title">{t.fav.title}</h1>
      <div className="mt-8">
        {!hydrated || loading ? (
          <ProductGrid products={[]} skeleton={Math.min(4, Math.max(1, fav.ids.length))} />
        ) : list.length === 0 ? (
          <div className="grid place-items-center rounded-[24px] bg-paper-2 px-6 py-16 text-center [animation:rise_.5s_var(--curve)]">
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-paper text-ink [animation:pop_.7s_.1s_var(--spring)_both]">
                <IconHeart size={28} />
              </span>
              <p className="mt-5 text-lg font-semibold tracking-[-0.02em]">{t.fav.empty}</p>
              <p className="mt-1 text-ink-soft">{t.fav.emptyHint}</p>
              <Link href={href("/catalog/")} className="pill pill-ink mt-6">
                {t.nav.catalog}
              </Link>
            </div>
          </div>
        ) : (
          <ProductGrid products={list} />
        )}
      </div>
    </div>
  );
}
