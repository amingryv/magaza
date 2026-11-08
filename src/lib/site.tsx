"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import type { Bootstrap } from "@/shared/api-types";
import { FONTS, publicStore } from "@/shared/settings";
import { DICTS, LANGS, type Dict, type Lang, type LocalText } from "./i18n";
import { adaptBootstrap, flatCategories, type CatalogContext, type StoreSettings } from "./adapt";
import type { Category } from "./catalog-types";
import { setCurrency } from "./format";

type SiteCtx = {
  lang: Lang;
  t: Dict;
  store: StoreSettings;
  /** top-level categories, each with its children */
  categories: Category[];
  /** any category, top-level or nested, by slug */
  findCategory: (slug: string) => Category | undefined;
  menu: { slug: string; title: LocalText }[];
  ctx: CatalogContext;
  /** false until the shop's data has arrived (first render during hydration) */
  ready: boolean;
  href: (path: string) => string;
};

const Ctx = createContext<SiteCtx | null>(null);

/* ══ Bootstrap: the shop's settings, categories and attributes ══
   The Worker writes them into every page as <script id="__boot">, so they
   are there before the first render. Without it (`next dev`, or a database
   hiccup) they are fetched from /api/bootstrap once. The build itself holds
   no shop data at all. */

let boot: Bootstrap | null = null;
let asked = false;
const listeners = new Set<() => void>();

function readBoot(): Bootstrap | null {
  if (boot) return boot;
  try {
    const el = document.getElementById("__boot");
    if (el?.textContent) boot = JSON.parse(el.textContent) as Bootstrap;
  } catch {}
  if (!boot && !asked) {
    asked = true;
    fetch("/api/bootstrap")
      .then((r) => (r.ok ? r.json() : null))
      .then((b: Bootstrap | null) => {
        if (!b) return;
        boot = b;
        listeners.forEach((l) => l());
      })
      .catch(() => {});
  }
  return boot;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const EMPTY: Bootstrap = { store: publicStore({}), categories: [], attributes: [], menu: [] };

const word = (k: "yes" | "no"): LocalText => Object.fromEntries(LANGS.map((l) => [l, DICTS[l].product[k]])) as LocalText;
const YES = word("yes");
const NO = word("no");

export function SiteProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  // the server snapshot (null) keeps hydration identical to the built HTML;
  // React re-renders with the real data right after
  const b = useSyncExternalStore(subscribe, readBoot, () => null);
  const data = useMemo(() => adaptBootstrap(b ?? EMPTY, YES, NO), [b]);
  setCurrency(data.store.currency.symbol);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // the Worker already wrote these into <head>; this covers `next dev`
  useEffect(() => {
    if (!b || document.getElementById("brand")) return;
    const s = document.documentElement.style;
    s.setProperty("--brand-paper", data.store.theme.paper);
    s.setProperty("--brand-ink", data.store.theme.ink);
    s.setProperty("--brand-accent", data.store.theme.accent);
    if (data.store.theme.font !== "Inter Tight") s.setProperty("--font-sans", `${FONTS[data.store.theme.font]}, system-ui, sans-serif`);
    if (data.store.theme.layout === "list") document.documentElement.dataset.layout = "list";
  }, [b, data.store.theme]);

  const byslug = useMemo(() => new Map(flatCategories(data.categories).map((c) => [c.id, c])), [data.categories]);

  const value = useMemo<SiteCtx>(
    () => ({
      lang,
      t: DICTS[lang],
      ...data,
      findCategory: (slug: string) => byslug.get(slug),
      ready: !!b,
      href: (path: string) => `/${lang}${path.startsWith("/") ? path : `/${path}`}`,
    }),
    [lang, data, b, byslug],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSite outside SiteProvider");
  return c;
}

/** Shop data outside the [lang] tree (the root redirect, the 404 page). */
export function useBoot(): Bootstrap | null {
  return useSyncExternalStore(subscribe, readBoot, () => null);
}
