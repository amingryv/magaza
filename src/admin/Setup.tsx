"use client";

import { useEffect, useRef, useState } from "react";
import { call, shrink, uploadImage, type SettingsRes, type Telegram } from "./api";
import { Field, Notice, PasswordField, Screen, Spinner, TextArea, useAction } from "./ui";

/*
 * Setup wizard, one screen per step. Each "İrəli" saves its step, so a
 * closed tab resumes where it stopped (after the password step the owner is
 * logged in; AdminApp brings them back here until setup.completed).
 */

const STEPS = ["Şifrə", "Mağaza", "Rənglər", "Əlaqə", "Telegram", "Sektor", "Hazır"];

type S = Record<string, unknown>;
const str = (v: unknown, lang = "az") =>
  typeof v === "string" ? v : v && typeof v === "object" ? String((v as S)[lang] ?? Object.values(v)[0] ?? "") : "";

export function Setup({ fresh, completed, onDone }: { fresh: boolean; completed: boolean; onDone: () => void }) {
  const [step, setStep] = useState(fresh ? 0 : 1);
  const [data, setData] = useState<SettingsRes | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const load = () => call<SettingsRes>("GET", "settings").then(setData);
  useEffect(() => {
    if (!fresh) void load().catch(() => {});
  }, [fresh]);

  const go = (n: number) => {
    setStep(n);
    top.current?.focus();
    window.scrollTo({ top: 0 });
  };

  const save = (patch: S) => call("PUT", "settings", patch);
  const s = data?.settings ?? {};
  const lang = str(s["store.language"]) || "az";

  return (
    <Screen>
      <div ref={top} tabIndex={-1}>
        <div className="flex items-center justify-between text-[0.82rem] font-medium text-ink-soft">
          <span>Quraşdırma</span>
          <span className="num">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden>
          {STEPS.map((n, i) => (
            <span key={n} className={`h-1 rounded-full transition-colors ${i <= step ? "bg-ink" : "bg-paper-3"}`} />
          ))}
        </div>
      </div>

      <div key={step} className="mt-8 flex flex-1 flex-col [animation:rise_.45s_var(--curve)_both]">
        {step === 0 && (
          <PasswordStep
            onNext={async () => {
              if (completed) return onDone(); // password reset: the shop is already set up
              await load();
              go(1);
            }}
          />
        )}
        {step > 0 && !data && (
          <div className="grid flex-1 place-items-center text-ink-soft">
            <Spinner />
          </div>
        )}
        {data && step === 1 && <StoreStep s={s} lang={lang} save={save} onNext={() => load().then(() => go(2))} />}
        {data && step === 2 && <ColorStep s={s} save={save} onBack={() => go(1)} onNext={() => load().then(() => go(3))} />}
        {data && step === 3 && <ContactStep s={s} lang={lang} save={save} onBack={() => go(2)} onNext={() => load().then(() => go(4))} />}
        {data && step === 4 && <TelegramStep tg={data.telegram} onBack={() => go(3)} onNext={() => go(5)} />}
        {data && step === 5 && <SectorStep current={str(s["store.sector"])} onBack={() => go(4)} onNext={() => go(6)} />}
        {data && step === 6 && <DoneStep save={save} onDone={onDone} />}
      </div>
    </Screen>
  );
}

/* ---------- shared bits ---------- */

function Head({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-7">
      <h1 className="text-[1.9rem]">{title}</h1>
      {lead && <p className="mt-2 text-ink-soft">{lead}</p>}
    </div>
  );
}

function Nav({
  onBack,
  next = "İrəli",
  busy,
  disabled,
  extra,
}: {
  onBack?: () => void;
  next?: string;
  busy?: boolean;
  disabled?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-auto grid gap-2 bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
      <div className="flex gap-2">
        {onBack && (
          <button type="button" className="pill pill-soft" onClick={onBack}>
            Geri
          </button>
        )}
        <button className="pill pill-ink flex-1" disabled={busy || disabled}>
          {busy ? <Spinner /> : next}
        </button>
      </div>
      {extra}
    </div>
  );
}

