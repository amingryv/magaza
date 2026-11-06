"use client";

import { useId, useState } from "react";

/** Phone-first page frame: one narrow column, generous side gutter. */
export function Screen({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col px-4 pb-8 pt-6 md:pt-14">{children}</main>;
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[0.88rem] font-medium">{label}</span>
      <input id={id} className="field" {...input} />
      {hint && <span className="mt-1.5 block text-[0.8rem] text-ink-soft">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, ...input }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[0.88rem] font-medium">{label}</span>
      <textarea id={id} rows={3} className="field py-3" {...input} />
    </label>
  );
}

export function PasswordField({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const id = useId();
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[0.88rem] font-medium">{label}</span>
      <span className="relative block">
        <input id={id} type={show ? "text" : "password"} className="field pr-20" {...input} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-1.5 my-auto h-9 rounded-full px-3 text-[0.82rem] font-medium text-ink-soft"
        >
          {show ? "Gizlət" : "Göstər"}
        </button>
      </span>
    </label>
  );
}

export function Notice({ tone = "error", children }: { tone?: "error" | "ok" | "info"; children: React.ReactNode }) {
  const c = tone === "error" ? "text-danger bg-danger/8" : tone === "ok" ? "text-ok bg-ok/8" : "text-ink bg-paper-2";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-[14px] px-4 py-3 text-[0.9rem] font-medium ${c}`}>
      {children}
    </p>
  );
}

export function Spinner() {
  return (
    <span
      aria-label="Yüklənir"
      className="inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent align-middle"
    />
  );
}

/** Runs an async action with a busy flag and a readable error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setErr("");
    try {
      return await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Xəta baş verdi");
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, setErr, run };
}
