/** A spring written as a CSS / WAAPI linear() curve, plus its natural duration. */
export function springCurve(k = 240, c = 15) {
  const pts = [0];
  let x = 0;
  let v = 0;
  let t = 0;
  while (t < 3) {
    v += (k * (1 - x) - c * v) / 240;
    x += v / 240;
    t += 1 / 240;
    pts.push(x);
    if (t > 0.15 && Math.abs(1 - x) < 0.002 && Math.abs(v) < 0.03) break;
  }
  const out: string[] = [];
  for (let i = 0; i <= 44; i++) out.push(pts[Math.round((i / 44) * (pts.length - 1))].toFixed(4));
  out[44] = "1";
  return { easing: `linear(${out.join(", ")})`, duration: Math.round(t * 1000) };
}