/** A form whose submit runs `fn`, shows its error, then calls onNext. */
function StepForm({
  fn,
  onNext,
  children,
  nav,
}: {
  fn: () => Promise<unknown>;
  onNext: () => void;
  children: React.ReactNode;
  nav: (busy: boolean) => React.ReactNode;
}) {
  const { busy, err, run } = useAction();
  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={async (e) => {
        e.preventDefault();
        if ((await run(async () => (await fn(), true))) === true) onNext();
      }}
    >
      <div className="grid gap-4">{children}</div>
      {err && (
        <div className="mt-4">
          <Notice>{err}</Notice>
        </div>
      )}
      {nav(busy)}
    </form>
  );
}

/* ---------- 1. password ---------- */

function PasswordStep({ onNext }: { onNext: () => void }) {
  const [p, setP] = useState("");
  const [r, setR] = useState("");
  return (
    <StepForm
      fn={async () => {
        if (p.length < 8) throw new Error("Şifrə ən azı 8 simvol olmalıdır");
        if (p !== r) throw new Error("Şifrələr eyni deyil");
        await call("POST", "setup", { password: p });
      }}
      onNext={onNext}
      nav={(busy) => <Nav busy={busy} disabled={!p || !r} next="Şifrəni yarat" />}
    >
      <Head title="İdarə paneli üçün şifrə" lead="Bu şifrə ilə mağazanı idarə edəcəksiniz. Onu yadda saxlayın və heç kimə verməyin." />
      <PasswordField label="Şifrə" autoComplete="new-password" autoFocus value={p} onChange={(e) => setP(e.target.value)} />
      <PasswordField label="Şifrə (təkrar)" autoComplete="new-password" value={r} onChange={(e) => setR(e.target.value)} />
      <p className="text-[0.82rem] text-ink-soft">Ən azı 8 simvol. Rəqəm və hərflərin qarışığı daha etibarlıdır.</p>
    </StepForm>
  );
}

/* ---------- 2. shop ---------- */

export const LANGS = [
  { v: "az", l: "Azərbaycan" },
  { v: "ru", l: "Русский" },
  { v: "en", l: "English" },
];

function StoreStep({ s, lang, save, onNext }: { s: S; lang: string; save: (p: S) => Promise<unknown>; onNext: () => void }) {
  const [name, setName] = useState(str(s["store.name"]) === "Mağaza" ? "" : str(s["store.name"]));
  const [desc, setDesc] = useState(str(s["store.description"], lang));
  const [main, setMain] = useState(lang);
  const [logo, setLogo] = useState(str(s["store.logo"]));
  const [favicon, setFavicon] = useState(str(s["store.favicon"]));
  const pic = useAction();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    await pic.run(async () => {
      const [big, small] = await Promise.all([shrink(file, 512, 0.9), shrink(file, 128, 0.9)]);
      const [l, f] = await Promise.all([uploadImage(big, "brand"), uploadImage(small, "brand")]);
      setLogo(l);
      setFavicon(f);
    });
  };

  return (
    <StepForm
      fn={() =>
        save({
          "store.name": name.trim(),
          "store.description": desc.trim(),
          "store.language": main,
          "store.logo": logo || null,
          "store.favicon": favicon || null,
          "seo.title": name.trim(),
        })
      }
      onNext={onNext}
      nav={(busy) => <Nav busy={busy || pic.busy} disabled={!name.trim()} />}
    >
      <Head title="Mağazanız" lead="Müştərilər saytda bu adı və təsviri görəcək." />
      <Field label="Mağazanın adı" autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      <TextArea label="Qısa təsvir" value={desc} maxLength={300} placeholder="Məs.: Uşaq geyimləri, Bakı daxili çatdırılma" onChange={(e) => setDesc(e.target.value)} />

      <div>
        <span className="mb-1.5 block text-[0.88rem] font-medium">Loqo (istəyə görə)</span>
        <div className="flex items-center gap-3">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[16px] bg-tile">
            {logo ? <img src={logo} alt="" className="size-full object-contain" /> : <span className="text-[0.75rem] text-ink-soft">Yoxdur</span>}
          </span>
          <label className="pill pill-soft h-11 cursor-pointer px-4 text-[0.9rem]">
            {pic.busy ? <Spinner /> : logo ? "Dəyiş" : "Şəkil seç"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {logo && (
            <button type="button" className="text-[0.88rem] font-medium text-ink-soft" onClick={() => (setLogo(""), setFavicon(""))}>
              Sil
            </button>
          )}
        </div>
        {pic.err && <p className="mt-2 text-[0.85rem] text-danger">{pic.err}</p>}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-[0.88rem] font-medium">Saytın əsas dili</legend>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <button key={l.v} type="button" className="chip" aria-pressed={main === l.v} onClick={() => setMain(l.v)}>
              {l.l}
            </button>
          ))}
        </div>
      </fieldset>
    </StepForm>
  );
}

