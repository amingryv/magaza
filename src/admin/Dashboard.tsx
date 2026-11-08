"use client";

import { useEffect, useState } from "react";
import { call } from "./api";
import { PlusIcon } from "./controls";
import { Notice, Spinner } from "./ui";
import { useShop } from "./Panel";
import { OrderLine, money, type OrderRow } from "./Orders";

type Sum = { n: number; sum: number };
export type Stats = {
  today: Sum;
  week: Sum;
  month: Sum;
  new_orders: number;
  failed_notifications: number;
  telegram_connected: boolean;
  recent: OrderRow[];
};

/** Start of the owner's day, week (Monday) and month, in their own time zone. */
function bounds() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const week = new Date(d);
  week.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const month = new Date(d.getFullYear(), d.getMonth(), 1);
  return new URLSearchParams({ today: d.toISOString(), week: week.toISOString(), month: month.toISOString() });
}

export const loadStats = () => call<Stats>("GET", `stats?${bounds()}`);

export function Dashboard() {
  const shop = useShop();
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    loadStats().then(setS, (e: Error) => setErr(e.message));
  }, []);

  if (err)
    return (
      <div className="mx-auto w-full max-w-[46rem] px-4">
        <Notice>{err}</Notice>
      </div>
    );
  if (!s)
    return (
      <div className="mt-10 grid place-items-center text-ink-soft">
        <Spinner />
      </div>
    );

  const tiles: [string, Sum][] = [
    ["Bu gün", s.today],
    ["Bu həftə", s.week],
    ["Bu ay", s.month],
  ];

  return (
    <div className="mx-auto grid w-full max-w-[46rem] gap-3 px-4">
      {s.failed_notifications > 0 && (
        <a href="#/orders?failed" className="block rounded-[16px] bg-danger/8 px-4 py-3.5 text-[0.92rem] font-medium text-danger">
          {s.failed_notifications} sifariş barədə Telegram bildirişi getməyib. Baxmaq üçün basın →
        </a>
      )}
      {!s.telegram_connected && (
        <a href="#/settings" className="block rounded-[16px] bg-paper-2 px-4 py-3.5 text-[0.92rem]">
          <b>Telegram qoşulmayıb.</b> Yeni sifarişlərdən dərhal xəbər tutmaq üçün Ayarlar bölməsindən qoşun →
        </a>
      )}

      <a href="#/orders" className="flex items-center justify-between gap-3 rounded-[20px] bg-ink px-5 py-4 text-paper">
        <span>
          <span className="block text-[0.85rem] opacity-70">Yeni sifarişlər</span>
          <span className="num block text-[2rem] font-semibold leading-tight">{s.new_orders}</span>
        </span>
        <span className="text-[0.9rem] font-medium">Sifarişlərə bax →</span>
      </a>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map(([label, v]) => (
          <div key={label} className="min-w-0 rounded-[16px] bg-paper-2 p-3 sm:p-4">
            <p className="text-[0.78rem] font-medium text-ink-soft">{label}</p>
            <p className="num mt-1 truncate text-[1.05rem] font-semibold sm:text-[1.2rem]">{money(v.sum, shop.symbol)}</p>
            <p className="num text-[0.78rem] text-ink-soft">{v.n} sifariş</p>
          </div>
        ))}
      </div>

      <a href="#/products/new" className="pill pill-soft">
        <PlusIcon />
        Məhsul əlavə et
      </a>

      <section className="mt-3">
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-[1.08rem]">Son sifarişlər</h2>
          {s.recent.length > 0 && (
            <a href="#/orders" className="text-[0.85rem] font-medium text-ink-soft hover:text-ink">
              Hamısı
            </a>
          )}
        </div>
        {s.recent.length ? (
          <div className="grid gap-2">
            {s.recent.map((o) => (
              <OrderLine key={o.id} o={o} />
            ))}
          </div>
        ) : (
          <p className="rounded-[16px] bg-paper-2 px-4 py-6 text-center text-[0.9rem] text-ink-soft">Hələ sifariş yoxdur.</p>
        )}
      </section>
    </div>
  );
}
