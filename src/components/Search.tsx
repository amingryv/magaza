"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSite } from "@/lib/site";
import { tr } from "@/lib/i18n";
import { minPrice } from "@/lib/catalog";
import { useProducts } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { lockScroll } from "@/lib/scroll-lock";
import type { Product } from "@/lib/catalog-types";
import { useQuickView } from "./QuickView";
import { ProductImage } from "./ProductImage";
import { IconArrow, IconClose, IconSearch } from "./Icons";

/* ══ Search: a card of its own ════════════════════════════
   The magnifier (header, phone tab bar, hero) opens one white card with
   the field inside. Results appear while typing: one small request to the
   shop's API a moment after the last key, so 5 or 5000 products cost the same. Arrow keys move through
   the results, Enter opens one, Esc / the cross / a tap outside / the
   phone's back button close it. */

type Ctx = { open: () => void };
const SearchCtx = createContext<Ctx>({ open: () => {} });
export const useSearch = () => useContext(SearchCtx);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  const value = useMemo(() => ({ open: () => setOn(true) }), []);
  return (
    <SearchCtx.Provider value={value}>
      {children}
      <AnimatePresence>{on && <SearchCard onClose={() => setOn(false)} />}</AnimatePresence>
    </SearchCtx.Provider>
  );
}

function SearchCard({ onClose }: { onClose: () => void }) {
  const { t, lang, categories, findCategory, href } = useSite();
  const router = useRouter();
  const quick = useQuickView();
  const field = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const closing = useRef(false);
  const after = useRef<null | (() => void)>(null);

  const catName = (id: string) => tr(findCategory(id)?.name, lang);
  // ask the API a moment after the last key, not on every key
  const [query, setQuery] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(value.trim()), 220);
    return () => window.clearTimeout(id);
  }, [value]);
  const found = useProducts(query ? { q: query, limit: 6 } : null);
  const popular = useProducts({ inStock: true, limit: 4 }).items;
  const typed = value.trim().length > 0;
  const settled = typed && query === value.trim() && !found.loading;
  const hits = typed ? found.items : [];
  const shown = typed ? hits : popular;
  const at = Math.min(active, Math.max(0, shown.length - 1));

  // its own history entry, so the phone's back button closes it
  useEffect(() => {
    const unlock = lockScroll();
    try {
      window.history.pushState({ ...(window.history.state ?? {}), search: 1 }, "");
    } catch {}
    const onPop = (e: PopStateEvent) => {
      e.stopImmediatePropagation(); // ours: the Next.js router must not react
      closing.current = true;
      onClose();
      const then = after.current;
      after.current = null;
      then?.();
    };
    window.addEventListener("popstate", onPop, true);
    const id = requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("popstate", onPop, true);
      unlock();
    };
  }, [onClose]);

  /** close; drop our history entry unless the back button already did */
  const close = (then?: () => void) => {
    if (closing.current) return;
    if (window.history.state?.search) {
      after.current = then ?? null;
      window.history.back(); // onPop finishes the job
    } else {
      closing.current = true;
      onClose();
      then?.();
    }
  };

  const pick = (p: Product) => close(() => quick.open(p));
  const all = () => {
    const q = value.trim();
    close(() => router.push(href(`/catalog/${q ? `?q=${encodeURIComponent(q)}` : ""}`)));
  };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={t.nav.search}>
      <motion.button
        type="button"
        aria-label={t.nav.close}
        tabIndex={-1}
        className="search-scrim"
        onClick={() => close()}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="search-card"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.14 } }}
        transition={{ type: "spring", stiffness: 520, damping: 40 }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
      >
        <form
          role="search"
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            if (shown[at] && typed) pick(shown[at]);
            else all();
          }}
        >
          <IconSearch size={21} className="shrink-0 text-ink-soft" />
          <input
            ref={field}
            type="search"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const n = shown.length;
                if (n) setActive((at + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
              }
            }}
            placeholder={t.search.placeholder}
            aria-label={t.search.placeholder}
            aria-controls={listId}
            aria-activedescendant={shown[at] ? `${listId}-${shown[at].id}` : undefined}
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            className="search-field"
          />
          {value && (
            <button type="button" className="search-clear" aria-label={t.catalog.reset} onClick={() => (setValue(""), field.current?.focus())}>
              <IconClose size={14} />
            </button>
          )}
          <button type="button" className="search-x" onClick={() => close()} aria-label={t.nav.close}>
            {t.nav.close}
          </button>
        </form>

        <div className="search-body">
          {!typed && (
            <div className="px-2 pb-1 pt-1">
              <p className="search-label">{t.search.categories}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <Link key={c.id} href={href(`/catalog/?c=${c.id}`)} onClick={(e) => (e.preventDefault(), close(() => router.push(href(`/catalog/?c=${c.id}`))))} className="chip chip-sm">
                    {tr(c.name, lang)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {settled && hits.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <p className="font-semibold">{t.search.none}</p>
              <p className="mt-1 text-[0.88rem] text-ink-soft">{t.search.hint}</p>
            </div>
          ) : (
            <>
              <p className="search-label px-2 pt-4">{typed ? (settled ? t.catalog.results(found.total) : " ") : t.search.popular}</p>
              <ul id={listId} role="listbox" className="mt-1.5 grid gap-0.5">
                {shown.map((p, i) => (
                  <li key={p.id} id={`${listId}-${p.id}`} role="option" aria-selected={i === at}>
                    <button type="button" className="search-hit" data-on={i === at || undefined} onMouseMove={() => setActive(i)} onClick={() => pick(p)}>
                      <span className="frame frame-thumb">
                        <ProductImage product={p} size="thumb" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold tracking-[-0.015em]">{tr(p.name, lang)}</span>
                        <span className="block truncate text-[0.8rem] text-ink-soft">
                          {[p.brand, catName(p.category)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="num shrink-0 text-[0.9rem] font-semibold">{formatPrice(minPrice(p))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {typed && hits.length > 0 && (
          <button type="button" onClick={all} className="search-all">
            {t.search.all(found.total)}
            <IconArrow size={17} />
          </button>
        )}
      </motion.div>
    </div>
  );
}
