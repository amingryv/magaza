"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useSite } from "@/lib/site";
import { LANG_LABEL, LANG_NAME, type Lang } from "@/lib/i18n";
import { rememberLang } from "@/lib/local";

/** Same page, other language. A pill slides to the chosen one. */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, store, t } = useSite();
  const pathname = usePathname();

  const go = (to: Lang) => {
    rememberLang(to);
    const rest = pathname.replace(/^\/(az|ru|en)(?=\/|$)/, "");
    // A full load on purpose: every string and <html lang> switch at once.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/${to}${rest || "/"}${window.location.search}`);
  };

  return (
    <div role="group" aria-label={t.nav.language} className={`items-center gap-0.5 rounded-full bg-ink-faint p-1 ${className}`}>
      {store.languages.map((l) => {
        const active = l === lang;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            title={LANG_NAME[l]}
            aria-pressed={active}
            onClick={() => !active && go(l)}
            className={`relative h-9 min-w-10 rounded-full px-2.5 text-[0.78rem] font-bold tracking-wide transition-colors active:scale-95 ${active ? "text-ink" : "text-ink-soft hover:text-ink"}`}
          >
            {active && <motion.span layoutId="lang-pill" className="absolute inset-0 rounded-full bg-paper" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">{LANG_LABEL[l]}</span>
          </button>
        );
      })}
    </div>
  );
}
