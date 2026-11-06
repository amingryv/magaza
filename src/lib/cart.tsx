"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useHydrated, useLocal, writeLocal } from "./local";

export type CartLine = { productId: string; variantId: string; qty: number };

type CartCtx = {
  lines: CartLine[];
  count: number;
  ready: boolean;
  add: (productId: string, variantId: string, qty?: number) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  remove: (productId: string, variantId: string) => void;
  clear: () => void;
  /** put lines back (Undo after Clear) */
  restore: (lines: CartLine[]) => void;
  /** Increments on every add — drives the header's knot animation. */
  pulse: number;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "cart-v1";
const MAX_QTY = 20;
const EMPTY: CartLine[] = [];

function parse(raw: string | null): CartLine[] {
  if (!raw) return EMPTY;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : EMPTY;
  } catch {
    return EMPTY;
  }
}

const same = (l: CartLine, p: string, v: string) => l.productId === p && l.variantId === v;

/** The cart lives in localStorage, so it survives reloads and is shared across tabs. */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const raw = useLocal(KEY);
  const ready = useHydrated();
  const lines = useMemo(() => parse(raw), [raw]);
  const [pulse, setPulse] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const update = useCallback((fn: (prev: CartLine[]) => CartLine[]) => {
    let current: CartLine[] = EMPTY;
    try {
      current = parse(localStorage.getItem(KEY));
    } catch {}
    writeLocal(KEY, JSON.stringify(fn(current)));
  }, []);

  const add = useCallback(
    (productId: string, variantId: string, qty = 1) => {
      update((prev) => {
        const hit = prev.find((l) => same(l, productId, variantId));
        if (hit) return prev.map((l) => (l === hit ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l));
        return [...prev, { productId, variantId, qty }];
      });
      setPulse((n) => n + 1);
    },
    [update],
  );

  const setQty = useCallback(
    (productId: string, variantId: string, qty: number) =>
      update((prev) =>
        qty <= 0
          ? prev.filter((l) => !same(l, productId, variantId))
          : prev.map((l) => (same(l, productId, variantId) ? { ...l, qty: Math.min(MAX_QTY, qty) } : l)),
      ),
    [update],
  );

  const remove = useCallback(
    (productId: string, variantId: string) => update((prev) => prev.filter((l) => !same(l, productId, variantId))),
    [update],
  );

  const clear = useCallback(() => update(() => EMPTY), [update]);
  const restore = useCallback((l: CartLine[]) => update(() => l), [update]);

  const value = useMemo<CartCtx>(
    () => ({
      lines,
      count: lines.reduce((s, l) => s + l.qty, 0),
      ready,
      add,
      setQty,
      remove,
      clear,
      restore,
      pulse,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [lines, ready, add, setQty, remove, clear, restore, pulse, drawerOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart outside CartProvider");
  return c;
}
