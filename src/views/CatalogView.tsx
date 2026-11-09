"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { useSite } from "@/lib/site";
import { tr, type Lang } from "@/lib/i18n";
import { useFilters, useProducts, type ProductQuery } from "@/lib/api";
import { useMedia } from "@/lib/local";
import { formatPrice } from "@/lib/format";
import { lockScroll } from "@/lib/scroll-lock";
import { ProductGrid } from "@/components/ProductGrid";
import { Chips } from "@/views/HomeView";
import { IconClose, IconFilter } from "@/components/Icons";
import type { ApiFilter } from "@/shared/api-types";

type Sort = "popular" | "cheap" | "expensive" | "new";
const SORT_API: Record<Sort, ProductQuery["sort"]> = { popular: "popular", cheap: "price_asc", expensive: "price_desc", new: "new" };
const PAGE = 24;

/** ?f=brand:Apple&f=color:Qara → { brand: ["Apple"], color: ["Qara"] } */
function readAttrs(all: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const f of all) {
    const i = f.indexOf(":");
    if (i < 1) continue;
    (out[f.slice(0, i)] ??= []).push(f.slice(i + 1));
  }
  return out;
}

/** An attribute's name or one of its values in the visitor's language. */
function filterText(f: ApiFilter, lang: Lang, main: Lang, value?: string): string {
  if (value === undefined) return lang === main ? f.name : ((f.translations?.[lang]?.name as string) ?? f.name);
  if (f.type === "boolean") return value;
  if (lang === main) return value;
  return (f.translations?.[lang]?.options as Record<string, string> | undefined)?.[value] ?? value;
}

export function CatalogView() {
  const { t, lang, categories, findCategory, href, store, ready } = useSite();
  const params = useSearchParams();
  const router = useRouter();
  const desk = useMedia("(min-width: 1024px)");
  const [sheetWanted, setSheet] = useState(false);
  const sheet = sheetWanted && !desk;

  const c = params.get("c") ?? "all";
  const q = params.get("q") ?? "";
  const sort = (params.get("sort") as Sort) || "popular";
  const fs = useMemo(() => params.getAll("f"), [params]);
  const attrs = useMemo(() => readAttrs(fs), [fs]);
  const stockOnly = params.get("stock") === "1";
  const min = Number(params.get("min") || 0);
  const max = Number(params.get("max") || 0);

  const set = (patch: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      next.delete(k);
      if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
      else if (v) next.set(k, v);
    }
    const s = next.toString();
    router.replace(href(`/catalog/${s ? `?${s}` : ""}`), { scroll: false });
  };

  const category = c === "all" ? undefined : findCategory(c);
  const query = useMemo<ProductQuery | null>(
    () =>
      ready
        ? {
            category: category?.id,
            q,
            attrs,
            inStock: stockOnly,
            minPrice: min ? min * 100 : undefined,
            maxPrice: max ? max * 100 : undefined,
            sort: SORT_API[sort] ?? "popular",
            limit: PAGE,
          }
        : null,
    [ready, category?.id, q, attrs, stockOnly, min, max, sort],
  );

  // "show more" pages, reset whenever the query itself changes
  const queryKey = params.toString();
  const [more, setMore] = useState({ key: "", pages: 1 });
  const pages = more.key === queryKey ? more.pages : 1;
  const { items, total, loading } = useProducts(query, pages);
  const filters = useFilters(ready ? (category?.id ?? null) : null);

  const activeFilters = fs.length + (stockOnly ? 1 : 0) + (min ? 1 : 0) + (max ? 1 : 0);
  const title = category ? tr(category.name, lang) : q ? `“${q}”` : t.catalog.title;

  useEffect(() => {
    if (ready) document.title = `${title} — ${store.name}`;
  }, [title, store.name, ready]);

  // top level, then the chosen branch's own children
  const top = category?.parent ? findCategory(category.parent) : category;
  const chips = [{ id: "all", name: t.catalog.all }, ...categories.map((x) => ({ id: x.id, name: tr(x.name, lang) }))];
  const subChips = top?.children.length ? [{ id: top.id, name: t.catalog.all }, ...top.children.map((x) => ({ id: x.id, name: tr(x.name, lang) }))] : null;
  const pickCategory = (id: string) => set({ c: id === "all" ? null : id, f: null });

  const firstLoad = !ready || (loading && items.length === 0);

  return (
    <div className="wrap pb-10 pt-6 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="page-title">{title}</h1>
        <p className="num pb-1.5 text-[0.88rem] font-medium text-ink-soft" aria-live="polite">
          {firstLoad ? " " : t.catalog.results(total)}
        </p>
      </div>

      {chips.length > 2 && <Chips chips={chips} value={top?.id ?? "all"} onChange={pickCategory} id="catalog" />}
      {subChips && <Chips chips={subChips} value={c} onChange={pickCategory} id="catalog-sub" />}

      <div className={`mt-6 ${desk ? "catalog-split" : ""}`}>
        {/* desktop: the filters stay on the left; phones and tablets open them as a sheet */}
        {desk && (
          <aside className="catalog-side" aria-label={t.catalog.filters}>
            <h2 className="mb-4 text-[1.05rem] font-semibold tracking-[-0.02em]">{t.catalog.filters}</h2>
            <Filters key={`${min}-${max}`} filters={filters?.attributes ?? []} chosen={attrs} stockOnly={stockOnly} min={min} max={max} onChange={set} />
          </aside>
        )}

        <div className="min-w-0">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setSheet(true)} className="chip lg:hidden">
          <IconFilter />
          {t.catalog.filters}
          {activeFilters > 0 && <span className="num grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[0.7rem] font-bold text-paper">{activeFilters}</span>}
        </button>
        <label className="relative ml-auto">
          <span className="sr-only">{t.catalog.sort}</span>
          <select
            value={sort}
            onChange={(e) => set({ sort: e.target.value === "popular" ? null : e.target.value })}
            className="chip appearance-none !pr-9 !text-ink outline-none"
          >
            <option value="popular">{t.catalog.sortPopular}</option>
            <option value="cheap">{t.catalog.sortCheap}</option>
            <option value="expensive">{t.catalog.sortExpensive}</option>
            <option value="new">{t.catalog.sortNew}</option>
          </select>
          <svg viewBox="0 0 24 24" width="16" height="16" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </label>
      </div>

      <ActiveFilters filters={filters?.attributes ?? []} chosen={attrs} q={q} stockOnly={stockOnly} min={min} max={max} onChange={set} />

      <div className="mt-6">
        {!firstLoad && items.length === 0 ? (
          <div className="grid place-items-center rounded-[24px] bg-paper-2 px-6 py-16 text-center [animation:rise_.5s_var(--curve)]">
            <div>
              <p className="text-lg font-semibold tracking-[-0.02em]">{t.catalog.empty}</p>
              <p className="mt-1 text-ink-soft">{t.catalog.emptyHint}</p>
              <button type="button" onClick={() => router.replace(href("/catalog/"))} className="pill pill-ink mt-6">
                {t.catalog.reset}
              </button>
            </div>
          </div>
        ) : (
          <ProductGrid products={items} listKey={queryKey} skeleton={firstLoad ? 8 : 0} />
        )}
      </div>

      {items.length > 0 && items.length < total && (
        <div className="mt-10 text-center">
          <button type="button" className="pill pill-line" disabled={loading} onClick={() => setMore({ key: queryKey, pages: pages + 1 })}>
            {t.catalog.more(total - items.length)}
          </button>
        </div>
      )}
        </div>
      </div>

      <FilterSheet
        open={sheet}
        onClose={() => setSheet(false)}
        count={total}
        filters={filters?.attributes ?? []}
        chosen={attrs}
        stockOnly={stockOnly}
        min={min}
        max={max}
        onChange={set}
      />
    </div>
  );
}

