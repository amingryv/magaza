import { normalizeSearch } from "@/shared/text";
import type { AdminAttribute } from "./catalog";

/*
 * Products ⇄ spreadsheet. ";" separated with a BOM, which is what Excel opens
 * correctly with Azerbaijani/Russian regional settings; reading accepts
 * ";", "," or tab. Money is written in manat ("12.50"), sent to the API in qəpik.
 */

const FIELDS = [
  ["name", "Ad"],
  ["sku", "Kod"],
  ["price", "Qiymət"],
  ["old_price", "Köhnə qiymət"],
  ["stock", "Stok"],
  ["category", "Kateqoriya"],
  ["description", "Təsvir"],
  ["is_active", "Aktiv"],
  ["is_featured", "Seçilmiş"],
  ["slug", "Link"],
] as const;
type Field = (typeof FIELDS)[number][0];

/** Attributes that live in the sheet (variant ones are edited per product). */
const sheetAttrs = (attrs: AdminAttribute[]) => attrs.filter((a) => !a.is_variant);
const attrHeader = (a: AdminAttribute, all: AdminAttribute[]) =>
  all.filter((b) => normalizeSearch(b.name) === normalizeSearch(a.name)).length > 1 ? `${a.name} (${a.key})` : a.name;

export function headers(attrs: AdminAttribute[]): string[] {
  const list = sheetAttrs(attrs);
  return [...FIELDS.map((f) => f[1]), ...list.map((a) => attrHeader(a, list))];
}

/* ── writing ─────────────────────────────────────────────── */

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";

export function download(text: string | Blob, name: string, type = "text/csv;charset=utf-8") {
  const blob = typeof text === "string" ? new Blob([text], { type }) : text;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const manat = (q: unknown) => (typeof q === "number" ? (q / 100).toFixed(2) : "");
const yesNo = (b: unknown) => (b ? "bəli" : "xeyr");

function attrCell(a: AdminAttribute, v: unknown): string {
  if (v == null) return "";
  if (a.type === "boolean") return yesNo(v);
  if (Array.isArray(v)) return v.join(" | ");
  return String(v);
}

export type ExportRow = {
  name: string; slug: string; sku: string | null; price: number; old_price: number | null; stock: number | null; description: string | null;
  category: string | null; is_active: boolean; is_featured: boolean; variants: number; attributes: Record<string, unknown>;
};

export function productsCsv(items: ExportRow[], attrs: AdminAttribute[]): string {
  const list = sheetAttrs(attrs);
  return toCsv([
    headers(attrs),
    ...items.map((p) => [
      p.name, p.sku ?? "", manat(p.price), manat(p.old_price), p.variants ? "" : (p.stock ?? ""), p.category ?? "", p.description ?? "",
      yesNo(p.is_active), yesNo(p.is_featured), p.slug, ...list.map((a) => attrCell(a, p.attributes[a.key])),
    ]),
  ]);
}

export function templateCsv(attrs: AdminAttribute[]): string {
  const list = sheetAttrs(attrs);
  return toCsv([
    headers(attrs),
    ["Pambıq köynək", "KY-001", "25.00", "30.00", "10", "Geyim", "Yumşaq pambıq parça", "bəli", "xeyr", "", ...list.map(() => "")],
    ["Dəri kəmər", "KM-002", "15.50", "", "", "Aksesuar", "", "bəli", "xeyr", "", ...list.map(() => "")],
  ]);
}

/* ── reading ─────────────────────────────────────────────── */

export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const nl = text.search(/\r?\n/);
  const first = nl < 0 ? text : text.slice(0, nl);
  const count = (ch: string) => first.split(ch).length - 1;
  const sep = [";", ",", "\t"].sort((a, b) => count(b) - count(a))[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && !cur) quoted = true;
    else if (ch === sep) {
      row.push(cur);
      cur = "";
    }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

export type ImportRow = Partial<Record<Field, unknown>> & { line: number; attributes?: Record<string, unknown> };
export type Parsed = { rows: ImportRow[]; known: string[]; unknown: string[]; errors: { line: number; error: string }[] };

function money(s: string): number | null | "bad" {
  let t = s.replace(/[\s ₼]|AZN|man/gi, "").replace(/,/g, ".");
  if (!t) return null;
  const dots = t.split(".");
  if (dots.length > 2) t = dots.slice(0, -1).join("") + "." + dots.at(-1);
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : "bad";
}
const yes = (s: string) => /^(1|true|bəli|beli|hə|he|yes|да|var|aktiv)$/i.test(s.trim());

/** Rows → API rows. A column absent from the file leaves that field alone. */
export function readSheet(text: string, attrs: AdminAttribute[]): Parsed {
  const all = parseCsv(text);
  const head = all.findIndex((r) => r.some((c) => c.trim()));
  if (head < 0) return { rows: [], known: [], unknown: [], errors: [] };
  const header = all[head];
  const list = sheetAttrs(attrs);
  const key = (s: string) => normalizeSearch(s);
  const map: (null | { field: Field } | { attr: AdminAttribute })[] = header.map((h) => {
    const k = key(h);
    const f = FIELDS.find(([id, label]) => key(label) === k || id === h.trim());
    if (f) return { field: f[0] };
    const a = list.find((x) => key(attrHeader(x, list)) === k || key(x.name) === k || x.key === h.trim());
    return a ? { attr: a } : null;
  });
  const known = header.filter((_, i) => map[i]);
  const unknown = header.filter((h, i) => !map[i] && h.trim());

  const rows: ImportRow[] = [];
  const errors: Parsed["errors"] = [];
  // rows keep their spreadsheet row number for error messages
  for (let n = head + 1; n < all.length; n++) {
    const r = all[n];
    const line = n + 1;
    if (!r.some((c) => c.trim())) continue;
    const out: ImportRow = { line };
    let bad = "";
    r.forEach((raw, i) => {
      const m = map[i];
      if (!m) return;
      const v = raw.trim();
      if ("attr" in m) {
        (out.attributes ??= {})[m.attr.key] = v || null;
        return;
      }
      switch (m.field) {
        case "price":
        case "old_price": {
          const q = money(v);
          if (q === "bad") bad = `«${v}» qiymət deyil`;
          else out[m.field] = q;
          break;
        }
        case "stock": {
          const n = v ? Number(v.replace(/\s/g, "")) : null;
          if (n !== null && !(Number.isInteger(n) && n >= 0)) bad = `«${v}» stok sayı deyil`;
          else out.stock = n;
          break;
        }
        case "is_active":
        case "is_featured":
          if (v) out[m.field] = yes(v);
          break;
        default:
          out[m.field] = v;
      }
    });
    if (bad) errors.push({ line, error: bad });
    else rows.push(out);
  }
  return { rows, known, unknown, errors };
}
