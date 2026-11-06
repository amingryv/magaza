"use client";

import Link from "next/link";
import { useSite } from "@/lib/site";
import { tr } from "@/lib/i18n";
import { whatsappLink } from "@/lib/order";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "./BrandIcons";
import { LangSwitch } from "./LangSwitch";

/** A quiet light-grey footer: the shop, its categories, how to reach it, its pages. */
export function Footer() {
  const { t, store, lang, categories, menu, href } = useSite();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-ink-line bg-paper-2 md:mt-20">
      <div className="wrap grid gap-9 py-10 md:grid-cols-[1.4fr_1fr_1fr] md:py-14">
        <div>
          <p className="text-[1.6rem] font-[700] tracking-[-0.045em]">{store.name}</p>
          <p className="mt-1 text-ink-soft">{tr(store.tagline, lang)}</p>
          {store.whatsapp && (
            <a href={whatsappLink("", store.whatsapp)} target="_blank" rel="noopener" className="pill pill-wa mt-5 !h-11 !px-5 !text-[0.92rem]">
              <WhatsAppIcon size={18} />
              {t.home.writeUs}
            </a>
          )}
        </div>

        <div>
          <p className="foot-label">{t.nav.catalog}</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-1">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={href(`/catalog/?c=${c.id}`)} className="text-[0.94rem] text-ink-soft transition-colors hover:text-ink">
                  {tr(c.name, lang)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="foot-label">{t.nav.contact}</p>
          <p className="mt-3 text-[0.94rem] font-medium">{tr(store.address, lang)}</p>
          <p className="mt-1 text-[0.94rem] text-ink-soft">{tr(store.hours, lang)}</p>
          <p className="num mt-1 text-[0.94rem] text-ink-soft">{store.phoneDisplay}</p>
          <div className="mt-4 flex items-center gap-2">
            {store.socials.instagram && (
              <a href={store.socials.instagram} aria-label="Instagram" className="orb !size-10">
                <InstagramIcon size={18} />
              </a>
            )}
            {store.socials.tiktok && (
              <a href={store.socials.tiktok} aria-label="TikTok" className="orb !size-10">
                <TikTokIcon size={18} />
              </a>
            )}
          </div>
          <LangSwitch className="mt-5 inline-flex md:hidden" />
        </div>
      </div>

      <div className="border-t border-ink-line">
        <div className="wrap flex flex-col gap-2 py-5 pb-28 text-[0.74rem] text-ink-soft md:flex-row md:items-start md:justify-between md:pb-6">
          <p className="shrink-0">
            © {year} {store.name}. {t.footer.rights}
          </p>
          {menu.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {menu.map((m) => (
                <li key={m.slug}>
                  <Link href={href(`/page/?s=${m.slug}`)} className="underline decoration-ink-line-2 hover:text-ink">
                    {tr(m.title, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