type FilterProps = {
  filters: ApiFilter[];
  chosen: Record<string, string[]>;
  stockOnly: boolean;
  min: number;
  max: number;
  onChange: (p: Record<string, string | string[] | null>) => void;
};

/** What narrows the list right now, each removable with one tap. */
function ActiveFilters({ filters, chosen, q, stockOnly, min, max, onChange }: FilterProps & { q: string }) {
  const { t, lang, ctx } = useSite();
  const pills: { id: string; label: string; hex?: string; drop: Record<string, string | string[] | null> }[] = [];
  if (q) pills.push({ id: "q", label: `“${q}”`, drop: { q: null } });
  for (const [key, values] of Object.entries(chosen)) {
    const f = filters.find((x) => x.key === key);
    for (const v of values) {
      const rest = Object.entries({ ...chosen, [key]: values.filter((x) => x !== v) }).flatMap(([k, vs]) => vs.map((x) => `${k}:${x}`));
      pills.push({
        id: `${key}:${v}`,
        label: !f ? v : f.type === "boolean" ? `${filterText(f, lang, ctx.main)}: ${v === "1" ? t.product.yes : t.product.no}` : `${filterText(f, lang, ctx.main, v)}${f.unit ? ` ${f.unit}` : ""}`,
        hex: f?.values.find((x) => x.value === v)?.hex ?? undefined,
        drop: { f: rest },
      });
    }
  }
  if (min || max) pills.push({ id: "price", label: `${formatPrice(min * 100)} – ${max ? formatPrice(max * 100) : "…"}`, drop: { min: null, max: null } });
  if (stockOnly) pills.push({ id: "stock", label: t.catalog.inStockOnly, drop: { stock: null } });
  if (!pills.length) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      {pills.map((p) => (
        <button key={p.id} type="button" className="chip chip-sm chip-on" onClick={() => onChange(p.drop)} aria-label={`${p.label} — ${t.cart.remove}`}>
          {p.hex && <span className="size-3 rounded-full outline outline-1 -outline-offset-1 outline-[rgb(255_255_255/0.45)]" style={{ background: p.hex }} aria-hidden />}
          <span className="num">{p.label}</span>
          <IconClose size={13} />
        </button>
      ))}
      {pills.length > 1 && (
        <button type="button" className="link-draw ml-2 text-[0.84rem] font-semibold" onClick={() => onChange({ q: null, f: null, stock: null, min: null, max: null })}>
          {t.catalog.reset}
        </button>
      )}
    </div>
  );
}

