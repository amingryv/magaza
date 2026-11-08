"use client";

import { useEffect, useRef, useState } from "react";
import { call } from "./api";
import { BackIcon } from "./controls";
import { Notice, Spinner, useAction } from "./ui";
import { go, useShop } from "./Panel";

/* Orders: list with status chips and search (#/orders), one order (#/orders/<id>). */

export type OrderStatus = "new" | "confirmed" | "shipped" | "completed" | "cancelled";

export const STATUS: Record<OrderStatus, { name: string; cls: string }> = {
  new: { name: "Yeni", cls: "bg-ink text-paper" },
  confirmed: { name: "Təsdiqləndi", cls: "bg-paper-3 text-ink" },
  shipped: { name: "Göndərildi", cls: "bg-paper-3 text-ink" },
  completed: { name: "Tamamlandı", cls: "bg-ok/12 text-ok" },
  cancelled: { name: "Ləğv edildi", cls: "bg-danger/10 text-danger" },
};
const ORDER: OrderStatus[] = ["new", "confirmed", "shipped", "completed", "cancelled"];

export type OrderRow = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  total: number;
  status: OrderStatus;
  notified: number;
  created_at: string;
  items?: number;
};

type Order = OrderRow & {
  customer_phone: string;
  address: string;
  note: string;
  admin_note: string | null;
  lang: string | null;
  updated_at: string;
  items: { id: number; product_id: number | null; name: string; variant_text: string | null; price: number; quantity: number }[];
};

type List = { items: OrderRow[]; total: number; page: number; limit: number; counts: Partial<Record<OrderStatus, number>> };

export const money = (q: number, symbol: string) =>
  `${(q / 100).toLocaleString("az-AZ", { minimumFractionDigits: q % 100 ? 2 : 0, maximumFractionDigits: 2 })} ${symbol}`;

export function when(isoDate: string): string {
  const d = new Date(isoDate);
  const today = new Date();
  const time = d.toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Bu gün, ${time}`;
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Dünən, ${time}`;
  return `${d.toLocaleDateString("az-AZ", { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" })}, ${time}`;
}

