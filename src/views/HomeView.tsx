"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
      <Shop />
      <HowItGoes />
      <Picks />
      <Visit />
    </>
  );
}

/* ---------- hero: the shop's name, and a way in ---------- */

function Hero() {
  const { t, store, ready } = useSite();
  const search = useSearch();
  const letters = Array.from(store.name);

  return (
    <section className="wrap pb-10 pt-12 text-center md:pb-16 md:pt-24">
      {/* Until the shop's data is in, the name is plain text the Worker wrote
          into the HTML; then it is set again as letters that rise one by one. */}
      <h1 className="hero-name" aria-label={store.name} data-store={ready ? undefined : "name"} suppressHydrationWarning>
        {ready
          ? letters.map((ch, i) => (
              <span key={i} className="hero-letter" aria-hidden style={{ animationDelay: `${0.04 + i * 0.05}s` }}>
                {ch}
              </span>
            ))
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
