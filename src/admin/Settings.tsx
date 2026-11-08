"use client";

import { useState } from "react";
import { call, type SettingsRes } from "./api";
import { fromMoney, toMoney } from "./catalog";
import { Chip, Toggle } from "./controls";
import { Field, Notice, Spinner, TextArea, useAction } from "./ui";
import { LANGS, TelegramConnect } from "./Setup";
import { LocalField, SaveCard, fromLocal, str, toLocal, useDraft, useSettings, type S } from "./settings-ui";
import type { FormField } from "@/shared/api-types";

/* Settings: shop, contact, orders, notifications, SEO. Each card saves on its own. */

export function Settings({ onSaved }: { onSaved: () => void }) {
  const { data, err, reload } = useSettings();
  if (err) return <Wrap><Notice>{err}</Notice></Wrap>;
  if (!data)
    return (
      <div className="mt-10 grid place-items-center text-ink-soft">
        <Spinner />
      </div>
    );
  const s = data.settings;
  const main = str(s["store.language"]) || "az";
  const langs = Array.isArray(s["store.languages"]) ? (s["store.languages"] as string[]) : [main];
  const done = () => (void reload(), onSaved());
  return (
    <Wrap>
      <StoreCard s={s} main={main} langs={langs} onSaved={done} />
      <ContactCard s={s} main={main} langs={langs} />
      <OrdersCard s={s} main={main} langs={langs} />
      <NotifyCard data={data} />
      <SeoCard s={s} />
    </Wrap>
  );
}

const Wrap = ({ children }: { children: React.ReactNode }) => <div className="mx-auto grid w-full max-w-[40rem] gap-3 px-4">{children}</div>;

type CardProps = { s: S; main: string; langs: string[]; onSaved?: () => void };

/* ---------- shop ---------- */

function StoreCard({ s, main, langs, onSaved }: CardProps) {
  const d = useDraft({
    name: str(s["store.name"]),
    description: toLocal(s["store.description"], main),
    main,
    languages: langs.includes(main) ? langs : [main, ...langs],
    currency: str(s["store.currency"]) || "AZN",
    symbol: str(s["store.currency_symbol"]) || "₼",
  });
  const v = d.v;
  const set = (p: Partial<typeof v>) => d.setV({ ...v, ...p });
  const toggleLang = (l: string) =>
    set({ languages: v.languages.includes(l) ? v.languages.filter((x) => x !== l) : LANGS.map((x) => x.v).filter((x) => x === l || v.languages.includes(x)) });

  return (
    <SaveCard
      title="Mağaza"
      dirty={d.dirty}
      check={() => (!v.name.trim() ? "Mağazanın adını yazın" : !v.symbol.trim() ? "Valyuta işarəsini yazın" : null)}
      patch={() => ({
        "store.name": v.name.trim(),
        "store.description": fromLocal(v.description, v.main),
        "store.language": v.main,
        "store.languages": v.languages.includes(v.main) ? v.languages : [v.main, ...v.languages],
        "store.currency": v.currency.trim().toUpperCase(),
        "store.currency_symbol": v.symbol.trim(),
      })}
      onSaved={() => (d.commit(), onSaved?.())}
    >
      <Field label="Mağazanın adı" value={v.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
      <LocalField label="Qısa təsvir" multiline value={v.description} onChange={(x) => set({ description: x })} main={main} languages={v.languages} />
      <fieldset>
        <legend className="mb-1.5 text-[0.88rem] font-medium">Əsas dil</legend>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <Chip key={l.v} on={v.main === l.v} onClick={() => set({ main: l.v, languages: v.languages.includes(l.v) ? v.languages : [...v.languages, l.v] })}>
              {l.l}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-[0.88rem] font-medium">Saytda göstərilən dillər</legend>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <Chip key={l.v} on={v.languages.includes(l.v) || l.v === v.main} onClick={() => l.v !== v.main && toggleLang(l.v)}>
              {l.l}
            </Chip>
          ))}
        </div>
        <p className="mt-1.5 text-[0.8rem] text-ink-soft">Müştəri bu dillər arasında seçim edə bilər. Əsas dil həmişə var.</p>
      </fieldset>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Valyuta kodu" value={v.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value })} />
        <Field label="Valyuta işarəsi" value={v.symbol} maxLength={4} onChange={(e) => set({ symbol: e.target.value })} />
      </div>
    </SaveCard>
  );
}

/* ---------- contact ---------- */

