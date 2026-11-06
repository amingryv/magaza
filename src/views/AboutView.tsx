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

  const cards = [
    { icon: <IconPin size={20} />, label: t.about.address, value: tr(store.address, lang) },
    { icon: <IconClock size={20} />, label: t.about.hours, value: tr(store.hours, lang) },
    { icon: <WhatsAppIcon size={19} />, label: t.about.phone, value: store.phoneDisplay },
  ].filter((c) => c.value);

  return (
    <section className="relative overflow-hidden">
      <div className="wrap relative pb-14 pt-6 md:pt-12">
        
        <h1 className="page-title">{t.about.title}</h1>
        <p className="mt-2 max-w-[36rem] text-ink-soft md:text-lg">{t.about.lead}</p>

        <div className="mt-8 grid gap-3.5 md:grid-cols-3 md:gap-5">
          {cards.map((c, i) => (
            <div
              key={c.label}
              className="rounded-[20px] bg-paper-2 p-5 [animation:rise_.6s_var(--curve)_both]"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <span className="grid size-11 place-items-center rounded-full bg-paper text-ink">{c.icon}</span>
              <p className="mt-4 text-[0.82rem] font-medium text-ink-soft">{c.label}</p>
              <p className="num mt-1 text-[1.08rem] font-semibold tracking-[-0.02em]">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 [animation:rise_.6s_.2s_var(--curve)_both]">
          {store.whatsapp && (
            <a href={whatsappLink("", store.whatsapp)} target="_blank" rel="noopener" className="pill pill-wa">
              <WhatsAppIcon size={19} />
              {t.home.writeUs}
            </a>
          )}
          {store.socials.instagram && (
            <a href={store.socials.instagram} className="pill pill-soft">
              <InstagramIcon size={18} />
              Instagram
            </a>
          )}
          {store.socials.tiktok && (
            <a href={store.socials.tiktok} className="pill pill-soft">
              <TikTokIcon size={18} />
              TikTok
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
