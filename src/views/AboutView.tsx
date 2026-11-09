"use client";

import { useEffect } from "react";
import { useSite } from "@/lib/site";
import { tr } from "@/lib/i18n";
import { whatsappLink } from "@/lib/order";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/BrandIcons";
import { IconClock, IconPin } from "@/components/Icons";

export function AboutView() {
  const { t, store, lang } = useSite();
  useEffect(() => {
    document.title = `${t.about.title} — ${store.name}`;
  }, [t.about.title, store.name]);

  const tel = store.phoneDisplay ? `tel:${store.phoneDisplay.replace(/[^\d+]/g, "")}` : undefined;
  const cards: { icon: React.ReactNode; label: string; value: string; href?: string; action?: string }[] = [
    { icon: <IconPin size={20} />, label: t.about.address, value: tr(store.address, lang), href: store.mapUrl || undefined, action: t.about.map },
    { icon: <IconClock size={20} />, label: t.about.hours, value: tr(store.hours, lang) },
    { icon: <WhatsAppIcon size={19} />, label: t.about.phone, value: store.phoneDisplay, href: tel },
    { icon: <span className="text-[1.05rem] font-semibold">@</span>, label: t.about.email, value: store.email, href: store.email ? `mailto:${store.email}` : undefined },
  ].filter((c) => c.value);

  return (
    <section className="wrap pb-16 pt-10 md:pt-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="page-title">{t.about.title}</h1>
        <p className="mt-3 text-ink-soft md:text-lg">{t.about.lead}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 [animation:rise_.6s_.1s_var(--curve)_both]">
          {store.whatsapp && (
            <a href={whatsappLink("", store.whatsapp)} target="_blank" rel="noopener" className="pill pill-wa">
              <WhatsAppIcon size={19} />
              {t.home.writeUs}
            </a>
          )}
          {store.socials.instagram && (
            <a href={store.socials.instagram} target="_blank" rel="noopener" className="pill pill-soft">
              <InstagramIcon size={18} />
              Instagram
            </a>
          )}
          {store.socials.tiktok && (
            <a href={store.socials.tiktok} target="_blank" rel="noopener" className="pill pill-soft">
              <TikTokIcon size={18} />
              TikTok
            </a>
          )}
          {store.socials.facebook && (
            <a href={store.socials.facebook} target="_blank" rel="noopener" className="pill pill-soft">
              Facebook
            </a>
          )}
        </div>
      </div>

      <div className={`mx-auto mt-12 grid max-w-5xl gap-3.5 sm:grid-cols-2 md:mt-16 md:gap-5 ${cards.length === 3 ? "lg:grid-cols-3" : cards.length >= 4 ? "lg:grid-cols-4" : ""}`}>
        {cards.map((c, i) => {
          const body = (
            <>
              <span className="grid size-11 place-items-center rounded-full bg-paper text-ink">{c.icon}</span>
              <p className="mt-5 text-[0.82rem] font-medium text-ink-soft">{c.label}</p>
              <p className="num mt-1 break-words text-[1.08rem] font-semibold tracking-[-0.02em]">{c.value}</p>
              {c.href && c.action && <p className="mt-3 text-[0.85rem] font-medium">{c.action} ›</p>}
            </>
          );
          const cls = "block rounded-[24px] bg-paper-2 p-6 [animation:rise_.6s_var(--curve)_both]";
          const style = { animationDelay: `${0.15 + i * 0.07}s` };
          return c.href ? (
            <a key={c.label} href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener" className={`${cls} transition-colors hover:bg-ink-faint`} style={style}>
              {body}
            </a>
          ) : (
            <div key={c.label} className={cls} style={style}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
