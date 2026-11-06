import { DICTS, tr, type Lang } from "./i18n";
import type { Product } from "./catalog-types";
import { formatPrice, prettyPhone } from "./format";
import type { CartLine } from "./cart";
import type { OrderError, OrderRequest, OrderResponse } from "@/shared/api-types";

export type OrderLine = {
  productId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  qty: number;
  price: number;
};

export type Order = {
  number: string;
  createdAt: string;
  lang: Lang;
  customer: { name: string; phone: string; address?: string; note: string };
  lines: OrderLine[];
  total: number;
};

/** Resolves cart lines against the loaded products; drops lines whose product is gone. */
export function resolveLines(cart: CartLine[], products: Map<string, Product>, lang: Lang): OrderLine[] {
  const out: OrderLine[] = [];
  for (const l of cart) {
    const p = products.get(l.productId);
    const v = p?.variants.find((x) => x.id === l.variantId);
    if (!p || !v) continue;
    const variantLabel = p.options
      .map((o) => tr(o.values.find((x) => x.id === v.values[o.id])?.name, lang))
      .filter(Boolean)
      .join(" · ");
    out.push({ productId: p.id, variantId: v.id, name: tr(p.name, lang), variantLabel, qty: l.qty, price: v.price });
  }
  return out;
}

export function whatsappText(o: Order): string {
  const t = DICTS[o.lang].wa;
  const rows = o.lines.map((l, i) => {
    const label = l.variantLabel ? `${l.name} (${l.variantLabel})` : l.name;
    return `${i + 1}. ${label} — ${l.qty} ${t.pcs} × ${formatPrice(l.price)}`;
  });
  const lines = [
    `${t.hello} #${o.number}`,
    "",
    ...rows,
    "",
    `${t.total}: ${formatPrice(o.total)}`,
    `${t.name}: ${o.customer.name}`,
    `${t.phone}: +994 ${prettyPhone(o.customer.phone)}`,
  ];
  if (o.customer.address?.trim()) lines.push(`📍 ${o.customer.address.trim()}`);
  if (o.customer.note.trim()) lines.push(`${t.note}: ${o.customer.note.trim()}`);
  return lines.join("\n");
}

/** `number`: digits only, from the shop's settings (store.whatsapp). */
export function whatsappLink(text: string, number: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

const KEY = "orders-v1";

/** Keeps the shopper's last orders on this device, so the sent page can show the total and the WhatsApp button. */
export function saveOrder(o: Order) {
  try {
    const list: Order[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    list.unshift(o);
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
}

export function loadOrder(number: string | null): Order | undefined {
  if (!number) return;
  try {
    const list: Order[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    return list.find((o) => o.number === number);
  } catch {
    return;
  }
}

export type SubmitResult = { ok: true; order: OrderResponse } | { ok: false; error: OrderError | "network"; minAmount?: number };

/** POST /api/orders. Only ids, quantities and the form go up; the server prices the order. */
export async function submitOrder(body: OrderRequest): Promise<SubmitResult> {
  try {
    const r = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, order: data as OrderResponse };
    return { ok: false, error: (data as { error?: OrderError }).error ?? "network", minAmount: (data as { min_amount?: number }).min_amount };
  } catch {
    return { ok: false, error: "network" };
  }
}
