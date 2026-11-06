"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ApiFilters, ApiPage, ApiProduct, ApiProductList } from "@/shared/api-types";
import { adaptProduct } from "./adapt";
import type { Product } from "./catalog-types";
import { useSite } from "./site";

/* ══ A tiny shared request cache ═════════════════════════
   Every GET goes through here, keyed by URL. Components read entries during
   render and subscribe to one version counter, so a list, the search card
   and the cart asking for the same URL share one request. Entries go stale
   after a minute and are fetched again on next use. */

type Entry = { status: "loading" | "ok" | "error"; data?: unknown; at: number };

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;
const TTL = 60_000;

function emit() {
  version++;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Starts a request unless a fresh (or running) one exists. */
export function load(url: string): Promise<unknown> {
  const e = entries.get(url);
  if (e && (e.status === "loading" || (e.status === "ok" && Date.now() - e.at < TTL))) return Promise.resolve(e.data);
  entries.set(url, { status: "loading", data: e?.data, at: Date.now() });
  emit();
  return fetch(url, { headers: { accept: "application/json" } })
    .then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      entries.set(url, { status: "ok", data, at: Date.now() });
      emit();
      return data;
    })
    .catch(() => {
      entries.set(url, { status: "error", data: e?.data, at: Date.now() });
      emit();
    });
}

function useEntries(urls: (string | null)[]): (Entry | undefined)[] {
  useSyncExternalStore(subscribe, () => version, () => 0);
  const key = urls.join("\n");
  useEffect(() => {
    for (const u of key.split("\n")) if (u) void load(u);
  }, [key]);
  return urls.map((u) => (u ? entries.get(u) : undefined));
}

/* ── query building ──────────────────────────────────────── */

export type ProductQuery = {
  category?: string;
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  attrs?: Record<string, string[]>;
  inStock?: boolean;
  featured?: boolean;
  ids?: string[];
  sort?: "new" | "price_asc" | "price_desc" | "popular";
  limit?: number;
};

export function productsUrl(query: ProductQuery, page = 1): string {
  const sp = new URLSearchParams();
  if (query.category) sp.set("category", query.category);
  if (query.q?.trim()) sp.set("q", query.q.trim());
  if (query.minPrice) sp.set("min_price", String(query.minPrice));
  if (query.maxPrice) sp.set("max_price", String(query.maxPrice));
  for (const [k, vs] of Object.entries(query.attrs ?? {}).sort()) for (const v of vs) sp.append(`attr[${k}]`, v);
  if (query.inStock) sp.set("in_stock", "1");
  if (query.featured) sp.set("featured", "1");
  if (query.ids) sp.set("ids", [...query.ids].sort().join(","));
  if (query.sort && query.sort !== "popular") sp.set("sort", query.sort);
  if (query.limit) sp.set("limit", String(query.limit));
  if (page > 1) sp.set("page", String(page));
  return `/api/products?${sp}`;
}

/* ── hooks ───────────────────────────────────────────────── */

export type ListState = { items: Product[]; total: number; loading: boolean; error: boolean };

/**
 * Products for a query, `pages` pages of it concatenated ("show more").
 * `null` asks for nothing (e.g. an empty search).
 */
export function useProducts(query: ProductQuery | null, pages = 1): ListState {
  const { ctx } = useSite();
  const base = query ? productsUrl(query) : null;
  const urls = useMemo(
    () => (query ? Array.from({ length: Math.max(1, pages) }, (_, i) => productsUrl(query, i + 1)) : []),
    [base, pages], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const list = useEntries(urls);
  const raw = list.map((e) => e?.data as ApiProductList | undefined);
  const stamp = list.map((e) => e?.at ?? 0).join(",");

  const items = useMemo(() => {
    const seen = new Set<number>();
    const out: Product[] = [];
    for (const page of raw) for (const p of page?.items ?? []) if (!seen.has(p.id) && (seen.add(p.id), true)) out.push(adaptProduct(p, ctx));
    return out;
  }, [stamp, ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    items,
    total: raw.find(Boolean)?.total ?? 0,
    loading: list.some((e) => !e || (e.status === "loading" && !e.data)),
    error: list.some((e) => e?.status === "error" && !e.data),
  };
}

/** Products by id, for the cart, the order and favourites. Keeps the given order. */
export function useProductsById(ids: string[]): { map: Map<string, Product>; loading: boolean } {
  const unique = [...new Set(ids)].filter(Boolean);
  const state = useProducts(unique.length ? { ids: unique, limit: 100 } : null);
  const map = useMemo(() => new Map(state.items.map((p) => [p.id, p])), [state.items]);
  return { map, loading: unique.length > 0 && state.loading };
}

export function useProduct(slug: string | null): { product: Product | undefined; loading: boolean; missing: boolean } {
  const { ctx } = useSite();
  const url = slug ? `/api/products/${encodeURIComponent(slug)}` : null;
  const [e] = useEntries([url]);
  const raw = e?.data as ApiProduct | undefined;
  const product = useMemo(() => (raw ? adaptProduct(raw, ctx) : undefined), [raw, ctx]);
  return { product, loading: !!url && (!e || (e.status === "loading" && !raw)), missing: !url || (e?.status === "error" && !raw) };
}

export function useFilters(category: string | null): ApiFilters | undefined {
  const url = `/api/attributes/filters${category ? `?category=${encodeURIComponent(category)}` : ""}`;
  const [e] = useEntries([url]);
  return e?.data as ApiFilters | undefined;
}

export function usePage(slug: string | null): { page: ApiPage | undefined; loading: boolean; missing: boolean } {
  const url = slug ? `/api/pages/${encodeURIComponent(slug)}` : null;
  const [e] = useEntries([url]);
  const page = e?.data as ApiPage | undefined;
  return { page, loading: !!url && (!e || (e.status === "loading" && !page)), missing: !url || (e?.status === "error" && !page) };
}
