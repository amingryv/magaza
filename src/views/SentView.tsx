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
      <div className="wrap relative grid place-items-center pb-10 pt-14 md:pb-14 md:pt-20">
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

      <div className="wrap grid gap-4 pb-16 md:grid-cols-2 md:gap-5 [animation:rise_.7s_.5s_var(--curve)_both]">
        {order && (
          <div className="rounded-[24px] bg-paper-2 p-5 md:p-7">
            <h2 className="text-[1.2rem] font-[650] tracking-[-0.025em]">{t.order.summary}</h2>
            <ul className="mt-4 divide-y divide-ink-line border-y border-ink-line">
              {order.lines.map((l) => (
                <li key={`${l.productId}-${l.variantId}`} className="flex items-baseline justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-[-0.02em]">{l.name}</p>
                    <p className="num truncate text-[0.8rem] text-ink-soft">
                      {l.variantLabel ? `${l.variantLabel} · ` : ""}
                      {l.qty} × {formatPrice(l.price)}
                    </p>
                  </div>
                  <span className="num shrink-0 font-semibold">{formatPrice(l.qty * l.price)}</span>
                </li>
              ))}
            </ul>
            <p className="num mt-4 flex items-baseline justify-between text-[1.1rem] font-bold">
              <span>{t.cart.total}</span>
              <span>{formatPrice(order.total)}</span>
            </p>
          </div>
        )}
        <div className={`rounded-[24px] bg-paper-2 p-5 md:p-7 ${order ? "" : "md:col-span-2 md:mx-auto md:w-full md:max-w-xl"}`}>
          <h2 className="text-[1.2rem] font-[650] tracking-[-0.025em]">{t.sent.nextTitle}</h2>
          <ol className="mt-4 grid gap-4">
            {t.sent.next.map((step, i) => (
              <li key={step} className="flex items-center gap-3.5">
                <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-paper text-[0.85rem] font-semibold">{i + 1}</span>
                <span className="text-[0.98rem]">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
