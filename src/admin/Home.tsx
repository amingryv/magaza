"use client";

import { useState } from "react";
import { call } from "./api";
import { Notice, PasswordField, Spinner, useAction } from "./ui";

/** Account section: password change, version, logout. */
export function Account({ version, onLogout }: { version: string; onLogout: () => void }) {
  const out = useAction();
  return (
    <div className="mx-auto w-full max-w-[30rem] px-4">
      <section className="rounded-[20px] bg-paper-2 p-5">
        <h2 className="text-[1.15rem]">Şifrəni dəyiş</h2>
        <PasswordForm />
      </section>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-[0.8rem] text-ink-soft">Versiya {version}</span>
        <button
          className="pill pill-line h-10 px-4 text-[0.88rem]"
          disabled={out.busy}
          onClick={async () => {
            await out.run(() => call("POST", "logout"));
            onLogout();
          }}
        >
          Çıxış
        </button>
      </div>
    </div>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [done, setDone] = useState(false);
  const { busy, err, setErr, run } = useAction();

  return (
    <form
      className="mt-4 grid gap-3.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setDone(false);
        if (next !== repeat) return setErr("Yeni şifrələr eyni deyil");
        if (await run(() => call("POST", "password", { current, password: next }))) {
          setCurrent("");
          setNext("");
          setRepeat("");
          setDone(true);
        }
      }}
    >
      <PasswordField label="Hazırkı şifrə" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <PasswordField label="Yeni şifrə" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      <PasswordField label="Yeni şifrə (təkrar)" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
      {err && <Notice>{err}</Notice>}
      {done && <Notice tone="ok">Şifrə dəyişdi. Digər cihazlarda yenidən daxil olmaq lazım olacaq.</Notice>}
      <button className="pill pill-ink" disabled={busy || !current || !next}>
        {busy ? <Spinner /> : "Şifrəni dəyiş"}
      </button>
    </form>
  );
}
