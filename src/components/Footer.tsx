"use client";

import Link from "next/link";
import { useSite } from "@/lib/site";
import { tr } from "@/lib/i18n";
import { whatsappLink } from "@/lib/order";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "./BrandIcons";
import { LangSwitch } from "./LangSwitch";

/**
 * A quiet grey footer in small type: the shop and its WhatsApp on one line,
 * then columns (catalogue, information, contact), then the fine print.
 */
export function Footer() {
  const { t, store, lang, categories, menu, href } = useSite();
  const year = new Date().getFullYear();
  const tagline = tr(store.tagline, lang);
  const address = tr(store.address, lang);
  const hours = tr(store.hours, lang);

  return (
    <footer className="foot">
      <div className="wrap">
        <div className="flex flex-col gap-4 py-8 md:flex-row md:items-center md:justify-between md:py-10">
          <div className="min-w-0">
            <p className="text-[1.3rem] font-[650] tracking-[-0.04em]">{store.name}</p>
            {tagline && <p className="mt-0.5 text-[0.86rem] text-ink-soft">{tagline}</p>}
          </div>
          {store.whatsapp && (
            <a href={whatsappLink("", store.whatsapp)} target="_blank" rel="noopener" className="pill pill-wa !h-10 self-start !px-4 !text-[0.86rem] md:self-auto">
              <WhatsAppIcon size={17} />
              {t.home.writeUs}
            </a>
          )}
        </div>

        <div className="foot-cols">
          {categories.length > 0 && (
            <div>
              <p className="foot-label">{t.nav.catalog}</p>
              <ul className="foot-list">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link href={href(`/catalog/?c=${c.id}`)}>{tr(c.name, lang)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="foot-label">{t.footer.info}</p>
            <ul className="foot-list">
              {menu.map((m) => (
                <li key={m.slug}>
                  <Link href={href(`/page/?s=${m.slug}`)}>{tr(m.title, lang)}</Link>
                </li>
              ))}
              <li>
                <Link href={href("/favorites/")}>{t.nav.favorites}</Link>
              </li>
              <li>
                <Link href={href("/about/")}>{t.nav.contact}</Link>
              </li>
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1">
            <p className="foot-label">{t.nav.contact}</p>
            <ul className="foot-list">
              {address && <li className="!text-ink">{address}</li>}
              {hours && <li>{hours}</li>}
              {store.phoneDisplay && (
                <li className="num">
                  <a href={`tel:${store.phoneDisplay.replace(/[^\d+]/g, "")}`}>{store.phoneDisplay}</a>
                </li>
              )}
            </ul>
            {(store.socials.instagram || store.socials.tiktok) && (
              <div className="mt-3 flex items-center gap-1.5">
                {store.socials.instagram && (
                  <a href={store.socials.instagram} aria-label="Instagram" className="orb !size-9">
                    <InstagramIcon size={16} />
                  </a>
                )}
                {store.socials.tiktok && (
                  <a href={store.socials.tiktok} aria-label="TikTok" className="orb !size-9">
                    <TikTokIcon size={16} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-ink-line py-5 pb-28 text-[0.74rem] text-ink-soft md:flex-row md:items-center md:justify-between md:pb-6">
          <p>
            © {year} {store.name}. {t.footer.rights}
          </p>
          <LangSwitch className="inline-flex self-start md:hidden" />
        </div>
      </div>
    </footer>
  );
}