/* ---------- 3. colours ---------- */

export const PALETTES = [
  { n: "Qara", ink: "#0a0a0a", accent: "#ff6f5e" },
  { n: "Gecə", ink: "#13294b", accent: "#e0a526" },
  { n: "Meşə", ink: "#1f3d2b", accent: "#c8743a" },
  { n: "Bordo", ink: "#5a1a24", accent: "#d9a441" },
  { n: "Qəhvə", ink: "#3b2a20", accent: "#b8875a" },
  { n: "Bənövşə", ink: "#3a2257", accent: "#e86a92" },
];

function ColorStep({ s, save, onBack, onNext }: { s: S; save: (p: S) => Promise<unknown>; onBack: () => void; onNext: () => void }) {
  const [ink, setInk] = useState(str(s["theme.primary_color"]) || "#0a0a0a");
  const [accent, setAccent] = useState(str(s["theme.secondary_color"]) || "#ff6f5e");
  const same = (p: (typeof PALETTES)[number]) => p.ink === ink.toLowerCase() && p.accent === accent.toLowerCase();

  return (
    <StepForm
      fn={() => save({ "theme.primary_color": ink, "theme.secondary_color": accent })}
      onNext={onNext}
      nav={(busy) => <Nav busy={busy} onBack={onBack} />}
    >
      <Head title="Rənglər" lead="Hazır palitralardan birini seçin və ya öz rənginizi qoyun. Sonra da dəyişmək olar." />
      <div className="grid grid-cols-3 gap-2.5">
        {PALETTES.map((p) => (
          <button
            key={p.n}
            type="button"
            aria-pressed={same(p)}
            onClick={() => (setInk(p.ink), setAccent(p.accent))}
            className="rounded-[16px] bg-paper-2 p-3 text-left outline-offset-[-2px] aria-pressed:outline-2 aria-pressed:outline-ink"
          >
            <span className="flex gap-1">
              <span className="size-7 rounded-full" style={{ background: p.ink }} />
              <span className="size-7 rounded-full" style={{ background: p.accent }} />
            </span>
            <span className="mt-2 block text-[0.85rem] font-medium">{p.n}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <ColorInput label="Əsas rəng" value={ink} onChange={setInk} />
        <ColorInput label="Əlavə rəng" value={accent} onChange={setAccent} />
      </div>

      <div className="rounded-[20px] bg-paper-2 p-5" aria-label="Önizləmə">
        <p className="text-[0.8rem] font-medium text-ink-soft">Önizləmə</p>
        <p className="mt-1 text-[1.3rem] font-semibold tracking-[-0.02em]" style={{ color: ink }}>
          Məhsulun adı
        </p>
        <p className="text-[0.85rem] font-semibold" style={{ color: accent }}>
          Yeni
        </p>
        <span className="pill mt-3 h-11 text-[0.9rem]" style={{ background: ink, color: "#fff" }}>
          Səbətə at
        </span>
      </div>
    </StepForm>
  );
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 outline outline-1 -outline-offset-1 outline-ink-line-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-9 shrink-0 cursor-pointer rounded-full" />
      <span className="min-w-0">
        <span className="block text-[0.82rem] font-medium">{label}</span>
        <span className="num block text-[0.78rem] uppercase text-ink-soft">{value}</span>
      </span>
    </label>
  );
}

/* ---------- 4. contact ---------- */

function ContactStep({
  s,
  lang,
  save,
  onBack,
  onNext,
}: {
  s: S;
  lang: string;
  save: (p: S) => Promise<unknown>;
  onBack: () => void;
  onNext: () => void;
}) {
  const [v, setV] = useState({
    phone: str(s["contact.phone"]),
    whatsapp: str(s["contact.whatsapp"]),
    email: str(s["contact.email"]),
    address: str(s["contact.address"], lang),
    instagram: str(s["contact.instagram"]),
    facebook: str(s["contact.facebook"]),
    tiktok: str(s["contact.tiktok"]),
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: e.target.value }));

  return (
    <StepForm
      fn={() => {
        const wa = (v.whatsapp || v.phone).replace(/\D/g, "");
        if (v.whatsapp && wa.length < 9) throw new Error("WhatsApp nömrəsi düzgün deyil");
        return save(Object.fromEntries([...Object.entries(v).map(([k, x]) => [`contact.${k}`, x.trim()]), ["contact.whatsapp", wa]]));
      }}
      onNext={onNext}
      nav={(busy) => <Nav busy={busy} onBack={onBack} />}
    >
      <Head title="Əlaqə" lead="Saytda göstəriləcək. Boş qalan sahələr görünməyəcək." />
      <Field label="Telefon" type="tel" inputMode="tel" autoComplete="tel" placeholder="+994 50 123 45 67" value={v.phone} onChange={set("phone")} />
      <Field
        label="WhatsApp nömrəsi"
        type="tel"
        inputMode="tel"
        placeholder="Boş qalsa, telefon nömrəsi"
        hint="Sifarişlər bu nömrəyə WhatsApp-da göndəriləcək."
        value={v.whatsapp}
        onChange={set("whatsapp")}
      />
      <Field label="E-poçt" type="email" inputMode="email" value={v.email} onChange={set("email")} />
      <Field label="Ünvan" value={v.address} onChange={set("address")} />
      <Field label="Instagram" placeholder="https://instagram.com/..." value={v.instagram} onChange={set("instagram")} />
      <Field label="Facebook" placeholder="https://facebook.com/..." value={v.facebook} onChange={set("facebook")} />
      <Field label="TikTok" placeholder="https://tiktok.com/@..." value={v.tiktok} onChange={set("tiktok")} />
    </StepForm>
  );
}

/* ---------- 5. Telegram ---------- */

function TelegramStep({ tg, onBack, onNext }: { tg: Telegram; onBack: () => void; onNext: () => void }) {
  const [connected, setConnected] = useState(tg.connected);
  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      <Head title="Telegram bildirişi" lead="Hər yeni sifariş Telegram-a mesaj kimi gələcək. Bu addımı keçib sonra da qura bilərsiniz." />
      <TelegramConnect tg={tg} onChange={setConnected} />
      <Nav onBack={onBack} next={connected ? "İrəli" : "Sonra quraram"} />
    </form>
  );
}

