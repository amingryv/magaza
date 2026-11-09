"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/lib/catalog-types";
import { clamp, lerp, settled, spring, stepSpring, stillness, type Spring } from "@/lib/spring";
import { lockScroll } from "@/lib/scroll-lock";
import { motion } from "motion/react";
import { ProductDetail } from "./ProductDetail";
import { ProductImage } from "./ProductImage";
import { IconBack } from "./Icons";

/* ══ Quick view: the shared-element flight ════════════════
   (After Moxen "Maqueta".) Tap a card and its photo, title and price do not
   fade: they travel from the card to the detail and grow on the way, while
   the product's colour is born in the card as a circle that opens until it
   covers the screen. When the photo has landed, the controls come in one
   after another, each on its own spring.

   The whole transition hangs on one number, the progress P (0 = card,
   1 = detail), so dragging back from the left edge is not a second
   animation: the photo shrinks toward its card and the circle closes
   exactly at the pace of the finger, and on release a spring finishes the
   job toward whichever side position and speed decided.

   Only transform, opacity and clip-path move. One rAF loop integrates every
   spring at 240 Hz and parks itself when everything is at rest. The phone's
   back button closes it too (a history entry is pushed on open).

   Why it no longer hangs after landing: the detail used to stay untouchable
   (pointer-events: none) until an under-damped spring had settled to
   0.0008, about 0.6 s after the motion looked finished, and landing then
   re-rendered the whole detail through React state. Now P is critically
   damped (no invisible tail), snapped home once within 0.4%, and landing
   only flips attributes on the layer (data-flying, data-live): no render. */

export type FlyFrom = { photo: HTMLElement; name: HTMLElement; price: HTMLElement };
type Ctx = {
  open: (p: Product, from?: FlyFrom) => void;
  /** close at once (before going somewhere else: the cart, another page) */
  dismiss: () => void;
  /** close with the flight back, through history */
  close: () => void;
  isOpen: () => boolean;
};
const QuickCtx = createContext<Ctx | null>(null);

export function useQuickView() {
  const c = useContext(QuickCtx);
  if (!c) throw new Error("useQuickView outside QuickViewProvider");
  return c;
}

type Box = { x: number; y: number; w: number; h: number };
type End = { photo: Box; title: Box; price: Box; rad: number; fsT: number; fsP: number; colT: number[]; colP: number[] };
type Geo = { c: End; h: End; cx: number; cy: number; R: number; flyTitle: boolean; fromCard: boolean };
type Phase = "closed" | "opening" | "open" | "closing" | "dragging";

// the flight's spring: critically damped (c = 2√k), so it lands without an
// overshoot that keeps the page waiting
const K_OPEN = 170;
const C_OPEN = 2 * Math.sqrt(K_OPEN);
const K_CLOSE = 150;
const C_CLOSE = 2 * Math.sqrt(K_CLOSE);

/** The layer's state lives in attributes, so changing it never re-renders the detail. */
function flag(el: HTMLElement | null, name: "data-flying" | "data-live" | "data-dragging", on: boolean) {
  el?.toggleAttribute(name, on);
}

