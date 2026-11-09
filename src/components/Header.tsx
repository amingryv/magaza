"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSite } from "@/lib/site";
import { tr } from "@/lib/i18n";
import { LangSwitch } from "./LangSwitch";
import { BagButton } from "./BagButton";
import { useSearch } from "./Search";
import { IconHeart, IconSearch } from "./Icons";

/**
 * A thin frosted bar. On a desktop the middle carries the shop's top
 * categories in small type; on a phone only the name, search and bag stay
 * (the tab bar at the bottom does the rest). A hairline appears once the
 * page scrolls.
 */
export function Header() {
  const { t, store, href, categories, lang } = useSite();
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

  // the catalogue, up to six top categories, contact
  const links = [
    { to: "/catalog/", label: t.nav.catalog, page: "/catalog/" },
    ...categories.slice(0, 6).map((c) => ({ to: `/catalog/?c=${c.id}`, label: tr(c.name, lang), page: "" })),
    { to: "/about/", label: t.nav.contact, page: "/about/" },
  ];
  const isOn = (page: string) => !!page && path.startsWith(href(page).replace(/\/$/, ""));
  const favOn = isOn("/favorites/");

  return (
    <header className="site-head" data-scrolled={scrolled || undefined}>
      <div className="wrap flex h-14 items-center gap-2 md:h-[3.25rem] md:gap-6">
        <Link href={href("/")} className="head-name mr-auto md:mr-0" aria-label={store.name}>
          <span data-store="name" suppressHydrationWarning>
            {store.name}
          </span>
        </Link>

        <nav aria-label={t.nav.menu} className="hidden min-w-0 flex-1 justify-center md:flex">
          <ul className="flex min-w-0 items-center gap-1 lg:gap-3">
            {links.map((l) => (
              <li key={l.to} className="min-w-0">
                <Link href={href(l.to)} aria-current={isOn(l.page) ? "page" : undefined} className="head-link">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-0.5">
          <LangSwitch className="mr-1 hidden md:flex" />
          <button type="button" className="orb" onClick={search.open} aria-label={t.nav.search} aria-haspopup="dialog">
            <IconSearch size={19} />
          </button>
          <Link href={href("/favorites/")} className="orb !hidden md:!grid" aria-label={t.nav.favorites} aria-current={favOn ? "page" : undefined}>
            <IconHeart size={19} />
          </Link>
          <BagButton />
        </div>
      </div>
    </header>
  );
}
