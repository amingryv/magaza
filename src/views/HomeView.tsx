"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useSite } from "@/lib/site";
import { tr } from "@/lib/i18n";
import { whatsappLink } from "@/lib/order";
import { useProducts } from "@/lib/api";
import { ProductGrid } from "@/components/ProductGrid";
import { useSearch } from "@/components/Search";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { IconArrow, IconClock, IconPin, IconSearch } from "@/components/Icons";

export function HomeView() {
  return (
    <>
      <Hero />
      <Banners />
      <FeaturedCategories />
      <Shop />
      <HowItGoes />
      <Picks />
      <Visit />
    </>
  );
}

/* ---------- hero: the shop's name, and a way in ---------- */

function Hero() {
  const { t, store, ready, lang } = useSite();
  // the build's <title> is generic; React puts it back on load, so set the Worker's home title again
  useEffect(() => {
    if (!ready) return;
    const tag = tr(store.tagline, lang);
    document.title = store.seoTitle || (tag ? `${store.name} — ${tag}` : store.name);
  }, [ready, store, lang]);
  const search = useSearch();

  return (
    <section className="wrap pb-10 pt-12 text-center md:pb-16 md:pt-24">
      {/* Until the shop's data is in, the name is plain text the Worker wrote
          into the HTML; then it is set again as letters that rise one by one. */}
      <h1 className="hero-name" aria-label={store.name} data-store={ready ? undefined : "name"} suppressHydrationWarning>
        {ready
          ? // words stay whole (a long name wraps between words) and keep their spaces
            store.name.split(" ").map((word, w, all) => {
              const start = all.slice(0, w).reduce((n, x) => n + Array.from(x).length + 1, 0);
              return (
                <Fragment key={w}>
                  {w > 0 && " "}
                  <span className="inline-block whitespace-nowrap" aria-hidden>
                    {Array.from(word).map((ch, i) => (
                      <span key={i} className="hero-letter" style={{ animationDelay: `${0.04 + (start + i) * 0.05}s` }}>
                        {ch}
                      </span>
                    ))}
                  </span>
                </Fragment>
              );
            })
          : store.name}
      </h1>
      <button type="button" onClick={search.open} className="hero-search" aria-haspopup="dialog">
        <IconSearch size={19} className="shrink-0" />
        <span className="truncate">{t.home.searchPh}</span>
        <kbd className="hero-search-go">{t.home.searchGo}</kbd>
      </button>
    </section>
  );
}

/* ---------- banners: the owner's pictures, a swipeable row ---------- */

function Banners() {
  const { store, lang, href } = useSite();
  if (!store.banners.length) return null;
  const one = store.banners.length === 1;
  return (
    <section aria-label="Banners" className="wrap mb-12 md:mb-16">
      <div className={`no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 md:mx-0 md:px-0 ${one ? "" : "md:grid md:grid-cols-2"}`}>
        {store.banners.map((b, i) => {
          const title = tr(b.title, lang);
          const sub = tr(b.subtitle, lang);
          const body = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image} alt={title} className="aspect-[16/9] w-full rounded-[22px] bg-tile object-cover" loading={i ? "lazy" : "eager"} />
              {(title || sub) && (
                <span className="mt-3 block px-1">
                  {title && <span className="block text-[1.05rem] font-[650] tracking-[-0.02em]">{title}</span>}
                  {sub && <span className="mt-0.5 block text-[0.9rem] text-ink-soft">{sub}</span>}
                </span>
              )}
            </>
          );
          const cls = `block shrink-0 snap-start ${one ? "w-full" : "w-[86%] md:w-auto"}`;
          if (b.link.startsWith("/")) return <Link key={i} href={href(b.link)} className={cls}>{body}</Link>;
          if (/^https?:\/\//.test(b.link)) return <a key={i} href={b.link} target="_blank" rel="noopener" className={cls}>{body}</a>;
          return <div key={i} className={cls}>{body}</div>;
        })}
      </div>
    </section>
  );
}

/* ---------- featured categories: picture tiles the owner chose ---------- */