const box = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};
const rgb = (s: string) => (s.match(/[\d.]+/g) || ["0", "0", "0"]).slice(0, 3).map(Number);
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(",")})`;
const fsOf = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
const radOf = (el: Element) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
const colOf = (el: Element) => rgb(getComputedStyle(el).color);
const oneLine = (el: HTMLElement) => {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
  return el.getBoundingClientRect().height < lh * 1.5;
};
const endOf = (photo: Element, title: Element, price: Element): End => ({
  photo: box(photo),
  title: box(title),
  price: box(price),
  rad: radOf(photo),
  fsT: fsOf(title),
  fsP: fsOf(price),
  colT: colOf(title),
  colP: colOf(price),
});

export function QuickViewProvider({ children }: { children: React.ReactNode }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [words, setWords] = useState({ name: "", price: "" });

  const from = useRef<FlyFrom | null>(null);
  const pending = useRef(false);
  const layer = useRef<HTMLDivElement>(null);
  const tint = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fPhoto = useRef<HTMLDivElement>(null);
  const fTitle = useRef<HTMLDivElement>(null);
  const fPrice = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const price = useRef<HTMLParagraphElement>(null);
  const refs = useMemo(() => ({ hero, title, price }), []);

  const P = useRef<Spring>(spring(0, K_OPEN, C_OPEN));
  const E = useRef<Spring[]>([]);
  const ents = useRef<HTMLElement[]>([]);
  const geo = useRef<Geo | null>(null);
  const phase = useRef<Phase>("closed");
  const entered = useRef(false);
  const raf = useRef(0);
  const prev = useRef(0);
  const timers = useRef<number[]>([]);
  const drag = useRef<{ id: number; x0: number; pts: { x: number; t: number }[]; D: number } | null>(null);
  const keyboard = useRef(false);
  const unlock = useRef<null | (() => void)>(null);

  function later(fn: () => void, ms: number) {
    timers.current.push(window.setTimeout(fn, ms));
  }

  /* ── measure both ends ─────────────────────────────────── */
  function measure() {
    if (!hero.current || !title.current || !price.current) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const h = endOf(hero.current, title.current, price.current);
    const f = from.current;
    // no card to fly from: grow out of the lower middle of the screen
    const c: End = f
      ? endOf(f.photo, f.name, f.price)
      : { ...h, photo: { x: W / 2 - h.photo.w * 0.3, y: H * 0.62, w: h.photo.w * 0.6, h: h.photo.h * 0.6 }, rad: 30 };
    const cx = c.photo.x + c.photo.w / 2;
    const cy = c.photo.y + c.photo.h / 2;
    const R = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy)) * 1.04;
    const flyTitle = !!f && oneLine(f.name) && oneLine(title.current);
    geo.current = { c, h, cx, cy, R, flyTitle, fromCard: !!f };
    if (fPhoto.current) {
      fPhoto.current.style.width = `${h.photo.w}px`;
      fPhoto.current.style.height = `${h.photo.h}px`;
    }
    if (fTitle.current) {
      fTitle.current.style.fontSize = `${h.fsT}px`;
      fTitle.current.style.display = flyTitle ? "" : "none";
    }
    if (fPrice.current) fPrice.current.style.fontSize = `${h.fsP}px`;
    // a title that cannot fly (it wraps) comes in with the controls instead
    title.current.classList.toggle("ent", !flyTitle);
    title.current.toggleAttribute("data-shared", flyTitle);
  }

  /* ── paint: everything follows P.x and each control's spring ── */
  function paint() {
    const x = P.current.x;
    const q = clamp(x, 0, 1);
    const g = geo.current;
    if (g && fPhoto.current && tint.current) {
      const { c, h } = g;
      const s = lerp(c.photo.w / h.photo.w, 1, x);
      fPhoto.current.style.transform = `translate3d(${lerp(c.photo.x, h.photo.x, x).toFixed(2)}px,${lerp(c.photo.y, h.photo.y, x).toFixed(2)}px,0) scale(${s.toFixed(4)})`;
      fPhoto.current.style.borderRadius = `${(Math.max(0, lerp(c.rad, h.rad, q)) / s).toFixed(2)}px`;
      fPhoto.current.style.opacity = g.fromCard ? "1" : String(clamp(q * 1.6, 0, 1));
      const cc = clamp((q - 0.08) / 0.3, 0, 1);
      const cs = cc * cc * (3 - 2 * cc);
      if (fTitle.current && g.flyTitle) {
        const st = lerp(c.fsT / h.fsT, 1, x);
        fTitle.current.style.transform = `translate3d(${lerp(c.title.x, h.title.x, x).toFixed(2)}px,${lerp(c.title.y, h.title.y, x).toFixed(2)}px,0) scale(${st.toFixed(4)})`;
        fTitle.current.style.color = mix(c.colT, h.colT, cs);
      }
      if (fPrice.current) {
        const sp = lerp(c.fsP / h.fsP, 1, x);
        fPrice.current.style.transform = `translate3d(${lerp(c.price.x, h.price.x, x).toFixed(2)}px,${lerp(c.price.y, h.price.y, x).toFixed(2)}px,0) scale(${sp.toFixed(4)})`;
        fPrice.current.style.color = mix(c.colP, h.colP, cs);
        fPrice.current.style.opacity = g.fromCard ? "1" : "0";
      }
      tint.current.style.clipPath = `circle(${(g.R * clamp(x / 0.82, 0, 1)).toFixed(1)}px at ${g.cx.toFixed(1)}px ${g.cy.toFixed(1)}px)`;
    }
    ents.current.forEach((el, i) => el.style.setProperty("--e", (E.current[i]?.x ?? 0).toFixed(4)));
  }

  /* ── the one loop ─────────────────────────────────────── */
  function frame(ms: number) {
    raf.current = 0;
    const dt = prev.current ? clamp((ms - prev.current) / 1000, 0.001, 0.04) : 1 / 60;
    prev.current = ms;
    const n = Math.ceil(dt * 240);
    const h = dt / n;
    let moving = false;
    for (const r of [P.current, ...E.current]) {
      if (r.held) continue;
      if (r.x === r.to && r.v === 0) continue;
      for (let i = 0; i < n; i++) stepSpring(r, h);
      if (r === P.current && r.to === 0 && r.x < 0) {
        r.x = 0;
        r.v = 0;
      }
      if (settled(r)) {
        r.x = r.to;
        r.v = 0;
      } else moving = true;
    }
    const p = P.current;
    // close enough to home: snap, so nothing waits for the last fraction of a pixel
    if (!p.held && p.to === 1 && Math.abs(1 - p.x) < 0.004 && Math.abs(p.v) < 0.08) {
      p.x = 1;
      p.v = 0;
    }
    if (phase.current === "opening") {
      if (!entered.current && p.x > 0.7) enter();
      if (p.x === 1 && p.to === 1) arrive();
    } else if (phase.current === "closing" && p.x === 0 && p.to === 0) {
      done();
    }
    paint();
    if (moving || p.held) raf.current = requestAnimationFrame(frame);
    else prev.current = 0;
  }
  function wake() {
    if (!raf.current) {
      prev.current = 0;
      raf.current = requestAnimationFrame(frame);
    }
  }

  function enter() {
    entered.current = true;
    E.current.forEach((r, i) =>
      later(() => {
        r.to = 1;
        wake();
      }, i * 62),
    );
  }

  function arrive() {
    phase.current = "open";
    flag(layer.current, "data-flying", false);
    flag(layer.current, "data-live", true);
    if (!entered.current) enter();
    // the back button takes focus for keyboard users; a tap leaves no ring behind
    const back = layer.current?.querySelector<HTMLElement>("[data-back]");
    (keyboard.current ? back : scroller.current)?.focus({ preventScroll: true });
  }

  function done() {
    phase.current = "closed";
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    const card = from.current?.photo.closest<HTMLElement>(".card, .spot");
    card?.removeAttribute("data-flying");
    unlock.current?.();
    unlock.current = null;
    from.current = null;
    geo.current = null;
    setProduct(null);
    card?.querySelector<HTMLElement>(".card-open")?.focus({ preventScroll: true });
  }

  /* ── open ─────────────────────────────────────────────── */
  function open(p: Product, f?: FlyFrom) {
    if (phase.current !== "closed") return;
    from.current = f ?? null;
    pending.current = true;
    entered.current = false;
    setWords({ name: f?.name.textContent ?? "", price: f?.price.textContent ?? "" });
    setProduct(p);
    try {
      window.history.pushState({ ...(window.history.state ?? {}), qv: p.slug }, "");
    } catch {}
  }

  function animateClose() {
    if (phase.current !== "open" && phase.current !== "opening") return;
    phase.current = "closing";
    flag(layer.current, "data-flying", true);
    flag(layer.current, "data-live", false);
    measure(); // the hero may have scrolled: fly back from where it is now
    E.current.forEach((r) => {
      r.k = 380;
      r.c = 30;
      r.to = 0;
    });
    const p = P.current;
    p.k = K_CLOSE;
    p.c = C_CLOSE;
    p.to = 0;
    if (stillness()) {
      p.x = 0;
      p.v = 0;
      paint();
      done();
    } else wake();
  }

  /** Close through history, so the phone's back button and ours agree. */
  function requestClose() {
    if (window.history.state?.qv) window.history.back();
    else animateClose();
  }

  /** Leave for another page right away (a link inside the detail). */
  function leave() {
    const s = window.history.state;
    if (s?.qv) {
      try {
        const rest = { ...s };
        delete rest.qv;
        window.history.replaceState(rest, "");
      } catch {}
    }
    P.current.x = P.current.to = 0;
    done();
  }

  // the latest handlers, for listeners attached once
  const api = useRef({ animateClose, requestClose, measure, paint });
  useLayoutEffect(() => {
    api.current = { animateClose, requestClose, measure, paint };
  });

  // after the detail is in the DOM: measure both ends and launch
  useLayoutEffect(() => {
    if (!product || !pending.current) return;
    pending.current = false;
    if (scroller.current) scroller.current.scrollTop = 0;
    // lock first: anything that changes the page width must happen before measuring
    unlock.current?.();
    unlock.current = lockScroll();
    measure();
    ents.current = Array.from(layer.current?.querySelectorAll<HTMLElement>(".ent") ?? []);
    E.current = ents.current.map(() => spring(0, 260, 22));
    from.current?.photo.closest(".card, .spot")?.setAttribute("data-flying", "");
    phase.current = "opening";
    const p = P.current;
    p.k = K_OPEN;
    p.c = C_OPEN;
    p.x = 0;
    p.v = 0;
    p.to = 1;
    if (stillness()) {
      p.x = 1;
      E.current.forEach((r) => (r.x = r.to = 1));
      entered.current = true;
      paint();
      arrive();
    } else {
      paint();
      wake();
    }
  }, [product]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Our own history entry: handle it here and stop it, so the Next.js router
    // does not also react to it (it would re-render and nudge the page).
    const onPop = (e: PopStateEvent) => {
      if (phase.current === "open" || phase.current === "opening") {
        e.stopImmediatePropagation();
        api.current.animateClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (phase.current === "open" || phase.current === "opening")) {
        e.preventDefault();
        api.current.requestClose();
      }
    };
    const onResize = () => {
      if (geo.current) {
        api.current.measure();
        api.current.paint();
      }
    };
    const onAnyKey = () => (keyboard.current = true);
    const onAnyPointer = () => (keyboard.current = false);
    document.addEventListener("keydown", onAnyKey, true);
    document.addEventListener("pointerdown", onAnyPointer, true);
    window.addEventListener("popstate", onPop, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onAnyKey, true);
      document.removeEventListener("pointerdown", onAnyPointer, true);
      window.removeEventListener("popstate", onPop, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  /* ── the edge: drag from the left to go back ──────────── */
  function onEdgeDown(e: React.PointerEvent) {
    if (phase.current !== "open" || e.button > 0) return;
    drag.current = { id: e.pointerId, x0: e.clientX, pts: [{ x: e.clientX, t: performance.now() }], D: window.innerWidth * 0.8 };
    e.currentTarget.setPointerCapture(e.pointerId);
    phase.current = "dragging";
    flag(layer.current, "data-dragging", true);
    measure();
    flag(layer.current, "data-flying", true);
    P.current.held = true;
    P.current.v = 0;
    E.current.forEach((r) => {
      r.k = 380;
      r.c = 30;
      r.to = 0;
    });
    wake();
    e.preventDefault();
  }
  function onEdgeMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    P.current.x = dx >= 0 ? 1 - dx / d.D : 1 + (-dx / d.D) * 0.1;
    d.pts.push({ x: e.clientX, t: performance.now() });
    if (d.pts.length > 8) d.pts.shift();
    if (bubble.current) {
      const b = clamp(dx, 0, 140);
      bubble.current.style.opacity = clamp(dx / 26, 0, 1).toFixed(3);
      bubble.current.style.transform = `translate3d(${(46 + Math.min(b * 0.5, 52)).toFixed(1)}px,0,0) scale(${(0.7 + 0.3 * clamp(dx / 70, 0, 1)).toFixed(3)})`;
    }
    paint();
  }
  function onEdgeUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const a = d.pts[0];
    const b = d.pts[d.pts.length - 1];
    const vx = b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0; // px/s
    const shut = vx > 520 ? true : vx < -520 ? false : P.current.x < 0.62;
    drag.current = null;
    P.current.held = false;
    flag(layer.current, "data-dragging", false);
    if (bubble.current) {
      bubble.current.style.opacity = "0";
      bubble.current.style.transform = "";
    }
    P.current.v = -vx / d.D;
    if (shut) {
      phase.current = "open";
      requestClose();
      P.current.v = Math.min(0, P.current.v);
    } else {
      phase.current = "opening";
      entered.current = true;
      const p = P.current;
      p.k = K_OPEN;
      p.c = C_OPEN;
      p.to = 1;
      p.v = Math.max(0, p.v);
      E.current.forEach((r, i) => {
        r.k = 260;
        r.c = 22;
        later(() => {
          r.to = 1;
          wake();
        }, 120 + i * 50);
      });
    }
    wake();
  }

  const isOpen = () => phase.current !== "closed";
  const dismiss = () => {
    if (phase.current !== "closed") leave();
  };
  const ctx = useRef({ open, dismiss, requestClose, isOpen });
  useLayoutEffect(() => {
    ctx.current = { open, dismiss, requestClose, isOpen };
  });
  const value = useMemo<Ctx>(
    () => ({
      open: (p, f) => ctx.current.open(p, f),
      dismiss: () => ctx.current.dismiss(),
      close: () => ctx.current.requestClose(),
      isOpen: () => ctx.current.isOpen(),
    }),
    [],
  );

  return (
    <QuickCtx.Provider value={value}>
      {children}
      {product && (
        <div ref={layer} className="qv fixed inset-0 z-[60]" data-tone="" data-flying="" role="dialog" aria-modal="true" aria-label={product.slug}>
          {/* the colour, opening as a circle from the card */}
          <div
            ref={tint}
            className="absolute inset-0"
            style={{
              clipPath: "circle(0px at 50% 50%)",
              background: "var(--t)",
            }}
          >
          </div>

          <motion.div
            layoutScroll
            ref={scroller}
            tabIndex={-1}
            className="qv-scroller absolute inset-0 overflow-y-auto overscroll-contain outline-none"
          >
            <div className="mx-auto w-full max-w-[64rem] px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:px-9 md:pb-12 md:pt-8">
              <ProductDetail key={product.id} product={product} refs={refs} onBack={requestClose} onLeave={leave} mode="overlay" />
            </div>
          </motion.div>

          {/* the shared pieces in flight */}
          <div className="qv-flight pointer-events-none absolute inset-0" aria-hidden>
            <div ref={fPhoto} className="frame !absolute left-0 top-0 origin-top-left !transition-none">
              <ProductImage product={product} priority />
            </div>
            <div ref={fTitle} className="absolute left-0 top-0 origin-top-left whitespace-nowrap font-bold tracking-[-0.03em] [line-height:1.12]">
              {words.name}
            </div>
            <div ref={fPrice} className="num absolute left-0 top-0 origin-top-left whitespace-nowrap font-bold tracking-[-0.03em] [line-height:1.15]">
              {words.price}
            </div>
          </div>

          {/* the edge you drag to go back */}
          <div
            className="qv-edge absolute bottom-24 left-0 top-24 z-[2] w-4 touch-none"
            onPointerDown={onEdgeDown}
            onPointerMove={onEdgeMove}
            onPointerUp={onEdgeUp}
            onPointerCancel={onEdgeUp}
            aria-hidden
          >
            <span
              ref={bubble}
              className="absolute left-0 top-1/2 -ml-[46px] -mt-[23px] grid size-[46px] place-items-center rounded-full bg-[var(--t-ink)] text-[var(--t)] opacity-0"
            >
              <IconBack />
            </span>
          </div>
        </div>
      )}
    </QuickCtx.Provider>
  );
}