/** BotFather token → /start → connect. Shared by the wizard and the settings page. */
export function TelegramConnect({ tg, onChange }: { tg: Telegram; onChange?: (connected: boolean) => void }) {
  const [bot, setBot] = useState(tg.bot);
  const [connected, setC] = useState(tg.connected);
  const setConnected = (v: boolean) => (setC(v), onChange?.(v));
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");
  const check = useAction();
  const conn = useAction();

  return (
    <>
      <ol className="grid gap-3 text-[0.95rem]">
        <li className="rounded-[16px] bg-paper-2 p-4">
          <b>1.</b> Telegram-da{" "}
          <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="font-semibold underline">
            @BotFather
          </a>{" "}
          açın, <b>/newbot</b> yazın, bota ad verin. O sizə uzun bir kod (token) göndərəcək. Həmin kodu kopyalayın.
        </li>
        <li className="grid gap-3 rounded-[16px] bg-paper-2 p-4">
          <span>
            <b>2.</b> Kodu bura yapışdırın.
          </span>
          <input
            className="field bg-paper"
            aria-label="Bot tokeni"
            placeholder="123456789:AA..."
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          <button
            type="button"
            className="pill pill-ink"
            disabled={!token.trim() || check.busy}
            onClick={() =>
              check.run(async () => {
                const r = await call<{ bot: string }>("POST", "telegram/token", { token });
                setBot(r.bot);
                setConnected(false);
                setToken("");
                setMsg("");
              })
            }
          >
            {check.busy ? <Spinner /> : "Yoxla"}
          </button>
          {check.err && <Notice>{check.err}</Notice>}
          {bot && !check.err && <Notice tone="ok">Bot tapıldı: @{bot}</Notice>}
        </li>
        <li className={`grid gap-3 rounded-[16px] bg-paper-2 p-4 ${bot ? "" : "opacity-50"}`}>
          <span>
            <b>3.</b> Botunuzu açıb <b>/start</b> yazın (və ya botu bildiriş qrupuna əlavə edin), sonra “Qoşul” basın.
          </span>
          {bot && (
            <a href={`https://t.me/${bot}`} target="_blank" rel="noreferrer" className="pill pill-line">
              @{bot} botunu aç
            </a>
          )}
          <button
            type="button"
            className="pill pill-ink"
            disabled={!bot || conn.busy}
            onClick={() =>
              conn.run(async () => {
                const r = await call<{ chat: string; test_sent: boolean }>("POST", "telegram/connect");
                setConnected(true);
                setMsg(r.test_sent ? `Qoşuldu${r.chat ? `: ${r.chat}` : ""}. Telegram-a test mesajı göndərildi.` : "Qoşuldu, amma test mesajı getmədi.");
              })
            }
          >
            {conn.busy ? <Spinner /> : "Qoşul"}
          </button>
          {conn.err && <Notice>{conn.err}</Notice>}
          {msg && <Notice tone="ok">{msg}</Notice>}
          {connected && !msg && <Notice tone="ok">Telegram artıq qoşulub.</Notice>}
        </li>
      </ol>
    </>
  );
}

