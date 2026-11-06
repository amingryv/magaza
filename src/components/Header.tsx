"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useSite } from "@/lib/site";
import { LangSwitch } from "./LangSwitch";
import { BagButton } from "./BagButton";
import { useSearch } from "./Search";
import { IconSearch } from "./Icons";

/** Plain white bar; a hairline appears under it once the page scrolls. */
export function Header() {
  const { t, store, href } = useSite();
  const search = useSearch();
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      setScrolled(window.scrollY > 4);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    raf = requestAnimationFrame(read);
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  const links = [
    { to: "/catalog/", label: t.nav.catalog },
    { to: "/favorites/", label: t.nav.favorites },
    { to: "/about/", label: t.nav.contact },
  ];
  const isOn = (to: string) => path.startsWith(href(to).replace(/\/$/, ""));

  return (
    <header className="site-head" data-scrolled={scrolled || undefined}>
      <div className="wrap flex h-16 items-center gap-3 md:h-[4.25rem] md:gap-6">
        <Link href={href("/")} className="mr-auto shrink-0 text-[1.45rem] font-[700] tracking-[-0.045em] md:mr-0" aria-label={store.name}>
          <span data-store="name" suppressHydrationWarning>
            {store.name}
          </span>
        </Link>

        <nav aria-label={t.nav.menu} className="hidden flex-1 justify-center md:flex">
          <ul className="flex items-center gap-1">
            {links.map((l) => {
              const on = isOn(l.to);
              return (
                <li key={l.to}>
                  <Link
                    href={href(l.to)}
                    aria-current={on ? "page" : undefined}
                    className={`relative block rounded-full px-4 py-2 text-[0.92rem] font-medium transition-colors ${on ? "text-ink" : "text-ink-soft hover:text-ink"}`}
                  >
                    {on && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-paper-2" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                    <span className="relative">{l.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1.5">
          <LangSwitch className="hidden md:flex" />
          <button type="button" className="orb orb-quiet" onClick={search.open} aria-label={t.nav.search} aria-haspopup="dialog">
            <IconSearch size={20} />
          </button>
          <BagButton />
        </div>
      </div>
    </header>
  );
}