export function StatusPill({ s }: { s: OrderStatus }) {
  return <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[0.75rem] font-semibold ${STATUS[s].cls}`}>{STATUS[s].name}</span>;
}

/** One order in a list: number, name, total, time, status. */
export function OrderLine({ o }: { o: OrderRow }) {
  const shop = useShop();
  return (
    <a href={`#/orders/${o.id}`} className="flex items-center gap-3 rounded-[16px] bg-paper-2 px-4 py-3.5 transition-colors hover:bg-paper-3">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{o.customer_name}</span>
          {o.notified === 0 && o.status !== "cancelled" && (
            <span title="Telegram bildirişi getməyib" className="text-[0.75rem] font-semibold text-danger">
              ● bildiriş getməyib
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[0.82rem] text-ink-soft">
          <span className="num">#{o.order_number}</span> · {when(o.created_at)}
          {o.items ? ` · ${o.items} əd.` : ""}
        </span>
      </span>
      <span className="grid shrink-0 justify-items-end gap-1">
        <span className="num font-semibold">{money(o.total, shop.symbol)}</span>
        <StatusPill s={o.status} />
      </span>
    </a>
  );
}

export function Orders() {
  // #/orders?failed opens the "not notified" filter (from the dashboard)
  const [status, setStatus] = useState<OrderStatus | "" | "failed">(() => (window.location.hash.includes("failed") ? "failed" : ""));
  const [q, setQ] = useState("");
  const [list, setList] = useState<List | null>(null);
  const [err, setErr] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const seq = useRef(0);

  const query = (page: number) => {
    const p = new URLSearchParams({ page: String(page), limit: "30" });
    if (status === "failed") p.set("failed", "1");
    else if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    return call<List>("GET", `orders?${p}`);
  };

  useEffect(() => {
    const t = setTimeout(
      () => {
        const n = ++seq.current;
        query(1).then(
          (r) => n === seq.current && (setList(r), setErr("")),
          (e: Error) => n === seq.current && setErr(e.message),
        );
      },
      q ? 300 : 0,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const more = async () => {
    if (!list) return;
    setLoadingMore(true);
    try {
      const r = await query(list.page + 1);
      setList({ ...r, items: [...list.items, ...r.items.filter((x) => !list.items.some((y) => y.id === x.id))] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const counts = list?.counts ?? {};
  const all = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-[46rem] px-4">
      <input
        type="search"
        className="field"
        placeholder="Ad, telefon və ya sifariş nömrəsi"
        aria-label="Sifariş axtar"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Status">
        {(["", ...ORDER] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[0.86rem] font-medium transition-colors ${status === s ? "bg-ink text-paper" : "bg-paper-2 text-ink hover:bg-paper-3"}`}
          >
            {s ? STATUS[s].name : "Hamısı"}
            <span className="num opacity-60">{s ? (counts[s] ?? 0) : all}</span>
          </button>
        ))}
        {status === "failed" && (
          <button type="button" aria-pressed className="inline-flex h-9 shrink-0 items-center rounded-full bg-danger px-3.5 text-[0.86rem] font-medium text-white">
            Bildirişi getməyənlər
          </button>
        )}
      </div>

      {err && (
        <div className="mt-4">
          <Notice>{err}</Notice>
        </div>
      )}
      {!list && !err && (
        <div className="mt-10 grid place-items-center text-ink-soft">
          <Spinner />
        </div>
      )}
      {list && !list.items.length && (
        <p className="mt-10 text-center text-ink-soft">{q || status ? "Belə sifariş tapılmadı." : "Hələ sifariş yoxdur. Yeni sifarişlər burada görünəcək."}</p>
      )}
      {list && !!list.items.length && (
        <div className="mt-4 grid gap-2">
          {list.items.map((o) => (
            <OrderLine key={o.id} o={o} />
          ))}
        </div>
      )}
      {list && list.items.length < list.total && (
        <div className="mt-5 text-center">
          <button className="pill pill-soft" disabled={loadingMore} onClick={more}>
            {loadingMore ? <Spinner /> : `Daha çox (${list.total - list.items.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- one order ---------- */

export function OrderView({ id, onChange }: { id: number; onChange: () => void }) {
  const shop = useShop();
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const st = useAction();
  const nt = useAction();
  const tg = useAction();
  const [tgOk, setTgOk] = useState(false);

  useEffect(() => {
    call<Order>("GET", `orders/${id}`).then(
      (r) => (setO(r), setNote(r.admin_note ?? "")),
      (e: Error) => setErr(e.message),
    );
  }, [id]);

  const setStatus = async (s: OrderStatus) => {
    const r = await st.run(() => call<Order>("PATCH", `orders/${id}`, { status: s }));
    if (r) {
      setO(r);
      onChange();
    }
  };

  const back = () => (window.history.length > 1 ? window.history.back() : go("#/orders"));

  if (err)
    return (
      <div className="mx-auto w-full max-w-[40rem] px-4 pt-6">
        <Notice>{err}</Notice>
      </div>
    );
  if (!o)
    return (
      <div className="grid min-h-[50vh] place-items-center text-ink-soft">
        <Spinner />
      </div>
    );

  const digits = o.customer_phone.replace(/\D/g, "");
  const waText = `Salam, ${o.customer_name}! ${shop.name ? `${shop.name}: ` : ""}#${o.order_number} nömrəli sifarişiniz barədə yazırıq.`;

  return (
    <div className="mx-auto w-full max-w-[40rem] px-4 pb-10 pt-4 md:pt-8">
      <div className="flex items-center gap-2">
        <button type="button" onClick={back} aria-label="Geri" className="grid size-10 place-items-center rounded-full bg-paper-2 hover:bg-paper-3">
          <BackIcon />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="num truncate text-[1.4rem]">#{o.order_number}</h1>
          <p className="text-[0.82rem] text-ink-soft">{when(o.created_at)}</p>
        </div>
        <StatusPill s={o.status} />
      </div>

      {o.notified === 0 && o.status !== "cancelled" && (
        <div className="mt-5 grid gap-2 rounded-[16px] bg-danger/8 p-4">
          <p className="text-[0.9rem] font-medium text-danger">Bu sifariş barədə Telegram bildirişi getməyib.</p>
          <button
            type="button"
            className="pill pill-line h-10 justify-self-start px-4 text-[0.88rem]"
            disabled={tg.busy}
            onClick={async () => {
              if (await tg.run(() => call("POST", `orders/${id}/notify`))) {
                setTgOk(true);
                setO({ ...o, notified: 1 });
                onChange();
              }
            }}
          >
            {tg.busy ? <Spinner /> : "Yenidən göndər"}
          </button>
          {tg.err && <p className="text-[0.85rem] text-danger">{tg.err}</p>}
        </div>
      )}
      {tgOk && (
        <div className="mt-5">
          <Notice tone="ok">Telegram-a göndərildi.</Notice>
        </div>
      )}

      {/* the customer */}
      <section className="mt-5 rounded-[20px] bg-paper-2 p-4 sm:p-5">
        <p className="text-[1.15rem] font-semibold">{o.customer_name}</p>
        <a href={`tel:${o.customer_phone}`} className="num mt-0.5 block text-ink-soft">
          {o.customer_phone}
        </a>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`tel:${o.customer_phone}`} className="pill pill-ink h-11 text-[0.92rem]">
            Zəng et
          </a>
          <a href={`https://wa.me/${digits}?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer" className="pill pill-wa h-11 text-[0.92rem]">
            WhatsApp
          </a>
        </div>
        {(o.address || o.note) && (
          <dl className="mt-4 grid gap-3 text-[0.92rem]">
            {o.address && (
              <div>
                <dt className="text-[0.78rem] font-medium text-ink-soft">Ünvan</dt>
                <dd className="mt-0.5 whitespace-pre-line break-words">{o.address}</dd>
              </div>
            )}
            {o.note && (
              <div>
                <dt className="text-[0.78rem] font-medium text-ink-soft">Müştərinin qeydi</dt>
                <dd className="mt-0.5 whitespace-pre-line break-words">{o.note}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {/* what was ordered */}
      <section className="mt-3 rounded-[20px] bg-paper-2 p-4 sm:p-5">
        <ul className="grid gap-3">
          {o.items.map((it) => (
            <li key={it.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                {it.product_id ? (
                  <a href={`#/products/${it.product_id}`} className="font-medium hover:underline">
                    {it.name}
                  </a>
                ) : (
                  <span className="font-medium">{it.name}</span>
                )}
                <span className="block text-[0.82rem] text-ink-soft">
                  {it.variant_text ? `${it.variant_text} · ` : ""}
                  <span className="num">
                    {it.quantity} × {money(it.price, shop.symbol)}
                  </span>
                </span>
              </span>
              <span className="num shrink-0 font-medium">{money(it.price * it.quantity, shop.symbol)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-ink-line pt-3">
          <span className="font-medium">Cəmi</span>
          <span className="num text-[1.15rem] font-semibold">{money(o.total, shop.symbol)}</span>
        </div>
      </section>

      {/* status */}
      <section className="mt-3 rounded-[20px] bg-paper-2 p-4 sm:p-5">
        <h2 className="text-[1.02rem]">Status</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={o.status === s}
              disabled={st.busy}
              onClick={() => o.status !== s && setStatus(s)}
              className={`h-11 rounded-full text-[0.88rem] font-medium transition-colors ${o.status === s ? (s === "cancelled" ? "bg-danger text-white" : "bg-ink text-paper") : "bg-paper text-ink hover:bg-paper-3"}`}
            >
              {STATUS[s].name}
            </button>
          ))}
        </div>
        {st.err && (
          <div className="mt-3">
            <Notice>{st.err}</Notice>
          </div>
        )}
        <p className="mt-3 text-[0.8rem] text-ink-soft">Ləğv edilən sifarişin məhsulları avtomatik stoka qaytarılır.</p>
      </section>

      {/* owner's note */}
      <section className="mt-3 rounded-[20px] bg-paper-2 p-4 sm:p-5">
        <label htmlFor="admin-note" className="text-[1.02rem] font-[650]">
          Öz qeydiniz
        </label>
        <p className="text-[0.8rem] text-ink-soft">Yalnız siz görürsünüz.</p>
        <textarea
          id="admin-note"
          rows={3}
          maxLength={2000}
          className="field mt-3 bg-paper py-3"
          value={note}
          onChange={(e) => (setNote(e.target.value), setNoteSaved(false))}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            className="pill pill-ink h-10 px-5 text-[0.88rem]"
            disabled={nt.busy || note === (o.admin_note ?? "")}
            onClick={async () => {
              const r = await nt.run(() => call<Order>("PATCH", `orders/${id}`, { admin_note: note }));
              if (r) {
                setO(r);
                setNote(r.admin_note ?? "");
                setNoteSaved(true);
              }
            }}
          >
            {nt.busy ? <Spinner /> : "Saxla"}
          </button>
          {noteSaved && <span className="text-[0.85rem] font-medium text-ok">Saxlanıldı</span>}
          {nt.err && <span className="text-[0.85rem] text-danger">{nt.err}</span>}
        </div>
      </section>
    </div>
  );
}
