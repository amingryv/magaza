"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** false during the static prerender and first hydration pass, true after. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  listeners.forEach((l) => l());
}

/** A localStorage value as React state (null on the server and before hydration). */
export function useLocal(key: string): string | null {
  return useSyncExternalStore(subscribe, () => readLocal(key), () => null);
}

/** A media query as live state (false on the server). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Remembers the visitor's language: localStorage for the page, a cookie for the Worker's "/" redirect. */
export function rememberLang(lang: string) {
  try {
    localStorage.setItem("lang", lang);
    document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`;
  } catch {}
}
