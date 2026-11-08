"use client";

import { useEffect, useRef, useState } from "react";
import { call, shrink, uploadImage } from "./api";
import { Chip, ConfirmButton, DownIcon, IconBtn, ImageIcon, UpIcon, XIcon } from "./controls";
import { Field, Notice, Spinner, useAction } from "./ui";
import { ColorInput, PALETTES } from "./Setup";
import { useCategories } from "./Categories";
import { useShop } from "./Panel";
import { flatTree } from "./catalog";
import { LocalField, fromLocal, str, toLocal, useDraft, useSettings, type LocalValue, type S } from "./settings-ui";
import { FONTS } from "@/shared/settings";

/*
 * Appearance: logo, colours, font, card size, banners and the categories on
 * the home page, with a live preview. One "Yadda saxla" for everything.
 */

type Banner = { image: string; title: LocalValue; subtitle: LocalValue; link: string };

const FONT_NAMES: Record<string, string> = {
  "Inter Tight": "Inter Tight — sadə",
  Manrope: "Manrope — yumşaq",
  Montserrat: "Montserrat — enli",
  Onest: "Onest — müasir",
  "Playfair Display": "Playfair — zərif",
  System: "Telefonun öz şrifti",
};
const fontCss = (f: string) => `${FONTS[f] ?? FONTS["Inter Tight"]}, system-ui, sans-serif`;

