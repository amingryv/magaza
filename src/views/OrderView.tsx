"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSite } from "@/lib/site";
import { tr } from "@/lib/i18n";
import { useCart, type CartLine } from "@/lib/cart";
import { useLocal, writeLocal } from "@/lib/local";
import { useProductsById } from "@/lib/api";
import { cleanPhone, formatPrice, prettyPhone } from "@/lib/format";
import { resolveLines, saveOrder, submitOrder, type Order } from "@/lib/order";
import { sparks } from "@/lib/spring";
import { CartMeter } from "@/components/CartMeter";
import { IconLock } from "@/components/Icons";
import { ProductImage } from "@/components/ProductImage";

export function OrderView() {
  const { t, lang, href, store } = useSite();
  const { lines, clear, restore, ready: cartReady } = useCart();
  const { map: products, loading } = useProductsById(lines.map((l) => l.productId));
  const ready = cartReady && !loading;
  const router = useRouter();
  const rows = resolveLines(lines, products, lang);
  const total = rows.reduce((s, r) => s + r.price * r.qty, 0);

  // The shopper's details from their last order on this device prefill the form.
  const savedRaw = useLocal("customer-v1");
  const saved = useMemo(() => {
    try {
      return JSON.parse(savedRaw || "{}") as { name?: string; phone?: string };
    } catch {
      return {};
    }
  }, [savedRaw]);
  const [nameInput, setName] = useState<string | null>(null);
  const [phoneInput, setPhone] = useState<string | null>(null);
  const name = nameInput ?? saved.name ?? "";
  const phone = phoneInput ?? saved.phone ?? "";
  const [note, setNote] = useState("");
  const [address, setAddress] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const fields = store.orders.formFields;
  const field = (key: string) => fields.find((x) => x.key === key) ?? { key, visible: false, required: false };
  const addr = field("address");
  const noteField = field("note");
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [ghost, setGhost] = useState<{ lines: CartLine[]; rows: typeof rows } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const sparkSite = useRef<HTMLSpanElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.title = `${t.order.title} — ${store.name}`;
  }, [t.order.title, store.name]);

  const nameErr = tried && name.trim().length < 2;
  const phoneErr = tried && cleanPhone(phone).length !== 9;
  const addressErr = tried && addr.visible && addr.required && !address.trim();
  const noteErr = tried && noteField.visible && noteField.required && !note.trim();
  const belowMin = store.orders.minAmount > 0 && total < store.orders.minAmount;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    setFailure(null);
    if (name.trim().length < 2) return nameRef.current?.focus();
    if (cleanPhone(phone).length !== 9) return phoneRef.current?.focus();
    if (addr.visible && addr.required && !address.trim()) return addressRef.current?.focus();
    if (noteField.visible && noteField.required && !note.trim()) return noteRef.current?.focus();
    if (!rows.length || belowMin || sending) return;

    setSending(true);
    const res = await submitOrder({
      items: rows.map((r) => ({ product_id: Number(r.productId), variant_id: r.variantId === "0" ? null : Number(r.variantId), quantity: r.qty })),
      name: name.trim(),
      phone: cleanPhone(phone),
      address: addr.visible ? address.trim() : undefined,
      note: noteField.visible ? note.trim() : undefined,
      lang,
      website: honeypot.current?.value || undefined,
    });
    if (!res.ok) {
      setSending(false);
      const msg: Record<string, string> = {
        closed: t.order.closed,
        stock: t.order.errStock,
        gone: t.order.errGone,
        rate: t.order.errRate,
        min: t.order.errMin(formatPrice(res.minAmount ?? store.orders.minAmount)),
        required: t.order.errRequired,
        phone: t.order.errPhone,
      };
      setFailure(msg[res.error] ?? t.order.errSend);
      return;
    }

    sparks(sparkSite.current, 18);
    // the shopper's own words for the lines (their language), the server's prices
    const byKey = new Map(rows.map((r) => [`${r.productId}:${r.variantId}`, r]));
    const order: Order = {
      number: res.order.order_number,
      createdAt: new Date().toISOString(),
      lang,
      customer: { name: name.trim(), phone: cleanPhone(phone), address: address.trim() || undefined, note: note.trim() },
      lines: res.order.items.map((it) => {
        const local = byKey.get(`${it.product_id}:${it.variant_id ?? 0}`);
        return {
          productId: String(it.product_id),
          variantId: String(it.variant_id ?? 0),
          name: local?.name ?? it.name,
          variantLabel: local?.variantLabel ?? it.variant_text,
          qty: it.quantity,
          price: it.price,
        };
      }),
      total: res.order.total,
    };
    saveOrder(order);
    writeLocal("customer-v1", JSON.stringify({ name: order.customer.name, phone: order.customer.phone }));
    clear();
    router.push(href(`/order/sent/?n=${encodeURIComponent(order.number)}`));
  };

  if (!store.orders.enabled)
    return (
      <div className="wrap grid min-h-[55dvh] place-items-center py-16 text-center">
        <div>
          <h1 className="text-3xl">{t.order.title}</h1>
          <p className="mt-2 text-ink-soft">{t.order.closed}</p>
        </div>
      </div>
    );

  if (ready && rows.length === 0 && !sending && !ghost)
    return (
      <div className="wrap grid min-h-[55dvh] place-items-center py-16 text-center">
        <div className="[animation:rise_.6s_var(--curve)]">
          <h1 className="text-3xl">{t.cart.empty}</h1>
          <p className="mt-2 text-ink-soft">{t.order.emptyCart}</p>
          <Link href={href("/catalog/")} className="pill pill-ink mt-6">
            {t.nav.catalog}
          </Link>
        </div>
      </div>
    );

  const label = "mb-2 block text-[0.88rem] font-semibold";
  const summaryList = (
            <ul className="divide-y divide-ink-line">
              {rows.map((r) => {
                const p = products.get(r.productId);
                return (
                  <li key={`${r.productId}-${r.variantId}`} className="flex items-center gap-3 py-3">
                    <span className="frame frame-thumb !w-14 shrink-0">{p && <ProductImage product={p} size="thumb" />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold tracking-[-0.02em]">{r.name}</p>
                      <p className="num truncate text-[0.8rem] text-ink-soft">
                        {r.variantLabel ? `${r.variantLabel} · ` : ""}
                        {r.qty} × {formatPrice(r.price)}
                      </p>
                    </div>
                    <span className="num font-bold">{formatPrice(r.qty * r.price)}</span>
                  </li>
                );
              })}
            </ul>
  );

  return (
    <div className="wrap pb-10 pt-6 md:pt-12">
      <h1 className="page-title">{t.order.title}</h1>
      <p className="mt-2 max-w-[36rem] text-ink-soft md:text-lg">{t.order.lead}</p>

      {/* phone: the order folds into one line above the form */}
      <details className="group mt-6 rounded-[20px] bg-paper-2 md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            {t.order.showSummary} <span className="font-normal text-ink-soft">· {t.cart.items(rows.reduce((s, r) => s + r.qty, 0))}</span>
          </span>
          <span className="num flex items-center gap-2">
            {formatPrice(total)}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-transform group-open:rotate-180">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </summary>
        <div className="px-4 pb-3">{summaryList}</div>
      </details>

      <div className="mt-8 grid gap-10 md:mt-10 md:grid-cols-12">
        <form onSubmit={submit} noValidate className="grid content-start gap-10 md:col-span-7 [&>*]:[animation:rise_.6s_var(--curve)_both] [&>*:nth-child(2)]:[animation-delay:.08s] [&>*:nth-child(3)]:[animation-delay:.16s]">
          <Step n={1} title={t.order.stepContact}>
            <div>
              <label htmlFor="name" className={label}>
                {t.order.name}
              </label>
              <input
                id="name"
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder={t.order.namePh}
                aria-invalid={nameErr}
                aria-describedby={nameErr ? "name-err" : undefined}
                className="field"
              />
              {nameErr && (
                <p id="name-err" className="mt-2 text-sm font-semibold text-danger [animation:rise_.3s_var(--curve)]">
                  {t.order.errName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className={label}>
                {t.order.phone}
              </label>
              <div className="relative">
                <span className="num pointer-events-none absolute left-2 top-1/2 grid h-10 -translate-y-1/2 place-items-center rounded-[10px] bg-paper-2 px-3 text-[0.95rem] font-semibold text-ink">+994</span>
                <input
                  id="phone"
                  ref={phoneRef}
                  value={prettyPhone(cleanPhone(phone))}
                  onChange={(e) => setPhone(cleanPhone(e.target.value))}
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder={t.order.phonePh}
                  aria-invalid={phoneErr}
                  aria-describedby={phoneErr ? "phone-err" : undefined}
                  className="field num !pl-[5.4rem]"
                />
              </div>
              {phoneErr && (
                <p id="phone-err" className="mt-2 text-sm font-semibold text-danger [animation:rise_.3s_var(--curve)]">
                  {t.order.errPhone}
                </p>
              )}
            </div>
          </Step>

          {(addr.visible || noteField.visible) && (
            <Step n={2} title={t.order.stepDelivery}>
              {addr.visible && (
                <div>
                  <label htmlFor="address" className={label}>
                    {t.order.address} {!addr.required && <span className="font-normal text-ink-soft">· {t.order.optional}</span>}
                  </label>
                  <input
                    id="address"
                    ref={addressRef}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    autoComplete="street-address"
                    placeholder={t.order.addressPh}
                    aria-invalid={addressErr}
                    className="field"
                  />
                  {addressErr && <p className="mt-2 text-sm font-semibold text-danger">{t.order.errRequired}</p>}
                </div>
              )}

              {noteField.visible && (
                <div>
                  <label htmlFor="note" className={label}>
                    {t.order.note} {!noteField.required && <span className="font-normal text-ink-soft">· {t.order.optional}</span>}
                  </label>
                  <textarea id="note" ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t.order.notePh} aria-invalid={noteErr} className="field resize-y" />
                  {noteErr && <p className="mt-2 text-sm font-semibold text-danger">{t.order.errRequired}</p>}
                </div>
              )}
            </Step>
          )}

          <Step n={addr.visible || noteField.visible ? 3 : 2} title={t.order.stepSend}>
            <div className="grid gap-2.5">
              {belowMin && <p className="text-center text-sm font-semibold text-danger">{t.order.errMin(formatPrice(store.orders.minAmount))}</p>}
              {tr(store.orders.deliveryNote, lang) && <p className="text-center text-[0.85rem] text-ink-soft">{tr(store.orders.deliveryNote, lang)}</p>}
              <button type="submit" disabled={sending || rows.length === 0 || belowMin} className="pill pill-ink relative h-14 w-full text-[1.02rem]">
                {sending ? t.order.sending : t.order.sendSite}
                <span className="sparks" ref={sparkSite} aria-hidden />
              </button>
              {failure && (
                <p role="alert" className="text-center text-sm font-semibold text-danger [animation:rise_.3s_var(--curve)]">
                  {failure}
                </p>
              )}
              <p className="text-center text-[0.8rem] text-ink-soft">{t.order.siteHint}</p>
              <p className="mt-1 flex items-center justify-center gap-2 text-[0.8rem] font-medium text-ink-soft">
                <IconLock />
                {t.order.privacy}
              </p>
            </div>
          </Step>

          {/* honeypot: hidden from people and screen readers; bots fill it */}
          <input ref={honeypot} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        </form>

        <aside className="hidden md:col-span-5 md:block [animation:rise_.7s_.1s_var(--curve)_both]">
          <div className="rounded-[24px] bg-paper-2 p-5 md:sticky md:top-24">
            <CartMeter
              rows={rows}
              ghost={ghost?.rows ?? null}
              onClear={() => {
                setGhost({ lines, rows });
                clear();
              }}
              onUndo={() => {
                if (ghost) restore(ghost.lines);
                setGhost(null);
              }}
            />
            <div className="mt-5 border-t border-ink-line">{summaryList}</div>
            <Link href={href("/cart/")} className="mt-3 inline-block text-[0.85rem] font-medium underline-offset-4 hover:underline">
              {t.order.editCart}
            </Link>
            <p className="mt-2 text-[0.8rem] text-ink-soft">{t.cart.note}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5">
      <h2 className="flex items-center gap-3 text-[1.3rem] font-[650] tracking-[-0.025em] md:text-[1.5rem]">
        <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-ink text-[0.85rem] font-semibold text-paper">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
