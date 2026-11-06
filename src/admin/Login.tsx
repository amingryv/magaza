"use client";

import { useState } from "react";
import { call } from "./api";
import { Notice, PasswordField, Screen, Spinner, useAction } from "./ui";

export function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const { busy, err, run } = useAction();

  return (
    <Screen>
      <div className="my-auto">
        <p className="text-[0.88rem] font-medium text-ink-soft">İdarə paneli</p>
        <h1 className="mt-1 text-[2rem]">Xoş gəldiniz</h1>
        <form
          className="mt-8 grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => call("POST", "login", { password }))) onDone();
          }}
        >
          <PasswordField
            label="Şifrə"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && <Notice>{err}</Notice>}
          <button className="pill pill-ink w-full" disabled={busy || !password}>
            {busy ? <Spinner /> : "Daxil ol"}
          </button>
        </form>
        <p className="mt-6 text-[0.85rem] text-ink-soft">
          Şifrəni unutmusunuz? Sahibkar təlimatındakı “Şifrə unudulanda” bölməsinə baxın.
        </p>
      </div>
    </Screen>
  );
}
