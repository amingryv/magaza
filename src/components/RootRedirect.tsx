"use client";

import { useEffect } from "react";
import { isLang } from "@/lib/i18n";
import { useBoot } from "@/lib/site";

export function RootRedirect() {
  const boot = useBoot();
  useEffect(() => {
    if (!boot) return;
    const { language, languages } = boot.store;
    let lang: string = language;
    try {
      const saved = localStorage.getItem("lang") ?? undefined;
      if (isLang(saved) && languages.includes(saved)) lang = saved;
    } catch {}
    window.location.replace(`/${lang}/`);
  }, [boot]);
  return null;
}
