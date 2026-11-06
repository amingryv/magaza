"use client";

import { useEffect, useRef, useState } from "react";
import { springCurve } from "./spring-curve";

export { springCurve };

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ── one spring, for everything that settles ───────────────
   0..100 into stiffness and per-frame decay, chosen by damping
   ratio: 0 heavy and still arriving, 50 the house tuning, 100
   lively with two visible rebounds. Frames, not milliseconds:
   the decay is raised to dt, so a dropped frame on a busy phone
   loses the same energy as the two frames it replaced. */
export const springOf = (tune: number) => ({
  k: 0.08 + (tune / 100) * 0.16,
  d: 0.62 + (tune / 100) * 0.2,
});

/** A preference, read once. */
export const stillness = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A number that springs toward its target; parks its loop once settled. */
export function useSpring(target: number, tune = 50, instant = false) {
  const [at, setAt] = useState(target);
  const cur = useRef(target);
  const vel = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (instant) {
      cur.current = target;
      vel.current = 0;
      raf.current = requestAnimationFrame(() => setAt(target));
      return () => cancelAnimationFrame(raf.current);
    }
    const { k, d } = springOf(tune);
    let prev = 0;
    const tick = (t: number) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      vel.current += (target - cur.current) * k * dt;
      vel.current *= Math.pow(d, dt);
      cur.current += vel.current * dt;
      if (Math.abs(target - cur.current) < 0.02 && Math.abs(vel.current) < 0.02) {
        cur.current = target;
        vel.current = 0;
        setAt(target);
        raf.current = 0;
        return;
      }
      setAt(cur.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [target, tune, instant]);

  return at;
}

/* ── a physical spring (stiffness k, damping c), stepped at 240 Hz ── */
export type Spring = { x: number; v: number; to: number; k: number; c: number; held?: boolean };
export const spring = (x: number, k: number, c: number): Spring => ({ x, v: 0, to: x, k, c });
export function stepSpring(r: Spring, h: number) {
  r.v += (r.k * (r.to - r.x) - r.c * r.v) * h;
  r.x += r.v * h;
}
export const settled = (r: Spring) => Math.abs(r.v) < 0.02 && Math.abs(r.to - r.x) < 0.0008;

export const POP = springCurve(240, 15);
export const CURVE = "cubic-bezier(.22, 1, .36, 1)";

/** Seeded random: sparks fall the same way every time. */
export function seeded(s: number) {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small spring "jump" on any element (bag, badge, heart). */
export function jump(el: Element | null | undefined, peak = 1.22) {
  if (!el || stillness()) return;
  (el as HTMLElement).animate(
    [{ transform: "scale(1)" }, { transform: `scale(${peak})`, offset: 0.3 }, { transform: "scale(1)" }],
    { duration: POP.duration, easing: POP.easing },
  );
}

let sparkRun = 0;
/** Confetti from the centre of `host` (an element holding an empty .sparks span). */
export function sparks(host: HTMLElement | null, count = 14) {
  if (!host || stillness()) return;
  host.textContent = "";
  const rnd = seeded(11 * 31 + ++sparkRun);
  for (let i = 0; i < count; i++) {
    const d = document.createElement("i");
    const a = (i / count) * Math.PI * 2 + rnd() * 0.5;
    const r = 70 + rnd() * 90;
    const spin = Math.round((rnd() - 0.5) * 360);
    host.appendChild(d);
    d.animate(
      [
        { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(${(Math.cos(a) * r).toFixed(1)}px,${(Math.sin(a) * r * 0.62 - 10).toFixed(1)}px) scale(.5) rotate(${spin}deg)`,
          opacity: 0,
        },
      ],
      { duration: 560 + rnd() * 260, easing: CURVE, fill: "forwards" },
    );
  }
}