function FeaturedCategories() {
  const { store, lang, href, categories } = useSite();
  const all = useMemo(() => {
    const out: typeof categories = [];
    const walk = (cs: typeof categories) => cs.forEach((c) => (out.push(c), walk(c.children)));
    walk(categories);
    return out;
  }, [categories]);
  const picked = store.featuredCategoryIds.map((id) => all.find((c) => c.dbId === id)).filter((c): c is (typeof all)[number] => !!c);
  if (!picked.length) return null;
  return (
    <section aria-label="Categories" className="wrap mb-12 md:mb-16">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {picked.map((c) => (
          <Link key={c.id} href={href(`/catalog/?c=${c.id}`)} className="group block">
            <span className="block aspect-[4/3] overflow-hidden rounded-[18px] bg-tile">
              {c.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
              )}
            </span>
            <span className="mt-2 block px-1 text-[0.95rem] font-[600]">{tr(c.name, lang)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ---------- the shop: chips that filter in place ---------- */

function Shop() {
  const { t, lang, categories, href, ready } = useSite();
  const [cat, setCat] = useState<string>("all");
  const query = useMemo(() => (ready ? { category: cat === "all" ? undefined : cat, sort: "new" as const, limit: 8 } : null), [cat, ready]);
  const { items, total, loading } = useProducts(query);
  const chips = [{ id: "all", name: t.catalog.all }, ...categories.map((c) => ({ id: c.id, name: tr(c.name, lang) }))];
  const to = cat === "all" ? "/catalog/" : `/catalog/?c=${cat}`;

  return (
    <section aria-labelledby="shop" className="wrap">
      <SectionHead id="shop" title={t.home.allTitle} link={total ? { to, label: t.search.all(total) } : undefined} />
      {chips.length > 2 && <Chips chips={chips} value={cat} onChange={setCat} id="home" />}
      <div className="mt-6">
        <ProductGrid products={items} listKey={cat} skeleton={loading || !ready ? 4 : 0} />
      </div>
      {total > 8 && (
        <div className="mt-8 text-center">
          <Link href={href(to)} className="pill pill-line">
            {t.search.all(total)}
            <IconArrow size={17} />
          </Link>
        </div>
      )}
    </section>
  );
}

function SectionHead({ id, title, link }: { id: string; title: string; link?: { to: string; label: string } }) {
  const { href } = useSite();
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 id={id} className="section-title">
        {title}
      </h2>
      {link && (
        <Link href={href(link.to)} className="link-draw mb-1 shrink-0 text-[0.88rem] font-medium text-ink-soft hover:text-ink">
          {link.label}
        </Link>
      )}
    </div>
  );
}

export function Chips({ chips, value, onChange, id }: { chips: { id: string; name: string }[]; value: string; onChange: (id: string) => void; id: string }) {
  return (
    <div className="no-scrollbar -mx-5 mt-4 flex gap-1.5 overflow-x-auto px-5 py-0.5 md:mx-0 md:flex-wrap md:px-0" role="group">
      {chips.map((c) => {
        const on = c.id === value;
        return (
          <button key={c.id} type="button" className="chip shrink-0" aria-pressed={on} onClick={() => onChange(c.id)}>
            {on && <motion.span layoutId={`chip-${id}`} className="chip-fill" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- how the order travels: three steps on one line ---------- */

function HowItGoes() {
  const { t } = useSite();
  return (
    <section aria-labelledby="how" className="wrap mt-16 md:mt-24">
      <div className="how">
        <h2 id="how" className="how-title">
          {t.home.howKicker}
        </h2>
        <ol className="how-steps">
          {t.home.howSteps.map((s, i) => (
            <li key={s}>
              <span className="how-n num">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- the week's picks: four cards, the same grid ---------- */

function Picks() {
  const { t, ready } = useSite();
  // featured first (the "popular" order), only what can be bought now
  const { items: products } = useProducts(ready ? { inStock: true, limit: 4 } : null);
  if (!products.length) return null;
  return (
    <section aria-labelledby="picks" className="wrap mt-16 md:mt-24">
      <SectionHead id="picks" title={t.home.gamingKicker} link={{ to: "/catalog/", label: t.home.browse }} />
      <div className="mt-6">
        <ProductGrid products={products} />
      </div>
    </section>
  );
}

/* ---------- visit: one quiet row ---------- */

function Visit() {
  const { t, store, lang } = useSite();
  const address = tr(store.address, lang);
  const hours = tr(store.hours, lang);
  if (!address && !hours && !store.phoneDisplay && !store.whatsapp) return null;
  return (
    <section aria-labelledby="visit" className="wrap mt-16 md:mt-24">
      <div className="visit">
        <div className="min-w-0">
          <h2 id="visit" className="text-[1.25rem] font-[650] tracking-[-0.03em] md:text-[1.5rem]">
            {address || store.name}
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.9rem] text-ink-soft">
            {hours && (
              <span className="inline-flex items-center gap-1.5">
                <IconClock size={16} />
                {hours}
              </span>
            )}
            {store.phoneDisplay && (
              <span className="num inline-flex items-center gap-1.5">
                <IconPin size={16} />
                {store.phoneDisplay}
              </span>
            )}
          </div>
        </div>
        {store.whatsapp && (
          <a href={whatsappLink("", store.whatsapp)} target="_blank" rel="noopener" className="pill pill-wa shrink-0">
            <WhatsAppIcon size={18} />
            {t.home.writeUs}
          </a>
        )}
      </div>
    </section>
  );
}