function FilterSheet({ open, onClose, count, ...f }: FilterProps & { open: boolean; onClose: () => void; count: number }) {
  const { t } = useSite();
  const wide = useMedia("(min-width: 768px)");
  const drag = useDragControls();
  const hidden = wide ? { x: "105%" } : { y: "100%" };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const unlock = lockScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={t.catalog.filters}>
          <motion.button type="button" aria-label={t.nav.close} onClick={onClose} className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            className="sheet"
            initial={hidden}
            animate={{ x: 0, y: 0 }}
            exit={hidden}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            drag={wide ? false : "y"}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            onDragEnd={(_: unknown, info: PanInfo) => (info.offset.y > 110 || info.velocity.y > 600) && onClose()}
          >
            <div className="sheet-grip" onPointerDown={(e) => drag.start(e)} aria-hidden />
            <div className="flex items-center justify-between px-5 pb-2 md:pt-5">
              <h2 className="text-[1.6rem]">{t.catalog.filters}</h2>
              <button type="button" onClick={onClose} className="orb !size-10" aria-label={t.nav.close}>
                <IconClose size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              <Filters key={`${f.min}-${f.max}`} {...f} />
            </div>
            <div className="border-t border-ink-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <button type="button" onClick={onClose} className="pill pill-ink w-full">
                {t.catalog.apply} · {t.catalog.results(count)}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Filters({ filters, chosen, stockOnly, min, max, onChange }: FilterProps) {
  const { t, lang, ctx } = useSite();
  const [lo, setLo] = useState(min ? String(min) : "");
  const [hi, setHi] = useState(max ? String(max) : ""); // remounted (keyed) when the URL range changes
  const encode = (c: Record<string, string[]>) => Object.entries(c).flatMap(([k, vs]) => vs.map((v) => `${k}:${v}`));
  const toggle = (key: string, value: string) => {
    const now = chosen[key] ?? [];
    onChange({ f: encode({ ...chosen, [key]: now.includes(value) ? now.filter((x) => x !== value) : [...now, value] }) });
  };
  const commitPrice = () => onChange({ min: lo.replace(/\D/g, "") || null, max: hi.replace(/\D/g, "") || null });
  const label = (f: ApiFilter, v: string) =>
    f.type === "boolean" ? (v === "1" ? t.product.yes : t.product.no) : `${filterText(f, lang, ctx.main, v)}${f.unit ? ` ${f.unit}` : ""}`;

  return (
    <div className="grid gap-7 pt-2">
      {filters.map((f) => (
        <fieldset key={f.key}>
          <legend className="mb-3 text-[0.85rem] font-semibold">{filterText(f, lang, ctx.main)}</legend>
          <div className="flex flex-wrap gap-2">
            {f.values.map(({ value, hex }) => {
              const on = (chosen[f.key] ?? []).includes(value);
              const id = `${f.key}-${value}`;
              return (
                <button key={id} type="button" className="chip" aria-pressed={on} onClick={() => toggle(f.key, value)}>
                  {on && <motion.span layoutId={`f-${id}`} className="chip-fill" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />}
                  {hex && <span className="relative size-3.5 rounded-full outline outline-1 -outline-offset-1 outline-ink-line-2" style={{ background: hex }} aria-hidden />}
                  <span className="relative">{label(f, value)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <fieldset>
        <legend className="mb-3 text-[0.85rem] font-semibold">{t.catalog.price}</legend>
        <div className="flex items-center gap-2">
          <input inputMode="numeric" value={lo} onChange={(e) => setLo(e.target.value)} onBlur={commitPrice} onKeyDown={(e) => e.key === "Enter" && commitPrice()} placeholder={t.catalog.min} aria-label={t.catalog.min} className="field num" />
          <span className="text-ink-soft" aria-hidden>
            –
          </span>
          <input inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value)} onBlur={commitPrice} onKeyDown={(e) => e.key === "Enter" && commitPrice()} placeholder={t.catalog.max} aria-label={t.catalog.max} className="field num" />
        </div>
      </fieldset>

      <button
        type="button"
        role="switch"
        aria-checked={stockOnly}
        onClick={() => onChange({ stock: stockOnly ? null : "1" })}
        className="flex min-h-12 items-center justify-between gap-3 rounded-[16px] px-4 font-semibold border border-ink-line"
      >
        {t.catalog.inStockOnly}
        <span className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${stockOnly ? "bg-ink" : "bg-ink-faint"}`}>
          <motion.span
            className="absolute top-1 size-5 rounded-full bg-paper"
            animate={{ left: stockOnly ? 24 : 4 }}
            transition={{ type: "spring", stiffness: 600, damping: 32 }}
          />
        </span>
      </button>

      {(Object.keys(chosen).length > 0 || stockOnly || min > 0 || max > 0) && (
        <button type="button" onClick={() => onChange({ f: null, stock: null, min: null, max: null })} className="pill pill-soft w-full">
          {t.catalog.reset}
        </button>
      )}
    </div>
  );
}
