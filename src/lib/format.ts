// a no-break space every font has a glyph for (some lack U+202F)
const NNBSP = " ";

let symbol = "₼";

/** Set from the shop's settings by SiteProvider. */
export function setCurrency(s: string) {
  symbol = s || "₼";
}

/**
 * Integer qəpik → "2 399 ₼", or "12,50 ₼" when there are qəpik
 * (no-break spaces, so a price never wraps).
 */
export function formatPrice(qepik: number): string {
  const n = Math.round(qepik);
  const whole = Math.trunc(n / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  const cents = Math.abs(n % 100);
  return `${whole}${cents ? `,${String(cents).padStart(2, "0")}` : ""}${NNBSP}${symbol}`;
}

/** Keeps digits only, max 9 (Azerbaijani mobile without +994). */
export function cleanPhone(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("994")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 9);
}

/** "501234567" → "50 123 45 67" */
export function prettyPhone(d: string): string {
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(" ");
}