const CONTACT = [
  ["phone", "Telefon", "+994 50 123 45 67"],
  ["whatsapp", "WhatsApp nömrəsi", "Boş qalsa, telefon nömrəsi"],
  ["email", "E-poçt", ""],
  ["instagram", "Instagram", "https://instagram.com/..."],
  ["facebook", "Facebook", "https://facebook.com/..."],
  ["tiktok", "TikTok", "https://tiktok.com/@..."],
  ["map_url", "Xəritə linki", "Google Maps linki"],
] as const;

function ContactCard({ s, main, langs }: CardProps) {
  const d = useDraft({
    ...(Object.fromEntries(CONTACT.map(([k]) => [k, str(s[`contact.${k}`])])) as Record<(typeof CONTACT)[number][0], string>),
    address: toLocal(s["contact.address"], main),
    hours: toLocal(s["contact.hours"], main),
  });
  const v = d.v;
  return (
    <SaveCard
      title="Əlaqə"
      lead="Saytda göstərilir. Boş qalan sahələr görünmür."
      dirty={d.dirty}
      check={() => {
        const wa = (v.whatsapp || v.phone).replace(/\D/g, "");
        if (v.whatsapp && wa.length < 9) return "WhatsApp nömrəsi düzgün deyil";
        for (const k of ["instagram", "facebook", "tiktok", "map_url"] as const)
          if (v[k].trim() && !/^https?:\/\//.test(v[k].trim())) return "Linklər https:// ilə başlamalıdır";
        return null;
      }}
      patch={() => ({
        ...Object.fromEntries(CONTACT.map(([k]) => [`contact.${k}`, v[k].trim()])),
        "contact.whatsapp": (v.whatsapp || v.phone).replace(/\D/g, ""),
        "contact.address": fromLocal(v.address, main),
        "contact.hours": fromLocal(v.hours, main),
      })}
      onSaved={d.commit}
    >
      {CONTACT.map(([k, label, ph]) => (
        <Field
          key={k}
          label={label}
          placeholder={ph}
          type={k === "email" ? "email" : k === "phone" || k === "whatsapp" ? "tel" : "url"}
          value={v[k]}
          onChange={(e) => d.setV({ ...v, [k]: e.target.value })}
        />
      ))}
      <LocalField label="Ünvan" value={v.address} onChange={(x) => d.setV({ ...v, address: x })} main={main} languages={langs} />
      <LocalField label="İş saatları" placeholder="Hər gün 10:00–20:00" value={v.hours} onChange={(x) => d.setV({ ...v, hours: x })} main={main} languages={langs} />
    </SaveCard>
  );
}

/* ---------- orders ---------- */

const FIELD_NAMES: Record<string, string> = { address: "Ünvan", note: "Qeyd" };

function OrdersCard({ s, main, langs }: CardProps) {
  const fields = (Array.isArray(s["orders.form_fields"]) ? (s["orders.form_fields"] as FormField[]) : []).filter((f) => f.key in FIELD_NAMES);
  const d = useDraft({
    enabled: s["orders.enabled"] !== false,
    min: toMoney(Number(s["orders.min_amount"]) || 0),
    note: toLocal(s["orders.delivery_note"], main),
    fields: Object.keys(FIELD_NAMES).map((k) => fields.find((f) => f.key === k) ?? { key: k, visible: true, required: false }),
  });
  const v = d.v;
  const setField = (key: string, p: Partial<FormField>) =>
    d.setV({ ...v, fields: v.fields.map((f) => (f.key === key ? { ...f, ...p, ...(p.visible === false ? { required: false } : {}) } : f)) });

  return (
    <SaveCard
      title="Sifarişlər"
      dirty={d.dirty}
      check={() => (v.min.trim() && fromMoney(v.min) === null ? "Minimum məbləğ düzgün deyil" : null)}
      patch={() => ({
        "orders.enabled": v.enabled,
        "orders.min_amount": fromMoney(v.min) ?? 0,
        "orders.delivery_note": fromLocal(v.note, main),
        "orders.form_fields": [
          { key: "name", visible: true, required: true },
          { key: "phone", visible: true, required: true },
          ...v.fields,
        ],
      })}
      onSaved={d.commit}
    >
      <Toggle label="Sifariş qəbul olunur" hint="Söndürsəniz, sayt yalnız məhsulları göstərəcək." checked={v.enabled} onChange={(x) => d.setV({ ...v, enabled: x })} />
      <Field label="Minimum sifariş məbləği" inputMode="decimal" placeholder="0 — məhdudiyyət yoxdur" value={v.min} onChange={(e) => d.setV({ ...v, min: e.target.value })} />
      <LocalField
        label="Çatdırılma haqqında qeyd"
        multiline
        placeholder="Məs.: Bakı daxili çatdırılma 1–2 gün, 5 ₼"
        value={v.note}
        onChange={(x) => d.setV({ ...v, note: x })}
        main={main}
        languages={langs}
      />
      <div>
        <p className="text-[0.88rem] font-medium">Sifariş formasının sahələri</p>
        <p className="mt-0.5 text-[0.8rem] text-ink-soft">Ad və telefon həmişə soruşulur.</p>
        <div className="mt-3 grid gap-3">
          {v.fields.map((f) => (
            <div key={f.key} className="grid gap-2.5 rounded-[14px] bg-paper p-3.5">
              <Toggle label={`${FIELD_NAMES[f.key]} soruşulsun`} checked={f.visible} onChange={(x) => setField(f.key, { visible: x })} />
              <Toggle label="Məcburidir" disabled={!f.visible} checked={f.required} onChange={(x) => setField(f.key, { required: x })} />
            </div>
          ))}
        </div>
      </div>
    </SaveCard>
  );
}

/* ---------- notifications ---------- */

function NotifyCard({ data }: { data: SettingsRes }) {
  const [connected, setConnected] = useState(data.telegram.connected);
  const [enabled, setEnabled] = useState(data.telegram.enabled);
  const [wa, setWa] = useState(data.settings["notify.whatsapp_button_enabled"] === true);
  const sw = useAction();
  const test = useAction();
  const [tested, setTested] = useState(false);

  const flip = async (key: string, value: boolean, apply: (v: boolean) => void) => {
    apply(value);
    if ((await sw.run(() => call("PUT", "settings", { [key]: value }))) === undefined) apply(!value);
  };

  return (
    <section className="rounded-[20px] bg-paper-2 p-4 sm:p-5">
      <h2 className="text-[1.08rem]">Bildirişlər</h2>
      <p className="mt-1 text-[0.82rem] text-ink-soft">Hər yeni sifariş Telegram-a mesaj kimi gəlir.</p>
      <div className="mt-4 grid gap-3">
        {connected && (
          <div className="grid gap-3 rounded-[16px] bg-paper p-4">
            <Toggle
              label="Telegram bildirişləri"
              hint={data.telegram.bot ? `Bot: @${data.telegram.bot}` : undefined}
              checked={enabled}
              onChange={(x) => flip("notify.telegram_enabled", x, setEnabled)}
            />
            <button
              type="button"
              className="pill pill-line h-10 justify-self-start px-4 text-[0.88rem]"
              disabled={test.busy}
              onClick={async () => setTested(!!(await test.run(() => call("POST", "telegram/test"))))}
            >
              {test.busy ? <Spinner /> : "Test mesajı göndər"}
            </button>
            {test.err && <Notice>{test.err}</Notice>}
            {tested && !test.err && <Notice tone="ok">Göndərildi. Telegram-ı yoxlayın.</Notice>}
          </div>
        )}
        <details className="rounded-[16px] bg-paper p-4" open={!connected}>
          <summary className="cursor-pointer text-[0.92rem] font-medium">{connected ? "Başqa bot və ya qrup qoş" : "Telegram-ı qoş"}</summary>
          <div className="mt-3">
            <TelegramConnect tg={data.telegram} onChange={(c) => (setConnected(c), c && setEnabled(true))} />
          </div>
        </details>
        <div className="rounded-[16px] bg-paper p-4">
          <Toggle
            label="WhatsApp düyməsi"
            hint="Sifariş göndəriləndən sonra müştəriyə “WhatsApp-da göndər” düyməsi göstərilir."
            checked={wa}
            onChange={(x) => flip("notify.whatsapp_button_enabled", x, setWa)}
          />
        </div>
        {sw.err && <Notice>{sw.err}</Notice>}
      </div>
    </section>
  );
}

/* ---------- SEO ---------- */

function SeoCard({ s }: { s: S }) {
  const d = useDraft({ title: str(s["seo.title"]), description: str(s["seo.description"]) });
  return (
    <SaveCard
      title="Axtarış sistemləri"
      lead="Google və sosial şəbəkələrdə linkin altında görünən başlıq və təsvir."
      dirty={d.dirty}
      patch={() => ({ "seo.title": d.v.title.trim(), "seo.description": d.v.description.trim() })}
      onSaved={d.commit}
    >
      <Field label="Başlıq" maxLength={70} placeholder="Boş qalsa, mağazanın adı" value={d.v.title} onChange={(e) => d.setV({ ...d.v, title: e.target.value })} />
      <TextArea label="Təsvir" maxLength={200} value={d.v.description} onChange={(e) => d.setV({ ...d.v, description: e.target.value })} />
    </SaveCard>
  );
}
