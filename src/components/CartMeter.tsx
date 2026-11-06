"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { OrderLine } from "@/lib/order";
import { useSite } from "@/lib/site";
import { Roll, useDirection } from "./Roll";

/* ══ Cart meter ═══════════════════════════════════════════
   The context meter, turned into a cart: one stacked bar, a segment per
   line as wide as its share of the total, each in its own colour. Point at
   a chip or a segment (or tap it on a phone) and that line lights while the
   rest fall back, and the big number rolls to its subtotal.

   "Clear" squeezes the bar — the segments ease to nothing in a wave from
   the first, the room closes up behind them — and the button becomes
   "Undo" for a few seconds. The order is fixed, biggest first, so clearing
   shrinks in place rather than reshuffling. */

const key = (l: OrderLine) => `${l.productId}-${l.variantId}`;

export function CartMeter({
  rows,
  ghost,
  onClear,
  onUndo,
}: {
  rows: OrderLine[];
  /** the lines just cleared, kept so the bar can ease them away and Undo can bring them back */
  ghost: OrderLine[] | null;
  onClear: () => void;
  onUndo: () => void;
}) {
  const { t } = useSite();
  const [hot, setHot] = useState<string | null>(null);
  const [wave, setWave] = useState<"a" | "b" | undefined>();
  const cleared = rows.length === 0 && !!ghost?.length;
  const shown = cleared ? ghost! : rows;
  // biggest first, fixed while the meter lives
  const order = [...shown].sort((a, b) => b.price * b.qty - a.price * a.qty);
  const total = rows.reduce((s, r) => s + r.price * r.qty, 0);
  const hotRow = hot ? rows.find((r) => key(r) === hot) : undefined;
  const target = hotRow ? hotRow.price * hotRow.qty : total;
  const count = rows.reduce((s, r) => s + r.qty, 0);

  const up = useDirection(target);
  const colourOf = (k: string) => `var(--k-${Math.max(0, shown.findIndex((r) => key(r) === k)) % 6})`;

  return (
    <div className="ctx" onPointerLeave={() => setHot(null)}>
      <div className="ctx-head">
        <span className="ctx-title">{t.cart.total}</span>
        <button
          type="button"
          className="ctx-act"
          data-quiet={cleared || undefined}
          onClick={() => {
            setWave((w) => (w === "a" ? "b" : "a"));
            setHot(null);
            if (cleared) onUndo();
            else onClear();
          }}
        >
          {cleared ? t.cart.undo : t.cart.clear}
        </button>
      </div>

      <div className="ctx-figure" aria-live="polite">
        <span className="ctx-num">
          <Roll text={formatPrice(target)} up={up} />
        </span>
        <span className="ctx-of">{hotRow ? hotRow.name : t.cart.items(count)}</span>
      </div>

      <div className="ctx-bar" aria-hidden="true" data-wave={wave}>
        {order.map((r, n) => {
          const k = key(r);
          return (
            <i
              key={k}
              className="ctx-seg"
              data-dim={(hot !== null && k !== hot) || undefined}
              style={
                {
                  "--k": colourOf(k),
                  flexGrow: cleared ? 0.0001 : r.price * r.qty,
                  borderRadius: `${n === 0 ? 7 : 2}px ${n === order.length - 1 && !cleared ? 7 : 2}px ${n === order.length - 1 && !cleared ? 7 : 2}px ${n === 0 ? 7 : 2}px`,
                  "--ctx-wave": `${n * 55}ms`,
                  "--ctx-give": n === 0 ? 0.74 : 0.9,
                } as React.CSSProperties
              }
              onPointerEnter={() => !cleared && setHot(k)}
              onClick={() => !cleared && setHot((h) => (h === k ? null : k))}
            />
          );
        })}
        <i
          className="ctx-seg ctx-seg-room"
          style={{ flexGrow: cleared ? total || 1 : 0.0001, borderRadius: cleared ? 7 : "2px 7px 7px 2px" }}
        />
      </div>

      {!cleared && (
        <div className="ctx-chips">
          {order.map((r) => {
            const k = key(r);
            return (
              <button
                key={k}
                type="button"
                className="ctx-chip"
                data-on={hot === k || undefined}
                onPointerEnter={(e) => e.pointerType === "mouse" && setHot(k)}
                onClick={() => setHot((h) => (h === k ? null : k))}
                onFocus={() => setHot(k)}
                onBlur={() => setHot(null)}
              >
                <i className="ctx-swatch" style={{ "--k": colourOf(k) } as React.CSSProperties} />
                <span>{r.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
