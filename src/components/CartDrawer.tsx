"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { lockScroll } from "@/lib/scroll-lock";
import { useQuickView } from "./QuickView";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "motion/react";
import { useSite } from "@/lib/site";
import { useCart, type CartLine } from "@/lib/cart";
import { resolveLines } from "@/lib/order";
import { useProductsById } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { useMedia } from "@/lib/local";
import { Counter } from "./Counter";
import { CartMeter } from "./CartMeter";
import { IconBag, IconClose, IconTrash } from "./Icons";
import { ProductImage } from "./ProductImage";

/**
 * The cart: a bottom sheet on a phone (drag it down to dismiss), a floating
 * panel on wider screens. It rises on a spring and leaves on one.
 */
export function CartDrawer() {
  const { drawerOpen, closeDrawer } = useCart();
  const { t } = useSite();
  const panel = useRef<HTMLDivElement>(null);
  const drag = useDragControls();
  const quick = useQuickView();
  const wide = useMedia("(min-width: 768px)");

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    document.addEventListener("keydown", onKey);
    const unlock = lockScroll();
    requestAnimationFrame(() => panel.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      unlock();
      prev?.focus?.();
    };
  }, [drawerOpen, closeDrawer]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) closeDrawer();
  };

  const hidden = wide ? { x: "105%" } : { y: "100%" };

  return (
    <AnimatePresence>
      {drawerOpen && (
        <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={t.cart.title}>
          <motion.button
            type="button"
            aria-label={t.nav.close}
            onClick={closeDrawer}
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          <motion.div
            ref={panel}
            tabIndex={-1}
            className="sheet outline-none"
            initial={hidden}
            animate={{ x: 0, y: 0 }}
            exit={hidden}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
            drag={wide ? false : "y"}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            onDragEnd={onDragEnd}
          >
            <div className="sheet-grip" onPointerDown={(e) => drag.start(e)} aria-hidden />
            <div className="flex items-center justify-between px-5 pb-2 pt-1 md:pt-5" onPointerDown={(e) => !wide && drag.start(e)}>
              <h2 className="text-[1.6rem]">{t.cart.title}</h2>
              <button type="button" onClick={closeDrawer} className="orb !size-10" aria-label={t.nav.close}>
                <IconClose size={18} />
              </button>
            </div>
            <CartLines
              compact
              onNavigate={() => {
                quick.dismiss();
                closeDrawer();
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Shared by the sheet and the /cart page. */
export function CartLines({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { t, lang, href } = useSite();
  const { lines, setQty, remove, clear, restore, ready } = useCart();
  const { map: products, loading } = useProductsById(lines.map((l) => l.productId));
  const rows = resolveLines(lines, products, lang);
  const [ghost, setGhost] = useState<{ lines: CartLine[]; rows: ReturnType<typeof resolveLines> } | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!ready || loading) return <div className="min-h-40" />;

  const doClear = () => {
    setGhost({ lines, rows });
    clear();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setGhost(null), 6000);
  };
  const undo = () => {
    if (ghost) restore(ghost.lines);
    setGhost(null);
    window.clearTimeout(timer.current);
  };

  if (rows.length === 0 && !ghost)
    return (
      <div className="grid flex-1 place-items-center px-6 py-14 text-center">
        <div className="[animation:rise_.5s_var(--curve)]">
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-ink-faint text-ink">
            <IconBag size={34} />
          </span>
          <p className="mt-5 text-xl font-bold tracking-[-0.03em]">{t.cart.empty}</p>
          <p className="mt-1 text-ink-soft">{t.cart.emptyHint}</p>
          <Link href={href("/catalog/")} onClick={onNavigate} className="pill pill-ink mt-6">
            {t.nav.catalog}
          </Link>
        </div>
      </div>
    );

  return (
    <>
      <div className={`overflow-y-auto overscroll-contain ${compact ? "flex-1 px-5" : ""}`}>
        <div className="rounded-[20px] bg-paper-2 p-4">
          <CartMeter rows={rows} ghost={ghost?.rows ?? null} onClear={doClear} onUndo={undo} />
        </div>
        <motion.ul layoutScroll className="mt-2">
          <AnimatePresence initial={false}>
            {rows.map((r) => {
              const p = products.get(r.productId)!;
              const v = p.variants.find((x) => x.id === r.variantId)!;
              return (
                <motion.li
                  key={`${r.productId}-${r.variantId}`}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                  className="flex gap-3.5 overflow-hidden py-3.5"
                >
                  <Link href={href(`/p/?s=${p.slug}`)} onClick={onNavigate} className="frame frame-thumb !w-[4.6rem] shrink-0">
                    <ProductImage product={p} size="thumb" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold tracking-[-0.02em]">{r.name}</p>
                        <p className="truncate text-[0.8rem] text-ink-soft">{r.variantLabel || p.brand}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(r.productId, r.variantId)}
                        className="-mr-1.5 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:text-danger active:scale-90"
                        aria-label={`${t.cart.remove}: ${r.name}`}
                      >
                        <IconTrash size={17} />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                      <Counter
                        value={r.qty}
                        onChange={(n) => setQty(r.productId, r.variantId, n)}
                        min={1}
                        max={Math.max(1, Math.min(20, v.stock))}
                        cell={28}
                        label={`${t.product.quantity}: ${tr(p.name, lang)}`}
                        lessLabel={t.product.less}
                        moreLabel={t.product.more}
                      />
                      <span className="num font-bold tracking-[-0.02em]">{formatPrice(r.price * r.qty)}</span>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      </div>
      <div className={compact ? "safe-bottom border-t border-ink-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4" : "pt-4"}>
        <p className="text-[0.8rem] text-ink-soft">{t.cart.note}</p>
        <Link
          href={href("/order/")}
          onClick={onNavigate}
          aria-disabled={rows.length === 0}
          className={`pill pill-ink mt-3 w-full ${rows.length === 0 ? "pointer-events-none opacity-40" : ""}`}
        >
          {t.cart.checkout}
          {rows.length > 0 && <span className="num opacity-80">· {formatPrice(rows.reduce((s, r) => s + r.price * r.qty, 0))}</span>}
        </Link>
      </div>
    </>
  );
}
