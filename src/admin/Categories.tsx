"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { call, shrink } from "./api";
import { dropUploads, flatTree, trGet, trSet, uploadKey, LANG_NAMES, type AdminCategory, type Translations } from "./catalog";
import { Card, ConfirmButton, DownIcon, IconBtn, ImageIcon, PlusIcon, Select, Toggle, UpIcon } from "./controls";
import { Field, Notice, Spinner, useAction } from "./ui";
import { useShop } from "./Panel";

export function useCategories() {
  const [items, setItems] = useState<AdminCategory[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(
    () =>
      call<{ items: AdminCategory[] }>("GET", "categories").then(
        (r) => (setItems(r.items), setErr("")),
        (e: Error) => setErr(e.message),
      ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { items, err, load };
}

/** Category tree: order with the arrows (within the same parent), edit inline. */
export function Categories() {
  const { items, err, load } = useCategories();
  const [open, setOpen] = useState<number | "new" | null>(null);
  const moving = useAction();

  if (!items) return <div className="grid place-items-center py-16 text-ink-soft">{err ? <Notice>{err}</Notice> : <Spinner />}</div>;
  const tree = flatTree(items);

  const move = async (id: number, dir: -1 | 1) => {
    const me = tree.find((c) => c.id === id)!;
    const sibs = tree.filter((c) => c.parent_id === me.parent_id || (me.depth === 0 && c.depth === 0));
    const i = sibs.findIndex((c) => c.id === id);
    const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    const order = sibs.map((c) => c.id);
    [order[i], order[j]] = [order[j], order[i]];
    await moving.run(() => call("POST", "categories/reorder", { ids: order }));
    await load();
  };

  return (
    <div className="mx-auto grid w-full max-w-[46rem] gap-4 px-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.88rem] text-ink-soft">{items.length ? `${items.length} kateqoriya` : "Hələ kateqoriya yoxdur"}</p>
        <button className="pill pill-ink h-10 px-4 text-[0.88rem]" onClick={() => setOpen("new")}>
          <PlusIcon /> Yeni kateqoriya
        </button>
      </div>
      {moving.err && <Notice>{moving.err}</Notice>}

      {open === "new" && (
        <CategoryForm
          all={items}
          onClose={() => setOpen(null)}
          onSaved={async () => {
            setOpen(null);
            await load();
          }}
        />
      )}

      {tree.length > 0 && (
        <ul className="overflow-hidden rounded-[20px] bg-paper-2">
          {tree.map((c, n) => {
            const sibs = tree.filter((x) => x.parent_id === c.parent_id || (c.depth === 0 && x.depth === 0));
            const pos = sibs.findIndex((x) => x.id === c.id);
            return (
              <li key={c.id} className={n ? "border-t border-ink-line" : ""}>
                {open === c.id ? (
                  <div className="p-2">
                    <CategoryForm
                      all={items}
                      cat={c}
                      onClose={() => setOpen(null)}
                      onSaved={async () => {
                        setOpen(null);
                        await load();
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2.5" style={{ paddingLeft: `${0.75 + c.depth * 1.4}rem` }}>
                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-tile text-ink-soft">
                      {c.image_url ? <img src={c.image_url} alt="" className="size-full object-cover" /> : <ImageIcon />}
                    </span>
                    <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(c.id)}>
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block text-[0.8rem] text-ink-soft">
                        {c.products} məhsul{!c.is_active && " · gizlidir"}
                      </span>
                    </button>
                    <IconBtn label="Yuxarı" disabled={pos <= 0 || moving.busy} onClick={() => move(c.id, -1)}>
                      <UpIcon />
                    </IconBtn>
                    <IconBtn label="Aşağı" disabled={pos >= sibs.length - 1 || moving.busy} onClick={() => move(c.id, 1)}>
                      <DownIcon />
                    </IconBtn>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CategoryForm({
  all,
  cat,
  onClose,
  onSaved,
}: {
  all: AdminCategory[];
  cat?: AdminCategory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const shop = useShop();
  const [name, setName] = useState(cat?.name ?? "");
  const [slug, setSlug] = useState(cat?.slug ?? "");
  const [parent, setParent] = useState<string>(cat?.parent_id ? String(cat.parent_id) : "");
  const [active, setActive] = useState(cat?.is_active ?? true);
  const [image, setImage] = useState<{ key: string | null; url: string | null }>({ key: cat?.image ?? null, url: cat?.image_url ?? null });
  const [tr, setTr] = useState<Translations | null>(cat?.translations ?? null);
  const fresh = useRef<string[]>([]);
  const save = useAction();
  const pic = useAction();

  // a category cannot go under itself or its own children
  const below = new Set<number>();
  if (cat) {
    below.add(cat.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of all)
        if (c.parent_id != null && below.has(c.parent_id) && !below.has(c.id)) {
          below.add(c.id);
          grew = true;
        }
    }
  }
  const parents = flatTree(all).filter((c) => !below.has(c.id));
  const others = shop.languages.filter((l) => l !== shop.main);

  const close = () => {
    dropUploads(fresh.current);
    onClose();
  };

  return (
    <Card title={cat ? "Kateqoriyanı redaktə et" : "Yeni kateqoriya"}>
      <form
        className="grid gap-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = { name, slug, parent_id: parent ? Number(parent) : null, image: image.key, is_active: active, translations: tr };
          const ok = await save.run(() => (cat ? call("PUT", `categories/${cat.id}`, body) : call("POST", "categories", body)));
          if (ok) {
            fresh.current = fresh.current.filter((k) => k !== image.key);
            dropUploads(fresh.current);
            fresh.current = [];
            onSaved();
          }
        }}
      >
        <Field label="Ad" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        {others.map((l) => (
          <Field
            key={l}
            label={`Ad (${LANG_NAMES[l] ?? l})`}
            hint="Boş qalsa əsas dildəki ad göstərilir"
            value={trGet(tr, l, "name")}
            onChange={(e) => setTr(trSet(tr, l, "name", e.target.value))}
          />
        ))}
        <Select label="Üst kateqoriya" value={parent} onChange={(e) => setParent(e.target.value)}>
          <option value="">— Yoxdur (əsas kateqoriya)</option>
          {parents.map((c) => (
            <option key={c.id} value={c.id}>
              {"  ".repeat(c.depth)}
              {c.depth ? "└ " : ""}
              {c.name}
            </option>
          ))}
        </Select>

        <div>
          <span className="mb-1.5 block text-[0.88rem] font-medium">Şəkil</span>
          <div className="flex items-center gap-3">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-tile text-ink-soft">
              {pic.busy ? <Spinner /> : image.url ? <img src={image.url} alt="" className="size-full object-cover" /> : <ImageIcon />}
            </span>
            <label className="pill pill-line h-10 cursor-pointer px-4 text-[0.88rem]">
              {image.url ? "Dəyiş" : "Şəkil seç"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const r = await pic.run(async () => uploadKey(await shrink(f, 800), "categories"));
                  if (r) {
                    fresh.current.push(r.key);
                    setImage({ key: r.key, url: r.url });
                  }
                }}
              />
            </label>
            {image.url && (
              <button type="button" className="text-[0.86rem] font-medium text-ink-soft" onClick={() => setImage({ key: null, url: null })}>
                Sil
              </button>
            )}
          </div>
          {pic.err && <div className="mt-2"><Notice>{pic.err}</Notice></div>}
        </div>

        <Toggle label="Mağazada görünsün" checked={active} onChange={setActive} />
        {cat && <Field label="Link" hint="Ünvanda görünən ad. Boş qalsa addan yaradılır" value={slug} onChange={(e) => setSlug(e.target.value)} />}

        {save.err && <Notice>{save.err}</Notice>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button className="pill pill-ink h-11 px-5" disabled={save.busy || pic.busy || !name.trim()}>
            {save.busy ? <Spinner /> : "Yadda saxla"}
          </button>
          <button type="button" className="pill pill-line h-11 px-5" onClick={close}>
            Ləğv et
          </button>
          {cat && (
            <ConfirmButton
              className="pill pill-line ml-auto h-11 px-4 text-danger"
              disabled={save.busy}
              onConfirm={async () => {
                if (await save.run(() => call("DELETE", `categories/${cat.id}`))) onSaved();
              }}
            >
              Sil
            </ConfirmButton>
          )}
        </div>
        {cat && (
          <p className="text-[0.8rem] text-ink-soft">
            Silinəndə məhsullar silinmir, sadəcə kateqoriyasız qalır. Alt kateqoriyalar bir pillə yuxarı keçir.
          </p>
        )}
      </form>
    </Card>
  );
}