/* ---------- 6. sector ---------- */

const SECTORS = [
  { v: "clothing", n: "Geyim", d: "Ölçü, rəng, material, brend" },
  { v: "furniture", n: "Mebel", d: "Material, rəng, ölçülər" },
  { v: "cosmetics", n: "Kosmetika", d: "Brend, həcm, dəri tipi" },
  { v: "electronics", n: "Elektronika", d: "Brend, yaddaş, rəng, zəmanət" },
  { v: "food", n: "Ərzaq", d: "Çəki, istehsal ölkəsi, brend" },
  { v: "other", n: "Digər", d: "Xüsusiyyətləri özüm yaradacağam" },
];

function SectorStep({ current, onBack, onNext }: { current: string; onBack: () => void; onNext: () => void }) {
  const [v, setV] = useState(current || "");
  return (
    <StepForm
      fn={() => call("POST", "sector", { sector: v })}
      onNext={onNext}
      nav={(busy) => <Nav busy={busy} onBack={onBack} disabled={!v} />}
    >
      <Head
        title="Nə satırsınız?"
        lead="Seçiminizə görə məhsullar üçün uyğun xüsusiyyətlər hazırlanacaq. Onları sonra dəyişmək və ya silmək olar."
      />
      <div role="radiogroup" className="grid gap-2">
        {SECTORS.map((x) => (
          <button
            key={x.v}
            type="button"
            role="radio"
            aria-checked={v === x.v}
            onClick={() => setV(x.v)}
            className="flex items-center justify-between gap-3 rounded-[16px] bg-paper-2 px-4 py-3.5 text-left outline-offset-[-2px] aria-checked:outline-2 aria-checked:outline-ink"
          >
            <span>
              <span className="block font-semibold">{x.n}</span>
              <span className="block text-[0.85rem] text-ink-soft">{x.d}</span>
            </span>
            <span
              aria-hidden
              className={`size-5 shrink-0 rounded-full ${v === x.v ? "border-[6px] border-ink" : "border-2 border-ink-line-2"}`}
            />
          </button>
        ))}
      </div>
    </StepForm>
  );
}

/* ---------- 7. done ---------- */

function DoneStep({ save, onDone }: { save: (p: S) => Promise<unknown>; onDone: () => void }) {
  const { busy, err, run } = useAction();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    void run(() => save({ "setup.completed": true })).then((r) => r !== undefined && setOk(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <Head title="Mağazanız hazırdır" lead="İndi idarə panelindən məhsul əlavə edə və sifarişləri izləyə bilərsiniz." />
      {err && <Notice>{err}</Notice>}
      <div className="mt-auto grid gap-2 pt-6">
        <button
          className="pill pill-ink"
          disabled={busy}
          onClick={async () => {
            if (ok || (await run(() => save({ "setup.completed": true }))) !== undefined) onDone();
          }}
        >
          {busy ? <Spinner /> : "İdarə panelinə keç"}
        </button>
        <a href="/" target="_blank" className="pill pill-soft">
          Mağazaya bax
        </a>
      </div>
    </div>
  );
}
