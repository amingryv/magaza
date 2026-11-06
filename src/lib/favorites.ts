"use client";

import { useMemo } from "react";
import { readLocal, useLocal, writeLocal } from "./local";

const KEY = "fav-v1";

function parse(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Saved product ids, kept on this device only. */
export function useFavorites() {
  const raw = useLocal(KEY);
  const ids = useMemo(() => parse(raw), [raw]);
  const toggle = (id: string) => {
    const now = parse(readLocal(KEY));
    writeLocal(KEY, JSON.stringify(now.includes(id) ? now.filter((x) => x !== id) : [id, ...now]));
  };
  return { ids, has: (id: string) => ids.includes(id), toggle };
}
