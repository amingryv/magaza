"use client";

import { useEffect, useRef, useState } from "react";
import { call } from "./api";
import {
  applies,
  chain,
  dropUploads,
  flatTree,
  fromCount,
  fromMoney,
  optHex,
  optValue,
  toMoney,
  trGet,
  trSet,
  uploadProductImage,
  LANG_NAMES,
  type AdminAttribute,
  type AdminProduct,
  type ImageRef,
  type Translations,
} from "./catalog";
import { BackIcon, CameraIcon, Card, Chip, ConfirmButton, DragIcon, IconBtn, PlusIcon, Select, Toggle, XIcon } from "./controls";
import { Field, Notice, Spinner, TextArea, useAction } from "./ui";
import { go, useShop } from "./Panel";
import { useCategories } from "./Categories";
import { useAttributes } from "./Attributes";

const MAX_IMAGES = 12;

type Var = { id: number | null; options: Record<string, string>; price: string; old_price: string; stock: string; sku: string; image: string | null };
type Form = {
  name: string;
  slug: string;
  description: string;
  category: string;
  price: string;
  old_price: string;
  stock: string;
  sku: string;
  images: ImageRef[];
  attrs: Record<string, unknown>;
  active: boolean;
  featured: boolean;
  tr: Translations | null;
  variants: Var[];
};

const EMPTY: Form = {
  name: "",
  slug: "",
  description: "",
  category: "",
  price: "",
  old_price: "",
  stock: "",
  sku: "",
  images: [],
  attrs: {},
  active: true,
  featured: false,
  tr: null,
  variants: [],
};

function fromProduct(p: AdminProduct): Form {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description ?? "",
    category: p.category_id ? String(p.category_id) : "",
    price: toMoney(p.price),
    old_price: toMoney(p.old_price),
    stock: p.stock == null ? "" : String(p.stock),
    sku: p.sku ?? "",
    images: p.images,
    attrs: p.attributes ?? {},
    active: p.is_active,
    featured: p.is_featured,
    tr: p.translations,
    variants: p.variants.map((v) => ({
      id: v.id,
      options: v.options,
      price: v.price == null || v.price === p.price ? "" : toMoney(v.price),
      old_price: toMoney(v.old_price),
      stock: v.stock == null ? "" : String(v.stock),
      sku: v.sku ?? "",
      image: v.image,
    })),
  };
}

const sig = (o: Record<string, string>, keys: string[]) => keys.map((k) => o[k] ?? "").join("\u0001");

