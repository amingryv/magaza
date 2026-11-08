"use client";

import { useCallback, useEffect, useState } from "react";
import { call } from "./api";
import { trGet, trSet, LANG_NAMES, type Translations } from "./catalog";
import { Card, ConfirmButton, DownIcon, IconBtn, PlusIcon, Toggle, UpIcon } from "./controls";
import { Field, Notice, Spinner, TextArea, useAction } from "./ui";
import { useShop } from "./Panel";

type AdminPage = {
  id: number;
  slug: string;
  title: string;
  content: string;
  is_active: boolean;
  show_in_menu: boolean;
  translations: Translations | null;
};

/** Static pages: "Haqqımızda", "Çatdırılma"... Ordered with the arrows (the menu follows it). */
export function Pages() {
  const [items, setItems] = useState<AdminPage[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<number | "new" | null>(null);
  const moving = useAction();

  const load = useCallback(
    () =>
      call<{ items: AdminPage[] }>("GET", "pages").then(
        (r) => (setItems(r.items), setErr("")),
        (e: Error) => setErr(e.message),
      ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (!items) return <div className="grid place-items-center py-16 text-ink-soft">{err ? <Notice>{err}</Notice> : <Spinner />}</div>;

  const move = async (i: number, dir: -1 | 1) => {
    const order = items.map((p) => p.id);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    await moving.run(() => call("POST", "pages/reorder", { ids: order }));
    await load();
  };
  const saved = async () => {
    setOpen(null);
    await load();
  };

  return (
    <div className="mx-auto grid w-full max-w-[46rem] gap-4 px-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.88rem] text-ink-soft">{items.length ? `${items.length} səhifə` : "Hələ səhifə yoxdur"}</p>
        <button className="pill pill-ink h-10 px-4 text-[0.88rem]" onClick={() => setOpen("new")}>
          <PlusIcon /> Yeni səhifə
        </button>
      </div>
      {!items.length && open !== "new" && (
        <p className="text-[0.88rem] text-ink-soft">Məsələn: «Haqqımızda», «Çatdırılma və ödəniş», «Qaytarma şərtləri».</p>
      )}
      {moving.err && <Notice>{moving.err}</Notice>}
      {open === "new" && <PageForm onClose={() => setOpen(null)} onSaved={saved} />}

      {items.length > 0 && (
        <ul className="overflow-hidden rounded-[20px] bg-paper-2">
          {items.map((p, i) => (
            <li key={p.id} className={i ? "border-t border-ink-line" : ""}>
              {open === p.id ? (
                <div className="p-2">
                  <PageForm page={p} onClose={() => setOpen(null)} onSaved={saved} />
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(p.id)}>
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="block text-[0.8rem] text-ink-soft">
                      {!p.is_active ? "Gizlidir" : p.show_in_menu ? "Menyuda görünür" : "Yalnız link ilə açılır"}
                    </span>
                  </button>
                  <IconBtn label="Yuxarı" disabled={i === 0 || moving.busy} onClick={() => move(i, -1)}>
                    <UpIcon />
                  </IconBtn>
                  <IconBtn label="Aşağı" disabled={i === items.length - 1 || moving.busy} onClick={() => move(i, 1)}>
                    <DownIcon />
                  </IconBtn>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PageForm({ page, onClose, onSaved }: { page?: AdminPage; onClose: () => void; onSaved: () => void }) {
  const shop = useShop();
  const [title, setTitle] = useState(page?.title ?? "");
  const [content, setContent] = useState(page?.content ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [active, setActive] = useState(page?.is_active ?? true);
  const [menu, setMenu] = useState(page?.show_in_menu ?? true);
  const [tr, setTr] = useState<Translations | null>(page?.translations ?? null);
  const save = useAction();
  const others = shop.languages.filter((l) => l !== shop.main);

  return (
    <Card title={page ? "Səhifəni redaktə et" : "Yeni səhifə"}>
      <form
        className="grid gap-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = { title, content, slug, is_active: active, show_in_menu: menu, translations: tr };
          if (await save.run(() => (page ? call("PUT", `pages/${page.id}`, body) : call("POST", "pages", body)))) onSaved();
        }}
      >
        <Field label="Başlıq" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
        <TextArea label="Mətn" rows={12} value={content} onChange={(e) => setContent(e.target.value)} maxLength={100000} />
        <p className="-mt-2 text-[0.8rem] leading-relaxed text-ink-soft">
          Boş sətir yeni abzas başladır. Sətrin əvvəlinə <b># </b> yazsanız başlıq, <b>- </b> yazsanız siyahı olur. <b>**qalın**</b>, link:{" "}
          <b>[mətn](https://...)</b>
        </p>

        {others.map((l) => (
          <details key={l} className="rounded-[14px] bg-paper px-4 py-3">
            <summary className="cursor-pointer text-[0.9rem] font-medium">{LANG_NAMES[l] ?? l} tərcümə</summary>
            <div className="mt-3 grid gap-3">
              <Field label="Başlıq" hint="Boş qalsa əsas dildəki göstərilir" value={trGet(tr, l, "title")} onChange={(e) => setTr(trSet(tr, l, "title", e.target.value))} />
              <TextArea label="Mətn" rows={8} value={trGet(tr, l, "content")} onChange={(e) => setTr(trSet(tr, l, "content", e.target.value))} />
            </div>
          </details>
        ))}

        <Toggle label="Mağazada görünsün" checked={active} onChange={setActive} />
        <Toggle label="Menyuda göstər" hint="Söndürülsə, səhifə yalnız link ilə açılır" checked={menu} onChange={setMenu} disabled={!active} />
        {page && <Field label="Link" hint="Ünvanda görünən ad. Boş qalsa başlıqdan yaradılır" value={slug} onChange={(e) => setSlug(e.target.value)} />}
        {page?.is_active && (
          <a href={`/${shop.main}/page/?s=${encodeURIComponent(page.slug)}`} target="_blank" className="text-[0.86rem] font-medium underline underline-offset-2">
            Səhifəyə bax
          </a>
        )}

        {save.err && <Notice>{save.err}</Notice>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button className="pill pill-ink h-11 px-5" disabled={save.busy || !title.trim()}>
            {save.busy ? <Spinner /> : "Yadda saxla"}
          </button>
          <button type="button" className="pill pill-line h-11 px-5" onClick={onClose}>
            Ləğv et
          </button>
          {page && (
            <ConfirmButton
              className="pill pill-line ml-auto h-11 px-4 text-danger"
              disabled={save.busy}
              onConfirm={async () => {
                if (await save.run(() => call("DELETE", `pages/${page.id}`))) onSaved();
              }}
            >
              Sil
            </ConfirmButton>
          )}
        </div>
      </form>
    </Card>
  );
}
