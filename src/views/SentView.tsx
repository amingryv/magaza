"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSite } from "@/lib/site";
import { useHydrated, useLocal } from "@/lib/local";
import { loadOrder, whatsappLink, whatsappText } from "@/lib/order";
import { formatPrice } from "@/lib/format";
import { sparks } from "@/lib/spring";
import { WhatsAppIcon } from "@/components/BrandIcons";
import { Roll } from "@/components/Roll";

/** The ✓ draws itself, confetti leaves it, the order number rolls in. */
export function SentView() {
  const { t, href, store } = useSite();
  const params = useSearchParams();
  const n = params.get("n");
  const hydrated = useHydrated();
  useLocal("orders-v1"); // re-render when saved orders change
  const order = hydrated ? loadOrder(n) : undefined;
  const viaWa = store.whatsappButton && !!store.whatsapp;
  const burst = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => sparks(burst.current, 22), 420);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <section className="relative overflow-hidden">
      <div className="wrap relative grid min-h-[70dvh] place-items-center py-14">
        <div className="w-full max-w-xl text-center">
          <span style={{ background: viaWa ? "var(--wa)" : "var(--ink)", color: "var(--paper)" }} className="relative mx-auto grid size-20 place-items-center rounded-full text-white [animation:pop_.6s_var(--spring)_both]">
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m5.5 12.5 4.3 4.3 8.7-9.3" strokeDasharray="30" strokeDashoffset="30" style={{ animation: "draw .5s .3s var(--curve) forwards" }} />
            </svg>
            <span ref={burst} className="sparks" style={{ "--spark": viaWa ? "#1f8a55" : "var(--ink)" } as React.CSSProperties} aria-hidden />
          </span>
          <h1 className="page-title mt-8 [animation:rise_.7s_.15s_var(--curve)_both]">{t.sent.title}</h1>
          {n && (
            <p className="mt-4 flex items-center justify-center gap-3 text-ink-soft [animation:rise_.7s_.25s_var(--curve)_both]">
              {t.sent.number}
              <span className="num rounded-full bg-paper-2 px-4 py-1.5 text-2xl font-[700] tracking-[-0.03em] text-ink">
                <Roll text={`#${n}`} />
              </span>
            </p>
          )}
          <p className="mx-auto mt-5 max-w-md text-[1.05rem] text-ink-soft [animation:rise_.7s_.32s_var(--curve)_both]">{viaWa ? t.sent.leadWa : t.sent.leadSite}</p>
          {order && (
            <p className="num mt-2 font-semibold text-ink-soft">
              {t.cart.total}: <span className="text-ink">{formatPrice(order.total)}</span>
            </p>
          )}
          <div className="mt-8 flex flex-col gap-3 [animation:rise_.7s_.4s_var(--curve)_both] sm:flex-row sm:justify-center">
            {order && viaWa && (
              <a href={whatsappLink(whatsappText(order), store.whatsapp)} target="_blank" rel="noopener" className="pill pill-wa">
                <WhatsAppIcon size={19} />
                {t.sent.sendWa}
              </a>
            )}
            <Link href={href("/")} className="pill pill-soft">
              {t.sent.home}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