export function ProductForm({ id }: { id: number | null }) {
  const shop = useShop();
  const cats = useCategories();
  const attrs = useAttributes();
  const [f, setF] = useState<Form | null>(id ? null : EMPTY);
  const [loadErr, setLoadErr] = useState("");
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const fresh = useRef<string[]>([]);
  const save = useAction();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    call<AdminProduct>("GET", `products/${id}`).then(
      (p) => {
        const form = fromProduct(p);
        setF(form);
        const pk: Record<string, string[]> = {};
        for (const v of form.variants) for (const [k, val] of Object.entries(v.options)) if (!(pk[k] ??= []).includes(val)) pk[k].push(val);
        setPicks(pk);
      },
      (e: Error) => setLoadErr(e.message),
    );
  }, [id]);

  // pictures uploaded here but never saved are removed when the form closes
  useEffect(() => () => dropUploads(fresh.current), []);

  if (loadErr)
    return (
      <div className="mx-auto max-w-[46rem] px-4 pt-6">
        <Notice>{loadErr}</Notice>
        <button className="pill pill-line mt-4 h-11 px-5" onClick={() => go("#/products")}>
          Siyahıya qayıt
        </button>
      </div>
    );
  if (!f || !cats.items || !attrs.items)
    return (
      <div className="grid min-h-[60dvh] place-items-center text-ink-soft">
        <Spinner />
      </div>
    );

  const set = (patch: Partial<Form>) => setF((x) => x && { ...x, ...patch });
  const path = chain(cats.items, f.category ? Number(f.category) : null);
  const own = attrs.items.filter((a) => applies(a, path));
  const plain = own.filter((a) => !a.is_variant);
  const vattrs = own.filter((a) => a.is_variant);
  const others = shop.languages.filter((l) => l !== shop.main);

  const submit = async () => {
    setDone(false);
    const price = fromMoney(f.price);
    const old = fromMoney(f.old_price);
    const stock = fromCount(f.stock);
    if (price === null || Number.isNaN(price)) return save.setErr("Qiyməti düzgün yazın (məs. 25 və ya 12.50)");
    if (Number.isNaN(old)) return save.setErr("Köhnə qiyməti düzgün yazın");
    if (Number.isNaN(stock)) return save.setErr("Stok tam rəqəm olmalıdır");
    const variants = [];
    for (const v of f.variants) {
      const vp = fromMoney(v.price);
      const vo = fromMoney(v.old_price);
      const vs = fromCount(v.stock);
      const label = Object.values(v.options).join(" / ");
      if (Number.isNaN(vp) || Number.isNaN(vo)) return save.setErr(`«${label}» variantının qiyməti yanlışdır`);
      if (Number.isNaN(vs)) return save.setErr(`«${label}» variantının stoku tam rəqəm olmalıdır`);
      variants.push({ id: v.id, options: v.options, price: vp, old_price: vo, stock: vs, sku: v.sku, image: v.image });
    }
    const body = {
      name: f.name,
      slug: f.slug,
      description: f.description,
      category_id: f.category ? Number(f.category) : null,
      price,
      old_price: old,
      stock,
      sku: f.sku,
      images: f.images.map((i) => i.key),
      attributes: f.attrs,
      is_active: f.active,
      is_featured: f.featured,
      translations: f.tr,
      variants,
    };
    const r = await save.run(() => (id ? call<{ slug: string }>("PUT", `products/${id}`, body) : call<{ id: number; slug: string }>("POST", "products", body)));
    if (!r) return;
    const kept = new Set(f.images.map((i) => i.key));
    dropUploads(fresh.current.filter((k) => !kept.has(k)));
    fresh.current = [];
    if (id) {
      set({ slug: r.slug });
      setDone(true);
    } else go("#/products");
  };

  return (
    <form
      className="pb-28"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <header className="sticky top-0 z-20 border-b border-ink-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[46rem] items-center gap-2 px-4">
          <IconBtn label="Geri" className="bg-paper-2" onClick={() => go("#/products")}>
            <BackIcon />
          </IconBtn>
          <h1 className="min-w-0 flex-1 truncate text-[1.1rem]">{id ? f.name || "Məhsul" : "Yeni məhsul"}</h1>
          {id && f.slug && (
            <a href={`/${shop.main}/p/?s=${encodeURIComponent(f.slug)}`} target="_blank" className="pill pill-soft h-9 shrink-0 px-3.5 text-[0.84rem]">
              Bax
            </a>
          )}
        </div>
      </header>

      <div className="mx-auto mt-4 grid max-w-[46rem] gap-4 px-4">
        <Images images={f.images} update={(fn) => setF((x) => x && { ...x, images: fn(x.images) })} onUploaded={(k) => fresh.current.push(k)} />

        <Card title="Əsas məlumat">
          <div className="grid gap-3.5">
            <Field label="Ad" value={f.name} onChange={(e) => set({ name: e.target.value })} required maxLength={200} />
            <Select label="Kateqoriya" value={f.category} onChange={(e) => set({ category: e.target.value })}>
              <option value="">— Kateqoriyasız</option>
              {flatTree(cats.items).map((c) => (
                <option key={c.id} value={c.id}>
                  {"  ".repeat(c.depth)}
                  {c.depth ? "└ " : ""}
                  {c.name}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Qiymət, ${shop.symbol}`} inputMode="decimal" placeholder="0" value={f.price} onChange={(e) => set({ price: e.target.value })} required />
              <Field label={`Köhnə qiymət, ${shop.symbol}`} inputMode="decimal" placeholder="endirim yoxdur" value={f.old_price} onChange={(e) => set({ old_price: e.target.value })} />
            </div>
            {f.variants.length === 0 && (
              <Field label="Stok (ədəd)" hint="Boş qalsa stok izlənmir və məhsul həmişə satışda olur" inputMode="numeric" value={f.stock} onChange={(e) => set({ stock: e.target.value })} />
            )}
            <TextArea label="Təsvir" rows={5} value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={20000} />
            <Field label="Məhsul kodu (istəyə görə)" value={f.sku} onChange={(e) => set({ sku: e.target.value })} maxLength={60} />
          </div>
        </Card>

        {plain.length > 0 && (
          <Card title="Xüsusiyyətlər" lead="Doldurulmayanlar mağazada göstərilmir">
            <div className="grid gap-3.5">
              {plain.map((a) => (
                <AttrInput
                  key={a.id}
                  attr={a}
                  value={f.attrs[a.key]}
                  onChange={(v) => {
                    const next = { ...f.attrs };
                    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) delete next[a.key];
                    else next[a.key] = v;
                    set({ attrs: next });
                  }}
                />
              ))}
            </div>
          </Card>
        )}

        {vattrs.length > 0 && (
          <Variants
            attrs={vattrs}
            picks={picks}
            setPicks={setPicks}
            variants={f.variants}
            onChange={(variants) => set({ variants })}
            images={f.images}
            price={f.price}
            symbol={shop.symbol}
          />
        )}

        {others.length > 0 && (
          <Card title="Tərcümə" lead="Boş qalsa əsas dildəki mətn göstərilir">
            <div className="grid gap-3.5">
              {others.map((l) => (
                <div key={l} className="grid gap-3">
                  <Field label={`Ad (${LANG_NAMES[l] ?? l})`} value={trGet(f.tr, l, "name")} onChange={(e) => set({ tr: trSet(f.tr, l, "name", e.target.value) })} />
                  <TextArea label={`Təsvir (${LANG_NAMES[l] ?? l})`} value={trGet(f.tr, l, "description")} onChange={(e) => set({ tr: trSet(f.tr, l, "description", e.target.value) })} />
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card title="Görünüş">
          <div className="grid gap-4">
            <Toggle label="Mağazada görünsün" checked={f.active} onChange={(active) => set({ active })} />
            <Toggle label="Ana səhifədə seçilmiş" hint="«Seçilmiş məhsullar» bölməsində çıxır" checked={f.featured} onChange={(featured) => set({ featured })} />
            {id && <Field label="Link" hint="Ünvanda görünən ad. Boş qalsa addan yaradılır" value={f.slug} onChange={(e) => set({ slug: e.target.value })} />}
          </div>
        </Card>

        {id && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="pill pill-line h-11 px-5"
              disabled={save.busy}
              onClick={async () => {
                const r = await save.run(() => call<{ id: number }>("POST", `products/${id}/copy`));
                if (r) go(`#/products/${r.id}`);
              }}
            >
              Kopyasını yarat
            </button>
            <ConfirmButton
              className="pill pill-line h-11 px-5 text-danger"
              confirm="Silinsin? Bir də basın"
              disabled={save.busy}
              onConfirm={async () => {
                if (await save.run(() => call("DELETE", `products/${id}`))) go("#/products");
              }}
            >
              Məhsulu sil
            </ConfirmButton>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-line bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto grid max-w-[46rem] gap-2">
          {save.err && <Notice>{save.err}</Notice>}
          {done && !save.err && <Notice tone="ok">Yadda saxlandı</Notice>}
          <div className="flex gap-2">
            <button type="button" className="pill pill-line h-12 px-5" onClick={() => go("#/products")}>
              {done ? "Siyahı" : "Ləğv et"}
            </button>
            <button className="pill pill-ink h-12 flex-1" disabled={save.busy || !f.name.trim()}>
              {save.busy ? <Spinner /> : "Yadda saxla"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* ── pictures: upload (gallery or camera), drag to reorder, first is the main one ── */

function Images({ images, update, onUploaded }: { images: ImageRef[]; update: (fn: (prev: ImageRef[]) => ImageRef[]) => void; onUploaded: (key: string) => void }) {
  const onChange = (v: ImageRef[]) => update(() => v);
  const [pending, setPending] = useState(0);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState<number | null>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    const list = [...files].slice(0, Math.max(0, MAX_IMAGES - images.length - pending));
    if (list.length < files.length) setErr(`Ən çox ${MAX_IMAGES} şəkil`);
    setPending((n) => n + list.length);
    for (const file of list) {
      try {
        const img = await uploadProductImage(file);
        onUploaded(img.key);
        update((prev) => [...prev, img]);
      } catch (e) {
        setErr((e as Error).message || "Şəkil yüklənmədi");
      } finally {
        setPending((n) => n - 1);
      }
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (drag === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-img]");
    const to = el ? Number(el.dataset.img) : -1;
    if (to < 0 || to === drag) return;
    const next = [...images];
    const [it] = next.splice(drag, 1);
    next.splice(to, 0, it);
    onChange(next);
    setDrag(to);
  };

  return (
    <Card title="Şəkillər" lead="Birinci şəkil əsasdır. Sıranı dəyişmək üçün ⠿ işarəsindən tutub sürüşdürün">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
        {images.map((img, i) => (
          <li
            key={img.key}
            data-img={i}
            className={`relative aspect-square overflow-hidden rounded-[14px] bg-tile transition-opacity ${drag === i ? "opacity-60 outline outline-2 outline-ink" : ""}`}
          >
            <img src={img.thumb} alt="" className="pointer-events-none size-full select-none object-cover" draggable={false} />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[0.7rem] font-semibold text-paper">Əsas</span>}
            <button
              type="button"
              aria-label="Şəkli sil"
              className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-paper/90 text-ink"
              onClick={() => onChange(images.filter((x) => x.key !== img.key))}
            >
              <XIcon />
            </button>
            <span
              role="button"
              aria-label="Sürüşdür"
              className="absolute bottom-1.5 right-1.5 grid size-8 cursor-grab touch-none place-items-center rounded-full bg-paper/90 text-ink active:cursor-grabbing"
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget.closest("ul") as HTMLElement).setPointerCapture(e.pointerId);
                setDrag(i);
              }}
            >
              <DragIcon />
            </span>
            {i > 0 && (
              <button
                type="button"
                className="absolute bottom-1.5 left-1.5 rounded-full bg-paper/90 px-2 py-1 text-[0.7rem] font-semibold"
                onClick={() => onChange([img, ...images.filter((x) => x.key !== img.key)])}
              >
                Əsas et
              </button>
            )}
          </li>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <li key={`p${i}`} className="grid aspect-square place-items-center rounded-[14px] bg-tile text-ink-soft">
            <Spinner />
          </li>
        ))}
      </ul>
      {images.length + pending < MAX_IMAGES && (
        <div className={`flex flex-wrap gap-2 ${images.length + pending ? "mt-3" : ""}`}>
          <label className="pill pill-ink h-11 cursor-pointer px-5 text-[0.9rem]">
            <PlusIcon /> Şəkil əlavə et
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                void add(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label className="pill pill-line h-11 cursor-pointer px-5 text-[0.9rem]">
            <CameraIcon /> Kamera
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                void add(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
      {err && (
        <div className="mt-3">
          <Notice>{err}</Notice>
        </div>
      )}
    </Card>
  );
}

/* ── one field per attribute type ── */

function AttrInput({ attr: a, value, onChange }: { attr: AdminAttribute; value: unknown; onChange: (v: unknown) => void }) {
  const label = a.unit ? `${a.name} (${a.unit})` : a.name;
  const str = typeof value === "string" || typeof value === "number" ? String(value) : "";

  if (a.type === "boolean")
    return (
      <Select label={label} value={value === true ? "1" : value === false ? "0" : ""} onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value === "1")}>
        <option value="">—</option>
        <option value="1">Bəli</option>
        <option value="0">Xeyr</option>
      </Select>
    );

  if (a.type === "number")
    return (
      <Field
        label={label}
        inputMode="decimal"
        value={str}
        onChange={(e) => {
          const t = e.target.value.replace(",", ".");
          onChange(t === "" ? undefined : Number.isFinite(Number(t)) && !t.endsWith(".") ? Number(t) : t);
        }}
      />
    );

  if ((a.type === "select" || a.type === "color") && a.options.length === 0) return <Field label={label} value={str} onChange={(e) => onChange(e.target.value)} />;

  if (a.type === "select")
    return (
      <Select label={label} value={str} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">—</option>
        {/* a stored value no longer among the options stays selectable */}
        {str && !a.options.some((o) => optValue(o) === str) && <option value={str}>{str}</option>}
        {a.options.map((o) => (
          <option key={optValue(o)} value={optValue(o)}>
            {optValue(o)}
          </option>
        ))}
      </Select>
    );

  if (a.type === "multiselect" || a.type === "color") {
    const list = a.type === "multiselect" ? (Array.isArray(value) ? (value as string[]) : str ? [str] : []) : str ? [str] : [];
    return (
      <div>
        <span className="mb-1.5 block text-[0.88rem] font-medium">{label}</span>
        <div className="flex flex-wrap gap-2">
          {a.options.map((o) => {
            const v = optValue(o);
            const on = list.includes(v);
            return (
              <Chip
                key={v}
                on={on}
                swatch={a.type === "color" ? (optHex(o) ?? "#ccc") : undefined}
                onClick={() => (a.type === "color" ? onChange(on ? undefined : v) : onChange(on ? list.filter((x) => x !== v) : [...list, v]))}
              >
                {v}
              </Chip>
            );
          })}
        </div>
      </div>
    );
  }

  return <Field label={label} value={str} onChange={(e) => onChange(e.target.value)} maxLength={300} />;
}

/* ── variants: pick values per attribute → every combination becomes a row ── */

function Variants({
  attrs,
  picks,
  setPicks,
  variants,
  onChange,
  images,
  price,
  symbol,
}: {
  attrs: AdminAttribute[];
  picks: Record<string, string[]>;
  setPicks: (p: Record<string, string[]>) => void;
  variants: Var[];
  onChange: (v: Var[]) => void;
  images: ImageRef[];
  price: string;
  symbol: string;
}) {
  const [warn, setWarn] = useState("");

  const toggle = (key: string, v: string) => {
    const cur = picks[key] ?? [];
    setPicks({ ...picks, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };

  const build = () => {
    setWarn("");
    const used = attrs.filter((a) => (picks[a.key] ?? []).length);
    if (!used.length) return onChange([]);
    let combos: Record<string, string>[] = [{}];
    for (const a of used) {
      const order = a.options.map(optValue);
      const vals = [...(picks[a.key] ?? [])].sort((x, y) => order.indexOf(x) - order.indexOf(y));
      combos = combos.flatMap((c) => vals.map((v) => ({ ...c, [a.key]: v })));
    }
    if (combos.length > 200) return setWarn(`${combos.length} variant alınır, ən çox 200 ola bilər`);
    const keys = used.map((a) => a.key);
    // rows that already exist keep their stock, price and id
    const old = new Map(variants.map((v) => [sig(v.options, keys), v]));
    onChange(combos.map((o) => {
      const prev = old.get(sig(o, keys));
      return prev ? { ...prev, options: o } : { id: null, options: o, price: "", old_price: "", stock: "", sku: "", image: null };
    }));
  };

  const patch = (i: number, p: Partial<Var>) => onChange(variants.map((v, j) => (j === i ? { ...v, ...p } : v)));
  const names = new Map(attrs.map((a) => [a.key, a.name]));

  return (
    <Card title="Variantlar" lead="Məs. ölçü və rəng seçin, «Variantları yarat» basın. Hər birinə ayrıca stok və qiymət yaza bilərsiniz">
      <div className="grid gap-4">
        {attrs.map((a) => (
          <div key={a.id}>
            <span className="mb-1.5 block text-[0.88rem] font-medium">{a.unit ? `${a.name} (${a.unit})` : a.name}</span>
            {a.options.length ? (
              <div className="flex flex-wrap gap-2">
                {a.options.map((o) => (
                  <Chip key={optValue(o)} on={(picks[a.key] ?? []).includes(optValue(o))} swatch={a.type === "color" ? (optHex(o) ?? "#ccc") : undefined} onClick={() => toggle(a.key, optValue(o))}>
                    {optValue(o)}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-[0.84rem] text-ink-soft">Bu xüsusiyyətin seçimi yoxdur. «Xüsusiyyətlər» bölməsində əlavə edin.</p>
            )}
          </div>
        ))}
        <button type="button" className="pill pill-soft h-11 justify-self-start px-5 outline outline-1 -outline-offset-1 outline-ink-line-2" onClick={build}>
          Variantları yarat
        </button>
        {warn && <Notice>{warn}</Notice>}

        {variants.length > 0 && (
          <ul className="grid gap-2">
            {variants.map((v, i) => (
              <li key={sig(v.options, Object.keys(v.options)) + (v.id ?? "")} className="rounded-[16px] bg-paper p-3">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold" title={Object.entries(v.options).map(([k, x]) => `${names.get(k) ?? k}: ${x}`).join(", ")}>
                    {Object.values(v.options).join(" / ")}
                  </span>
                  <IconBtn label="Variantı sil" className="bg-paper-2" onClick={() => onChange(variants.filter((_, j) => j !== i))}>
                    <XIcon />
                  </IconBtn>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MiniField label={`Qiymət, ${symbol}`} placeholder={price || "0"} inputMode="decimal" value={v.price} onChange={(x) => patch(i, { price: x })} />
                  <MiniField label="Stok" placeholder="izlənmir" inputMode="numeric" value={v.stock} onChange={(x) => patch(i, { stock: x })} />
                  <MiniField label="Kod" placeholder="—" value={v.sku} onChange={(x) => patch(i, { sku: x })} />
                  <label className="block">
                    <span className="mb-1 block text-[0.76rem] font-medium text-ink-soft">Şəkil</span>
                    <select className="field !h-11 !rounded-[12px] !px-3 text-[0.9rem]" value={v.image ?? ""} onChange={(e) => patch(i, { image: e.target.value || null })}>
                      <option value="">Əsas şəkil</option>
                      {images.map((img, n) => (
                        <option key={img.key} value={img.key}>
                          Şəkil {n + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
        {variants.length > 0 && <p className="text-[0.8rem] text-ink-soft">Qiymət boş qalsa məhsulun qiyməti götürülür. Stok boş qalsa izlənmir.</p>}
      </div>
    </Card>
  );
}

function MiniField({
  label,
  value,
  onChange,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.76rem] font-medium text-ink-soft">{label}</span>
      <input className="field !h-11 !rounded-[12px] !px-3 text-[0.9rem]" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
  );
}
