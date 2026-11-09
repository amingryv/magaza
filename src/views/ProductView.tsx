"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useSite } from "@/lib/site";
import { tr } from "@/lib/i18n";
import { useProduct, useProducts } from "@/lib/api";
import { stillness } from "@/lib/spring";
import { ProductAbout, ProductDetail } from "@/components/ProductDetail";
import { ProductGrid } from "@/components/ProductGrid";
import type { Product } from "@/lib/catalog-types";

export function ProductView() {
  const { ready } = useSite();
  const slug = useSearchParams().get("s");
  const { product, loading, missing } = useProduct(slug);
  if (!ready || loading) return <div className="min-h-[80dvh]" aria-busy />;
  if (!product || missing) return <Missing />;
  return <ProductPage key={product.id} product={product} />;
}

function Missing() {
  const { t, href } = useSite();
  return (
    <div className="wrap grid min-h-[60dvh] place-items-center py-16 text-center">
      <div className="[animation:rise_.6s_var(--curve)]">
        <h1 className="text-3xl">{t.product.notFound}</h1>
        <p className="mt-2 text-ink-soft">{t.product.notFoundHint}</p>
        <Link href={href("/catalog/")} className="pill pill-ink mt-6">
          {t.product.backToCatalog}
        </Link>
      </div>
    </div>
  );
}

/**
 * The product on its own page (a shared link, a new tab, a crawler). The
 * colour opens as a circle from the middle and the controls rise one after
 * another — the same entrance the quick view gives them.
 */
function ProductPage({ product }: { product: Product }) {
  const { t, lang, href, store } = useSite();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const name = tr(product.name, lang);

  useEffect(() => {
    document.title = `${name} — ${store.name}`;
  }, [name, store.name]);

  // stagger the controls in with the spring curve, once
  useLayoutEffect(() => {
    if (stillness()) return;
    const els = root.current?.querySelectorAll<HTMLElement>(".ent") ?? [];
    els.forEach((el, i) => {
      el.animate(
        [
          { opacity: 0, transform: "translate3d(0,14px,0)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 620, delay: 180 + i * 62, easing: getComputedStyle(document.documentElement).getPropertyValue("--spring") || "ease-out", fill: "backwards" },
      );
    });
  }, []);

  const { items } = useProducts(product.category ? { category: product.category, inStock: true, limit: 5 } : null);
  const related = items.filter((p) => p.id !== product.id).slice(0, 4);

  return (
    <>
      <section
        ref={root}
        data-tone=""
        className="relative pb-6 pt-4 md:pb-10 md:pt-8"
      >
        <div className="wrap relative">
          <ProductDetail product={product} mode="page" onBack={() => (window.history.length > 1 ? router.back() : router.push(href("/catalog/")))} />
        </div>
      </section>

      <section className="wrap pt-6 md:pt-12">
        <ProductAbout product={product} />
      </section>

      {related.length > 0 && (
        <section className="wrap pb-20 pt-14 md:pb-10 md:pt-20" aria-labelledby="related">
          <h2 id="related" className="section-title">
            {t.product.related}
          </h2>
          <div className="mt-6">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </>
  );
}
