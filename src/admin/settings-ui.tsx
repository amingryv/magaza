"use client";

import { useEffect, useState } from "react";
import { call, type SettingsRes } from "./api";
import { LANG_NAMES } from "./catalog";
import { Notice, Spinner, useAction } from "./ui";

/* Bits shared by the Settings and Appearance sections. */

export type S = Record<string, unknown>;
export type LocalValue = Record<string, string>;

export const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** A setting that is plain text or `{az, ru, en}` → one string per language. */
export function toLocal(v: unknown, main: string): LocalValue {
  if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.entries(v as S).map(([k, x]) => [k, str(x)]));
  return { [main]: str(v) };
}

/** Back to the stored form: plain text when only the main language is filled. */
export function fromLocal(v: LocalValue, main: string): string | LocalValue {
  const filled = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]).filter(([, x]) => x));
  const others = Object.keys(filled).filter((k) => k !== main);
  return others.length ? filled : (filled[main] ?? "");
}

export function useSettings() {
  const [data, setData] = useState<SettingsRes | null>(null);
  const [err, setErr] = useState("");
  const load = () => call<SettingsRes>("GET", "settings").then(setData, (e: Error) => setErr(e.message));
  useEffect(() => {
    void load();
  }, []);
  return { data, err, reload: load };
}

/** A card with its own "Yadda saxla" button; `save` returns the patch to PUT. */
export function SaveCard({
  title,
  lead,
  children,
  patch,
  dirty,
  onSaved,
  check,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
  patch: () => S;
  dirty: boolean;
  onSaved?: () => void;
  check?: () => string | null;
}) {
  const { busy, err, setErr, run } = useAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="rounded-[20px] bg-paper-2 p-4 sm:p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const bad = check?.();
        if (bad) return setErr(bad);
        if (await run(() => call("PUT", "settings", patch()))) {
          setSaved(true);
          onSaved?.();
        }
      }}
    >
      <h2 className="text-[1.08rem]">{title}</h2>
      {lead && <p className="mt-1 text-[0.82rem] text-ink-soft">{lead}</p>}
      <div className="mt-4 grid gap-3.5">{children}</div>
      {err && (
        <div className="mt-4">
          <Notice>{err}</Notice>
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button className="pill pill-ink h-11 px-6 text-[0.9rem]" disabled={busy || !dirty}>
          {busy ? <Spinner /> : "Yadda saxla"}
        </button>
        {saved && !dirty && <span className="text-[0.85rem] font-medium text-ok">Saxlanıldı</span>}
      </div>
    </form>
  );
}

/** Text in the main language, plus the shop's other languages when it has them. */
export function LocalField({
  label,
  value,
  onChange,
  main,
  languages,
  multiline,
  maxLength = 300,
  placeholder,
}: {
  label: string;
  value: LocalValue;
  onChange: (v: LocalValue) => void;
  main: string;
  languages: string[];
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  const others = languages.filter((l) => l !== main);
  const [open, setOpen] = useState(others.some((l) => value[l]));
  const input = (l: string, extra = "") => {
    const props = {
      value: value[l] ?? "",
      maxLength,
      placeholder: l === main ? placeholder : undefined,
      "aria-label": l === main ? label : `${label} (${LANG_NAMES[l] ?? l})`,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [l]: e.target.value }),
    };
    return multiline ? <textarea rows={3} className={`field py-3 ${extra}`} {...props} /> : <input className={`field ${extra}`} {...props} />;
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[0.88rem] font-medium">{label}</span>
        {others.length > 0 && (
          <button type="button" className="text-[0.8rem] font-medium text-ink-soft hover:text-ink" onClick={() => setOpen((o) => !o)}>
            {open ? "Tərcüməni gizlət" : "Tərcümə"}
          </button>
        )}
      </div>
      {input(main)}
      {open &&
        others.map((l) => (
          <div key={l} className="mt-2">
            <span className="mb-1 block text-[0.78rem] text-ink-soft">{LANG_NAMES[l] ?? l} (boş qalsa, əsas dildəki mətn görünür)</span>
            {input(l)}
          </div>
        ))}
    </div>
  );
}

/** Deep-compare for dirty flags. */
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Edited copy of some settings: `dirty` until saved, `commit` makes the current value the new baseline. */
export function useDraft<T>(initial: T) {
  const [v, setV] = useState(initial);
  const [base, setBase] = useState(initial);
  return { v, setV, dirty: !same(v, base), commit: () => setBase(v) };
}
