"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { clamp, springOf, stillness } from "@/lib/spring";
import { IconMinus, IconPlus } from "./Icons";

/* ══ Rolling counter ══════════════════════════════════════
   A quantity between a minus and a plus. Every digit is a strip of
   0–9 behind a window, and changing the number rolls the strips to
   their new digits like an odometer.

   Each column COUNTS, it does not show: its target is the number of
   whole tens, hundreds… in the value, so 9 → 10 moves the ones column
   forward one more step (9 → 0) and the tens forward one, never a strip
   running back through eight digits. A change reaches the ones first and
   each column to the left a little later, so a carry reads as a carry.

   Three ways to change it: press for one step; hold and it repeats,
   faster the longer you hold; or take the number and drag it up or down
   (touch-action: none on the number only, so the page still scrolls). */

type Col = { pos: number; vel: number; target: number; due: number[]; next: number[] };

export function Counter({
  value,
  onChange,
  min = 1,
  max = 20,
  cell = 40,
  bounce = 45,
  stagger = 45,
  blur = 50,
  label,
  lessLabel = "−",
  moreLabel = "+",
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  cell?: number;
  bounce?: number;
  stagger?: number;
  blur?: number;
  label: string;
  lessLabel?: string;
  moreLabel?: string;
}) {
  const places = Math.max(1, String(max).length);
  const strips = useRef<(HTMLSpanElement | null)[]>([]);
  const cols = useRef<Col[]>(
    Array.from({ length: places }, (_, p) => {
      const n = Math.floor(value / 10 ** p);
      return { pos: n, vel: 0, target: n, due: [], next: [] };
    }),
  );
  const raf = useRef(0);
  const knobs = useRef({ bounce, stagger, blur, cell });
  const val = useRef(value);
  const limits = useRef({ min, max, onChange });
  useLayoutEffect(() => {
    knobs.current = { bounce, stagger, blur, cell };
    limits.current = { min, max, onChange };
  });

  const paint = () => {
    cols.current.forEach((c, p) => {
      const el = strips.current[p];
      if (!el) return;
      const m = ((c.pos % 10) + 10) % 10;
      const smear = Math.min(3, Math.abs(c.vel) * 2.4) * (knobs.current.blur / 50);
      el.style.transform = `translateY(${-m * knobs.current.cell}px)`;
      el.style.filter = smear > 0.15 ? `blur(${smear.toFixed(2)}px)` : "";
    });
  };

  const run = () => {
    if (raf.current) return;
    let prev = 0;
    const tick = (t: number) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      const { k, d } = springOf(knobs.current.bounce);
      const now = performance.now();
      let busy = false;
      for (const c of cols.current) {
        while (c.due.length && c.due[0] <= now) {
          c.due.shift();
          c.target = c.next.shift()!;
        }
        if (c.due.length) busy = true;
        const gap = c.target - c.pos;
        if (Math.abs(gap) > 24) c.pos += Math.round((gap - Math.sign(gap) * 24) / 10) * 10;
        c.vel += (c.target - c.pos) * k * dt;
        c.vel *= Math.pow(d, dt);
        c.pos += c.vel * dt;
        if (Math.abs(c.target - c.pos) < 0.004 && Math.abs(c.vel) < 0.004) {
          c.pos = c.target;
          c.vel = 0;
        } else busy = true;
      }
      paint();
      raf.current = busy ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  };

  // The strips follow the value from outside (cart, other tab, clamp to stock).
  useEffect(() => {
    if (value === val.current) return;
    val.current = value;
    const now = performance.now();
    const still = stillness();
    cols.current.forEach((c, p) => {
      const to = Math.floor(value / 10 ** p);
      if (still) {
        c.pos = c.target = to;
        c.vel = 0;
        c.due = [];
        c.next = [];
        return;
      }
      c.due.push(now + p * knobs.current.stagger);
      c.next.push(to);
    });
    if (still) paint();
    else run();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    paint();
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, []);

  const bump = (n: number) => {
    const { min: lo, max: hi, onChange: set } = limits.current;
    const v = clamp(val.current + n, lo, hi);
    if (v !== val.current) set(v);
    else release(); // at a limit the button disables and may never see pointerup
  };

  /* holding a button: ones, then fives after a second and a half */
  const hold = useRef({ t: 0, since: 0 });
  const release = () => {
    clearTimeout(hold.current.t);
    hold.current.t = 0;
  };
  useEffect(() => release, []);
  const press = (dir: 1 | -1) => {
    release();
    bump(dir);
    hold.current.since = performance.now();
    const repeat = () => {
      const held = performance.now() - hold.current.since;
      bump(dir * (held > 1500 ? 5 : 1));
      hold.current.t = window.setTimeout(repeat, held > 900 ? 60 : 110);
    };
    hold.current.t = window.setTimeout(repeat, 420);
  };

  /* taking the number itself */
  const PX = 14;
  const drag = useRef<{ y: number; acc: number; v: number; t: number } | null>(null);
  const fling = useRef(0);
  useEffect(() => () => cancelAnimationFrame(fling.current), []);
  const steps = (acc: number) => {
    const n = acc > 0 ? Math.floor(acc / PX) : Math.ceil(acc / PX);
    if (n) bump(n);
    return acc - n * PX;
  };
  const onDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(fling.current);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    drag.current = { y: e.clientY, acc: 0, v: 0, t: performance.now() };
  };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const now = performance.now();
    const dy = g.y - e.clientY; // up is more
    g.y = e.clientY;
    const dt = Math.max(1, now - g.t);
    g.t = now;
    g.v = g.v * 0.6 + (dy / dt) * 0.4;
    g.acc = steps(g.acc + dy);
  };
  const onUp = (e: React.PointerEvent) => {
    const g = drag.current;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (!g || stillness()) return;
    let v = performance.now() - g.t > 90 ? 0 : g.v * 16.67;
    if (Math.abs(v) < 2) return;
    let acc = g.acc;
    const coast = () => {
      acc = steps(acc + v);
      v *= 0.94;
      if (Math.abs(v) > 0.4) fling.current = requestAnimationFrame(coast);
    };
    fling.current = requestAnimationFrame(coast);
  };

  const shown = Math.max(1, String(value).length);

  return (
    <div className="rct" style={{ "--rct-cell": `${cell}px` } as React.CSSProperties} role="group" aria-label={label}>
      <button
        type="button"
        className="rct-btn"
        aria-label={lessLabel}
        disabled={value <= min}
        onPointerDown={(e) => {
          if (e.button === 0) press(-1);
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            bump(-1);
          }
        }}
      >
        <IconMinus size={Math.round(cell * 0.42)} />
      </button>

      <div
        className="rct-num"
        role="spinbutton"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            bump(1);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            bump(-1);
          }
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {Array.from({ length: places }, (_, i) => {
          const p = places - 1 - i;
          return (
            <span key={p} className="rct-col" data-on={p < shown || undefined}>
              <span className="rct-strip" ref={(el) => void (strips.current[p] = el)}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, j) => (
                  <span key={j}>{d}</span>
                ))}
              </span>
            </span>
          );
        })}
      </div>

      <button
        type="button"
        className="rct-btn"
        aria-label={moreLabel}
        disabled={value >= max}
        onPointerDown={(e) => {
          if (e.button === 0) press(1);
        }}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            bump(1);
          }
        }}
      >
        <IconPlus size={Math.round(cell * 0.42)} />
      </button>
    </div>
  );
}
