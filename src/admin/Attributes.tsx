"use client";

import { useCallback, useEffect, useState } from "react";
import { call } from "./api";
import {
  flatTree,
  optHex,
  optValue,
  trGet,
  trSet,
  LANG_NAMES,
  TYPE_NAMES,
  type AdminAttribute,
  type AdminCategory,
  type AttributeOption,
  type AttributeType,
  type Translations,
} from "./catalog";
import { Card, Chip, ConfirmButton, DownIcon, IconBtn, PlusIcon, Select, Toggle, UpIcon, XIcon } from "./controls";
import { Field, Notice, Spinner, useAction } from "./ui";
import { useShop } from "./Panel";
import { useCategories } from "./Categories";

export function useAttributes() {
  const [items, setItems] = useState<AdminAttribute[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(
    () =>
      call<{ items: AdminAttribute[] }>("GET", "attributes").then(
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

const WITH_OPTIONS: AttributeType[] = ["select", "multiselect", "color"];

export function Attributes() {
  const { items, err, load } = useAttributes();
  const cats = useCategories();
  const [open, setOpen] = useState<number | "new" | null>(null);
  const moving = useAction();

  if (!items || !cats.items)
    return <div className="grid place-items-center py-16 text-ink-soft">{err || cats.err ? <Notice>{err || cats.err}</Notice> : <Spinner />}</div>;

  const move = async (i: number, dir: -1 | 1) => {
    const order = items.map((a) => a.id);
    const j = i + dir;
    [order[i], order[j]] = [order[j], order[i]];
    await moving.run(() => call("POST", "attributes/reorder", { ids: order }));
    await load();
  };
  const done = async () => {
    setOpen(null);
    await load();
  };

  return (
    <div className="mx-auto grid w-full max-w-[46rem] gap-4 px-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.88rem] text-ink-soft">Ölçü, rəng, material kimi məhsul məlumatları</p>
        <button className="pill pill-ink h-10 shrink-0 px-4 text-[0.88rem]" onClick={() => setOpen("new")}>
          <PlusIcon /> Yeni
        </button>
      </div>
      {moving.err && <Notice>{moving.err}</Notice>}
      {open === "new" && <AttributeForm cats={cats.items} onClose={() => setOpen(null)} onSaved={done} />}

      {items.length === 0 && open !== "new" && (
        <p className="rounded-[20px] bg-paper-2 p-5 text-[0.92rem] text-ink-soft">Hələ xüsusiyyət yoxdur. «Yeni» düyməsi ilə əlavə edin.</p>
      )}

      {items.length > 0 && (
        <ul className="overflow-hidden rounded-[20px] bg-paper-2">
          {items.map((a, i) => (
            <li key={a.id} className={i ? "border-t border-ink-line" : ""}>
              {open === a.id ? (
                <div className="p-2">
                  <AttributeForm cats={cats.items!} attr={a} onClose={() => setOpen(null)} onSaved={done} />
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(a.id)}>
                    <span className="block truncate font-medium">
                      {a.name}
                      {a.unit && <span className="font-normal text-ink-soft"> ({a.unit})</span>}
                    </span>
                    <span className="block text-[0.8rem] text-ink-soft">
                      {[TYPE_NAMES[a.type], a.filterable && "filtr", a.is_variant && "variant", a.category_ids.length && `${a.category_ids.length} kateqoriya`]
                        .filter(Boolean)
                        .join(" · ")}
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

function AttributeForm({
  cats,
  attr,
  onClose,
  onSaved,
}: {
  cats: AdminCategory[];
  attr?: AdminAttribute;
  onClose: () => void;
  onSaved: () => void;
}) {
  const shop = useShop();
  const [name, setName] = useState(attr?.name ?? "");
  const [type, setType] = useState<AttributeType>(attr?.type ?? "select");
  const [options, setOptions] = useState<AttributeOption[]>(attr?.options ?? []);
  const [unit, setUnit] = useState(attr?.unit ?? "");
  const [filterable, setFilterable] = useState(attr?.filterable ?? true);
  const [variant, setVariant] = useState(attr?.is_variant ?? false);
  const [catIds, setCatIds] = useState<number[]>(attr?.category_ids ?? []);
  const [tr, setTr] = useState<Translations | null>(attr?.translations ?? null);
  const [draft, setDraft] = useState("");
  const [hex, setHex] = useState("#111111");
  const save = useAction();
  const others = shop.languages.filter((l) => l !== shop.main);
  const canVariant = type === "select" || type === "color";

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    // "S, M, L" adds three at once
    const vals = v.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
    setOptions((o) => {
      const have = new Set(o.map(optValue));
      return [...o, ...vals.filter((x) => !have.has(x)).map((x) => (type === "color" ? { value: x, hex } : x))];
    });
    setDraft("");
  };

  return (
    <Card title={attr ? "Xüsusiyyəti redaktə et" : "Yeni xüsusiyyət"}>
      <form
        className="grid gap-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = {
            name,
            type,
            options: WITH_OPTIONS.includes(type) ? options.map((o) => (type === "color" ? (typeof o === "string" ? { value: o } : o) : optValue(o))) : [],
            unit,
            filterable,
            is_variant: canVariant && variant,
            category_ids: catIds,
            translations: tr,
          };
          if (await save.run(() => (attr ? call("PUT", `attributes/${attr.id}`, body) : call("POST", "attributes", body)))) onSaved();
        }}
      >
        <Field label="Ad" placeholder="məs. Ölçü" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
        {others.map((l) => (
          <Field key={l} label={`Ad (${LANG_NAMES[l] ?? l})`} value={trGet(tr, l, "name")} onChange={(e) => setTr(trSet(tr, l, "name", e.target.value))} />
        ))}
        <Select label="Növ" value={type} onChange={(e) => setType(e.target.value as AttributeType)}>
          {(Object.keys(TYPE_NAMES) as AttributeType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_NAMES[t]}
            </option>
          ))}
        </Select>

        {WITH_OPTIONS.includes(type) && (
          <div>
            <span className="mb-1.5 block text-[0.88rem] font-medium">Seçimlər</span>
            {options.length > 0 && (
              <ul className="mb-2.5 flex flex-wrap gap-2">
                {options.map((o, i) => (
                  <li key={optValue(o)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-paper pl-2 pr-1 text-[0.88rem] font-medium">
                    {type === "color" && (
                      <input
                        type="color"
                        aria-label={`${optValue(o)} rəngi`}
                        value={optHex(o) ?? "#cccccc"}
                        onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? { value: optValue(x), hex: e.target.value } : x)))}
                        className="size-6 cursor-pointer rounded-full"
                      />
                    )}
                    <span className={type === "color" ? "" : "pl-1.5"}>{optValue(o)}</span>
                    <button
                      type="button"
                      aria-label={`${optValue(o)} sil`}
                      className="grid size-7 place-items-center rounded-full text-ink-soft hover:bg-paper-3"
                      onClick={() => setOptions((all) => all.filter((_, j) => j !== i))}
                    >
                      <XIcon />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              {type === "color" && <input type="color" aria-label="Yeni rəng" value={hex} onChange={(e) => setHex(e.target.value)} className="size-[3.3rem] shrink-0 cursor-pointer rounded-[14px]" />}
              <input
                className="field"
                placeholder={type === "color" ? "məs. Qırmızı" : "məs. S, M, L"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <button type="button" className="pill pill-soft h-[3.3rem] shrink-0 px-4" onClick={add} disabled={!draft.trim()}>
                Əlavə et
              </button>
            </div>
            <p className="mt-1.5 text-[0.8rem] text-ink-soft">Bir neçəsini vergüllə yaza bilərsiniz.</p>
          </div>
        )}

        {(type === "number" || type === "select") && (
          <Field label="Ölçü vahidi (istəyə görə)" placeholder="sm, ml, kq..." value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} />
        )}

        <Toggle label="Mağazada filtr kimi göstər" checked={filterable} onChange={setFilterable} />
        <Toggle
          label="Variant yaradır"
          hint={canVariant ? "Müştəri məhsulda bunu seçir (ölçü, rəng). Hər variantın öz stoku və qiyməti ola bilər" : "Yalnız «Siyahıdan seçim» və «Rəng» növündə"}
          checked={canVariant && variant}
          disabled={!canVariant}
          onChange={setVariant}
        />

        {cats.length > 0 && (
          <div>
            <span className="mb-1.5 block text-[0.88rem] font-medium">Hansı kateqoriyalarda</span>
            <div className="flex flex-wrap gap-2">
              <Chip on={!catIds.length} onClick={() => setCatIds([])}>
                Hamısında
              </Chip>
              {flatTree(cats).map((c) => (
                <Chip key={c.id} on={catIds.includes(c.id)} onClick={() => setCatIds((ids) => (ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id]))}>
                  {c.name}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-[0.8rem] text-ink-soft">Üst kateqoriya seçiləndə alt kateqoriyalara da aiddir.</p>
          </div>
        )}

        {save.err && <Notice>{save.err}</Notice>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button className="pill pill-ink h-11 px-5" disabled={save.busy || !name.trim()}>
            {save.busy ? <Spinner /> : "Yadda saxla"}
          </button>
          <button type="button" className="pill pill-line h-11 px-5" onClick={onClose}>
            Ləğv et
          </button>
          {attr && (
            <ConfirmButton
              className="pill pill-line ml-auto h-11 px-4 text-danger"
              disabled={save.busy}
              onConfirm={async () => {
                if (await save.run(() => call("DELETE", `attributes/${attr.id}`))) onSaved();
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
