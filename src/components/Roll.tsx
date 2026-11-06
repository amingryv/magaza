"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatPrice } from "@/lib/format";

/* ══ Roll ═════════════════════════════════════════════════
   From the context meter: a digit that changes rises a hair out of a
   2px blur and lands a touch past its mark, left to right 70ms apart —
   from below when the figure grows, from above when it shrinks. Every
   digit is keyed by its place (counted from the right) and its value,
   so one that did not change never moves. */
export function Roll({ text, up = true, className }: { text: string; up?: boolean; className?: string }) {
  const chars = [...text];
  return (
    <span className={`ctx-roll ${className ?? ""}`}>
      <span className="ctx-sr">{text}</span>
      <span aria-hidden="true" className="contents">
        {chars.map((c, i) => {
          const place = chars.length - 1 - i;
          if (!/[0-9]/.test(c))
            return (
              <span key={`s${place}`} className="ctx-sym">
                {c}
              </span>
            );
          return (
            <span key={`p${place}`} className="ctx-wheel">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={c}
                  className="ctx-digit"
                  initial={{ y: up ? "0.22em" : "-0.22em", opacity: 0, filter: "blur(2px)" }}
                  animate={{ y: "0em", opacity: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, filter: "blur(2px)", transition: { duration: 0.16 } }}
                  transition={{ duration: 0.5, ease: [0.34, 1.45, 0.64, 1], delay: i * 0.05 }}
                >
                  {c}
                </motion.span>
              </AnimatePresence>
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** A price that rolls toward its new value, up or down. */
export function RollPrice({ value, className }: { value: number; className?: string }) {
  const up = useDirection(value);
  return <Roll text={formatPrice(value)} up={up} className={className} />;
}

/** Which way a number last moved (the previous value is kept as state, the React way). */
export function useDirection(value: number) {
  const [prev, setPrev] = useState(value);
  const [up, setUp] = useState(true);
  if (value !== prev) {
    setPrev(value);
    setUp(value > prev);
  }
  return up;
}