/** "/images/brand/x.webp" → "brand/x.webp" for our own uploads, else null. */
const keyOf = (url: string) => (/^\/images\/(brand|banners)\//.test(url) ? url.slice(8) : null);

export function Appearance({ onSaved }: { onSaved: () => void }) {
  const { data, err } = useSettings();
  if (err)
    return (
      <div className="mx-auto w-full max-w-[40rem] px-4">
        <Notice>{err}</Notice>
      </div>
    );
  if (!data)
    return (
      <div className="mt-10 grid place-items-center text-ink-soft">
        <Spinner />
      </div>
    );
  return <Editor s={data.settings} onSaved={onSaved} />;
}

function Editor({ s, onSaved }: { s: S; onSaved: () => void }) {
  const main = str(s["store.language"]) || "az";
  const langs = Array.isArray(s["store.languages"]) ? (s["store.languages"] as string[]) : [main];
  const rawBanners = Array.isArray(s["home.banners"]) ? (s["home.banners"] as S[]) : [];
  const d = useDraft<V>({
    logo: str(s["store.logo"]),
    favicon: str(s["store.favicon"]),
    ink: str(s["theme.primary_color"]) || "#0a0a0a",
    accent: str(s["theme.secondary_color"]) || "#ff6f5e",
    font: str(s["theme.font"]) in FONTS ? str(s["theme.font"]) : "Inter Tight",
    layout: s["theme.layout"] === "list" ? "list" : "grid",
    banners: rawBanners
      .filter((b) => typeof b?.image === "string")
      .map((b) => ({ image: str(b.image), title: toLocal(b.title, main), subtitle: toLocal(b.subtitle, main), link: str(b.link) })) as Banner[],
    featured: Array.isArray(s["home.featured_category_ids"]) ? (s["home.featured_category_ids"] as unknown[]).map(Number) : [],
  });
  const v = d.v;
  const set = (p: Partial<typeof v>) => d.setV({ ...v, ...p });
  // pictures uploaded in this session; dropped from R2 if they are not saved
  const [fresh] = useState(() => new Set<string>());
  const saved = useRef({ logo: v.logo, favicon: v.favicon, banners: v.banners.map((b) => b.image) });
  const save = useAction();
  const [ok, setOk] = useState(false);
  // leaving without saving: the new uploads are not used anywhere
  useEffect(() => {
    const f = fresh;
    return () => {
      for (const u of f) {
        const k = keyOf(u);
        if (k) void call("DELETE", `upload/${k}`).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setOk(false);
    for (const b of v.banners) {
      const l = b.link.trim();
      if (l && !l.startsWith("/") && !/^https?:\/\//.test(l)) return save.setErr("Banner linki “/” və ya https:// ilə başlamalıdır");
    }
    const r = await save.run(() =>
      call("PUT", "settings", {
        "store.logo": v.logo || null,
        "store.favicon": v.favicon || null,
        "theme.primary_color": v.ink,
        "theme.secondary_color": v.accent,
        "theme.font": v.font,
        "theme.layout": v.layout,
        "home.banners": v.banners.map((b) => ({
          image: b.image,
          title: fromLocal(b.title, main),
          subtitle: fromLocal(b.subtitle, main),
          link: b.link.trim(),
        })),
        "home.featured_category_ids": v.featured,
      }),
    );
    if (!r) return;
    // pictures no longer used anywhere: replaced logo, removed banners, unsaved uploads
    const now = new Set([v.logo, v.favicon, ...v.banners.map((b) => b.image)]);
    const old = [saved.current.logo, saved.current.favicon, ...saved.current.banners, ...fresh];
    for (const u of new Set(old)) {
      const k = keyOf(u);
      if (k && !now.has(u)) void call("DELETE", `upload/${k}`).catch(() => {});
    }
    fresh.clear();
    saved.current = { logo: v.logo, favicon: v.favicon, banners: v.banners.map((b) => b.image) };
    d.commit();
    setOk(true);
    onSaved();
  };

  return (
    <div className="mx-auto grid w-full max-w-[64rem] gap-4 px-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="grid gap-3">
        <LogoCard v={v} set={set} fresh={fresh} />
        <ColorsCard v={v} set={set} />
        <FontCard v={v} set={set} />
        <BannersCard banners={v.banners} onChange={(banners) => set({ banners })} main={main} langs={langs} fresh={fresh} />
        <FeaturedCard featured={v.featured} onChange={(featured) => set({ featured })} />
      </div>

      <div className="lg:sticky lg:top-4">
        <Preview v={v} main={main} />
        <div className="sticky bottom-0 -mx-4 mt-3 grid gap-2 bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:static lg:mx-0 lg:bg-transparent lg:p-0">
          {save.err && <Notice>{save.err}</Notice>}
          {ok && !d.dirty && <Notice tone="ok">Saxlanıldı. Saytda dərhal görünür.</Notice>}
          <button className="pill pill-ink" disabled={save.busy || !d.dirty} onClick={submit}>
            {save.busy ? <Spinner /> : d.dirty ? "Yadda saxla" : "Dəyişiklik yoxdur"}
          </button>
        </div>
      </div>
    </div>
  );
}

type V = { logo: string; favicon: string; ink: string; accent: string; font: string; layout: string; banners: Banner[]; featured: number[] };
type SetV = (p: Partial<V>) => void;

function Box({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[20px] bg-paper-2 p-4 sm:p-5">
      <h2 className="text-[1.08rem]">{title}</h2>
      {lead && <p className="mt-1 text-[0.82rem] text-ink-soft">{lead}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ---------- logo ---------- */

function LogoCard({ v, set, fresh }: { v: V; set: SetV; fresh: Set<string> }) {
  const pic = useAction();
  const pick = (file: File | undefined) =>
    file &&
    pic.run(async () => {
      const [big, small] = await Promise.all([shrink(file, 512, 0.9), shrink(file, 128, 0.9)]);
      const [l, f] = await Promise.all([uploadImage(big, "brand"), uploadImage(small, "brand")]);
      fresh.add(l);
      fresh.add(f);
      set({ logo: l, favicon: f });
    });
  return (
    <Box title="Loqo" lead="Saytın başlığında və brauzer vərəqində görünür.">
      <div className="flex items-center gap-3">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[16px] bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {v.logo ? <img src={v.logo} alt="" className="size-full object-contain" /> : <span className="text-[0.75rem] text-ink-soft">Yoxdur</span>}
        </span>
        <label className="pill pill-soft h-11 cursor-pointer bg-paper px-4 text-[0.9rem]">
          {pic.busy ? <Spinner /> : v.logo ? "Dəyiş" : "Şəkil seç"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
        </label>
        {v.logo && (
          <button type="button" className="text-[0.88rem] font-medium text-ink-soft" onClick={() => set({ logo: "", favicon: "" })}>
            Sil
          </button>
        )}
      </div>
      {pic.err && <p className="mt-2 text-[0.85rem] text-danger">{pic.err}</p>}
    </Box>
  );
}

/* ---------- colours ---------- */

function ColorsCard({ v, set }: { v: V; set: SetV }) {
  const same = (p: (typeof PALETTES)[number]) => p.ink === v.ink.toLowerCase() && p.accent === v.accent.toLowerCase();
  return (
    <Box title="Rənglər" lead="Əsas rəng: yazılar və düymələr. Əlavə rəng: kiçik vurğular.">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PALETTES.map((p) => (
          <button
            key={p.n}
            type="button"
            aria-pressed={same(p)}
            onClick={() => set({ ink: p.ink, accent: p.accent })}
            className="rounded-[14px] bg-paper p-2.5 text-left outline-offset-[-2px] aria-pressed:outline-2 aria-pressed:outline-ink"
          >
            <span className="flex gap-1">
              <span className="size-6 rounded-full" style={{ background: p.ink }} />
              <span className="size-6 rounded-full" style={{ background: p.accent }} />
            </span>
            <span className="mt-1.5 block text-[0.8rem] font-medium">{p.n}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <ColorInput label="Əsas rəng" value={v.ink} onChange={(ink) => set({ ink })} />
        <ColorInput label="Əlavə rəng" value={v.accent} onChange={(accent) => set({ accent })} />
      </div>
    </Box>
  );
}

/* ---------- font and card size ---------- */

function FontCard({ v, set }: { v: V; set: SetV }) {
  return (
    <Box title="Şrift və düzülüş">
      <div role="radiogroup" aria-label="Şrift" className="grid gap-2 sm:grid-cols-2">
        {Object.keys(FONTS).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={v.font === f}
            onClick={() => set({ font: f })}
            className="rounded-[14px] bg-paper px-4 py-3 text-left outline-offset-[-2px] aria-checked:outline-2 aria-checked:outline-ink"
          >
            <span className="block text-[1.15rem] font-[650] tracking-[-0.02em]" style={{ fontFamily: fontCss(f) }}>
              Aa Əə Şş Жж 123
            </span>
            <span className="block text-[0.8rem] text-ink-soft">{FONT_NAMES[f] ?? f}</span>
          </button>
        ))}
      </div>
      <p className="mb-1.5 mt-5 text-[0.88rem] font-medium">Məhsul kartları (telefonda)</p>
      <div className="flex flex-wrap gap-2">
        <Chip on={v.layout === "grid"} onClick={() => set({ layout: "grid" })}>
          Bir sırada iki
        </Chip>
        <Chip on={v.layout === "list"} onClick={() => set({ layout: "list" })}>
          Bir sırada bir (böyük)
        </Chip>
      </div>
    </Box>
  );
}

/* ---------- banners ---------- */

function BannersCard({
  banners,
  onChange,
  main,
  langs,
  fresh,
}: {
  banners: Banner[];
  onChange: (b: Banner[]) => void;
  main: string;
  langs: string[];
  fresh: Set<string>;
}) {
  const up = useAction();
  const add = (files: FileList | null) =>
    files?.length &&
    up.run(async () => {
      const out: Banner[] = [];
      for (const f of Array.from(files).slice(0, 6)) {
        const url = await uploadImage(await shrink(f, 1600), "banners");
        fresh.add(url);
        out.push({ image: url, title: {}, subtitle: {}, link: "" });
      }
      onChange([...banners, ...out]);
    });
  const patch = (i: number, p: Partial<Banner>) => onChange(banners.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const move = (i: number, by: number) => {
    const n = [...banners];
    [n[i], n[i + by]] = [n[i + by], n[i]];
    onChange(n);
  };

  return (
    <Box title="Bannerlər" lead="Ana səhifədə adın altında. Ən yaxşısı enli şəkillərdir (16:9).">
      <div className="grid gap-3">
        {banners.map((b, i) => (
          <div key={b.image} className="grid gap-3 rounded-[16px] bg-paper p-3">
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.image} alt="" className="aspect-[16/9] w-36 shrink-0 rounded-[12px] bg-tile object-cover" />
              <div className="ml-auto flex gap-1">
                <IconBtn label="Yuxarı" disabled={i === 0} onClick={() => move(i, -1)} className="bg-paper-2">
                  <UpIcon />
                </IconBtn>
                <IconBtn label="Aşağı" disabled={i === banners.length - 1} onClick={() => move(i, 1)} className="bg-paper-2">
                  <DownIcon />
                </IconBtn>
                <ConfirmButton
                  confirm="Sil?"
                  className="grid h-9 min-w-9 place-items-center rounded-full bg-paper-2 px-2 text-[0.8rem] font-medium"
                  onConfirm={() => onChange(banners.filter((_, j) => j !== i))}
                >
                  <XIcon />
                </ConfirmButton>
              </div>
            </div>
            <LocalField label="Başlıq (istəyə görə)" value={b.title} onChange={(title) => patch(i, { title })} main={main} languages={langs} maxLength={80} />
            <LocalField label="Alt yazı (istəyə görə)" value={b.subtitle} onChange={(subtitle) => patch(i, { subtitle })} main={main} languages={langs} maxLength={140} />
            <Field
              label="Basanda açılsın (istəyə görə)"
              placeholder="/catalog/?c=... və ya https://..."
              value={b.link}
              onChange={(e) => patch(i, { link: e.target.value })}
            />
          </div>
        ))}
        <label className="pill pill-soft cursor-pointer bg-paper">
          {up.busy ? (
            <Spinner />
          ) : (
            <>
              <ImageIcon />
              Banner əlavə et
            </>
          )}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        </label>
        {up.err && <Notice>{up.err}</Notice>}
      </div>
    </Box>
  );
}

/* ---------- categories on the home page ---------- */

function FeaturedCard({ featured, onChange }: { featured: number[]; onChange: (ids: number[]) => void }) {
  const { items } = useCategories();
  const tree = items ? flatTree(items) : [];
  return (
    <Box title="Ana səhifədəki kateqoriyalar" lead="Seçdikləriniz şəkilli kartlar kimi ana səhifədə göstərilir, seçim sırası ilə.">
      {!items ? (
        <Spinner />
      ) : !tree.length ? (
        <p className="text-[0.88rem] text-ink-soft">Hələ kateqoriya yoxdur.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tree.map((c) => {
            const n = featured.indexOf(c.id);
            return (
              <Chip key={c.id} on={n >= 0} onClick={() => onChange(n >= 0 ? featured.filter((x) => x !== c.id) : [...featured, c.id])}>
                {n >= 0 && <span className="num opacity-70">{n + 1}.</span>}
                {c.name}
              </Chip>
            );
          })}
        </div>
      )}
    </Box>
  );
}

/* ---------- live preview ---------- */

function Preview({ v, main }: { v: V; main: string }) {
  const name = useShop().name || "Mağaza";
  const b = v.banners[0];
  const title = b ? (b.title[main] ?? "") : "";
  return (
    <section aria-label="Önizləmə" className="overflow-hidden rounded-[20px] bg-white text-[#0a0a0a] outline outline-1 -outline-offset-1 outline-ink-line-2" style={{ fontFamily: fontCss(v.font) }}>
      <div className="flex items-center gap-2 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {v.logo && <img src={v.logo} alt="" className="size-7 rounded-[8px] object-contain" />}
        <span className="text-[0.95rem] font-[650]" style={{ color: v.ink }}>
          {name}
        </span>
        <span className="ml-auto text-[0.75rem] font-semibold" style={{ color: v.accent }}>
          Yeni
        </span>
      </div>
      <div className="px-4">
        {b ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.image} alt="" className="aspect-[16/9] w-full rounded-[14px] object-cover" />
            {title && <p className="mt-1.5 text-[0.85rem] font-[650]">{title}</p>}
          </>
        ) : (
          <p className="py-4 text-center text-[1.6rem] font-[650] tracking-[-0.03em]" style={{ color: v.ink }}>
            {name}
          </p>
        )}
      </div>
      <div className={`grid gap-2.5 p-4 ${v.layout === "list" ? "grid-cols-1" : "grid-cols-2"}`}>
        {[0, 1].map((i) => (
          <div key={i}>
            <span className={`block rounded-[12px] bg-[#f5f5f7] ${v.layout === "list" ? "aspect-[16/10]" : "aspect-square"}`} />
            <span className="mt-1.5 block text-[0.8rem] font-medium" style={{ color: v.ink }}>
              Məhsulun adı
            </span>
            <span className="block text-[0.8rem] font-[650]" style={{ color: v.ink }}>
              49 ₼
            </span>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <span className="flex h-10 items-center justify-center rounded-full text-[0.85rem] font-semibold text-white" style={{ background: v.ink }}>
          Səbətə at
        </span>
      </div>
    </section>
  );
}
