"use client";

import { useEffect, useRef, useState } from "react";
import { call } from "./api";
import { flatTree, toMoney, type ProductRow } from "./catalog";
import { ConfirmButton, ImageIcon, PlusIcon, Select } from "./controls";
import { Notice, Spinner, useAction } from "./ui";
import { go, useShop } from "./Panel";
import { useCategories } from "./Categories";

type List = { items: ProductRow[]; total: number; page: number; limit: number };

/** Product list: search, category and status filters, "load more", bulk actions. */
export function Products() {
  const shop = useShop();
  const cats = useCategories();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [list, setList] = useState<List | null>(null);
  const [err, setErr] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [moveTo, setMoveTo] = useState("");
  const bulk = useAction();
  const seq = useRef(0);

  const query = (page: number) => {
    const p = new URLSearchParams({ page: String(page), limit: "30" });
    if (q.trim()) p.set("q", q.trim());
    if (cat) p.set("category", cat);
    if (status) p.set("status", status);
    return call<List>("GET", `products?${p}`);
  };

  const reload = () => {
    const n = ++seq.current;
    query(1).then(
      (r) => n === seq.current && (setList(r), setErr("")),
      (e: Error) => n === seq.current && setErr(e.message),
    );
  };

  // search waits for typing to pause
  useEffect(() => {
    const t = setTimeout(reload, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cat, status]);

  const more = async () => {
    if (!list) return;
    setLoadingMore(true);
    try {
      const r = await query(list.page + 1);
      setList({ ...r, items: [...list.items, ...r.items.filter((x) => !list.items.some((y) => y.id === x.id))] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (id: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    if (await bulk.run(() => call("POST", "products/bulk", { ids: [...sel], action, ...extra }))) {
      setSel(new Set());
      reload();
    }
  };

  const setActive = async (p: ProductRow, on: boolean) => {
    setList((l) => l && { ...l, items: l.items.map((x) => (x.id === p.id ? { ...x, is_active: on } : x)) });
    await bulk.run(() => call("POST", "products/bulk", { ids: [p.id], action: on ? "activate" : "deactivate" }));
  };

  const tree = cats.items ? flatTree(cats.items) : [];
  const catName = new Map(tree.map((c) => [c.id, c.name]));
  const all = !!list?.items.length && list.items.every((p) => sel.has(p.id));

  return (
    <div className="mx-auto grid w-full max-w-[46rem] gap-3 px-4">
      <div className="flex gap-2">
        <input type="search" className="field" placeholder="Ad və ya kodla axtar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Axtarış" />
        <button className="pill pill-ink h-[3.3rem] shrink-0 px-4" onClick={() => go("#/products/new")}>
          <PlusIcon />
          <span className="max-sm:sr-only">Məhsul əlavə et</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select aria-label="Kateqoriya" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Bütün kateqoriyalar</option>
          {tree.map((c) => (
            <option key={c.id} value={c.id}>
              {"  ".repeat(c.depth)}
              {c.name}
            </option>
          ))}
          <option value="none">Kateqoriyasız</option>
        </Select>
        <Select aria-label="Vəziyyət" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Hamısı</option>
          <option value="active">Görünənlər</option>
          <option value="inactive">Gizlədilənlər</option>
        </Select>
      </div>

      {err && <Notice>{err}</Notice>}
      {bulk.err && <Notice>{bulk.err}</Notice>}

      {!list ? (
        !err && (
          <div className="grid place-items-center py-16 text-ink-soft">
            <Spinner />
          </div>
        )
      ) : list.items.length === 0 ? (
        <div className="rounded-[20px] bg-paper-2 p-6 text-center">
          <p className="text-[0.95rem] text-ink-soft">{q || cat || status ? "Heç nə tapılmadı" : "Hələ məhsul yoxdur"}</p>
          {!q && !cat && !status && (
            <button className="pill pill-ink mt-4 h-11 px-5" onClick={() => go("#/products/new")}>
              İlk məhsulu əlavə et
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-1 text-[0.85rem] text-ink-soft">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="size-[1.1rem] accent-ink"
                checked={all}
                onChange={() => setSel(all ? new Set() : new Set(list.items.map((p) => p.id)))}
              />
              Hamısını seç
            </label>
            <span>{list.total} məhsul</span>
          </div>

          <ul className="overflow-hidden rounded-[20px] bg-paper-2">
            {list.items.map((p, i) => (
              <li key={p.id} className={`flex items-center gap-3 px-3 py-2.5 ${i ? "border-t border-ink-line" : ""}`}>
                <input type="checkbox" aria-label={`${p.name} seç`} className="size-[1.1rem] shrink-0 accent-ink" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />
                <a href={`#/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-tile text-ink-soft">
                    {p.thumb ? <img src={p.thumb} alt="" loading="lazy" className="size-full object-cover" /> : <ImageIcon />}
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate font-medium ${p.is_active ? "" : "text-ink-soft"}`}>{p.name}</span>
                    <span className="block truncate text-[0.8rem] text-ink-soft">
                      {toMoney(p.price)} {shop.symbol}
                      {" · "}
                      {p.stock === null ? "stok izlənmir" : p.stock > 0 ? `${p.stock} ədəd` : <span className="text-danger">stokda yoxdur</span>}
                      {p.variants > 0 && ` · ${p.variants} variant`}
                      {p.category_id && catName.get(p.category_id) ? ` · ${catName.get(p.category_id)}` : ""}
                      {p.is_featured && " · ★"}
                    </span>
                  </span>
                </a>
                <label className="flex shrink-0 cursor-pointer items-center" title={p.is_active ? "Görünür" : "Gizlidir"}>
                  <input type="checkbox" role="switch" className="peer sr-only" checked={p.is_active} onChange={(e) => setActive(p, e.target.checked)} aria-label={`${p.name} mağazada görünsün`} />
                  <span aria-hidden className={`relative h-6 w-10 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${p.is_active ? "bg-ink" : "bg-ink-line-2"}`}>
                    <span className={`absolute top-1 size-4 rounded-full bg-paper transition-[left] duration-200 ${p.is_active ? "left-5" : "left-1"}`} />
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {list.items.length < list.total && (
            <button className="pill pill-soft mx-auto h-11 px-6" onClick={more} disabled={loadingMore}>
              {loadingMore ? <Spinner /> : `Daha çox (${list.total - list.items.length})`}
            </button>
          )}
        </>
      )}

      {sel.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-line bg-paper px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto grid max-w-[46rem] gap-2">
            <div className="flex items-center justify-between text-[0.88rem]">
              <span className="font-medium">{sel.size} seçildi</span>
              <button className="text-ink-soft" onClick={() => setSel(new Set())}>
                Seçimi ləğv et
              </button>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              <button className="pill pill-soft h-10 shrink-0 px-4 text-[0.86rem]" disabled={bulk.busy} onClick={() => run("activate")}>
                Göstər
              </button>
              <button className="pill pill-soft h-10 shrink-0 px-4 text-[0.86rem]" disabled={bulk.busy} onClick={() => run("deactivate")}>
                Gizlət
              </button>
              <button className="pill pill-soft h-10 shrink-0 px-4 text-[0.86rem]" disabled={bulk.busy} onClick={() => run("feature")}>
                Ana səhifəyə ★
              </button>
              <button className="pill pill-soft h-10 shrink-0 px-4 text-[0.86rem]" disabled={bulk.busy} onClick={() => run("unfeature")}>
                ★ götür
              </button>
              <ConfirmButton className="pill pill-soft h-10 shrink-0 px-4 text-[0.86rem] text-danger" confirm="Silinsin?" disabled={bulk.busy} onConfirm={() => run("delete")}>
                Sil
              </ConfirmButton>
            </div>
            <div className="flex gap-2">
              <Select aria-label="Kateqoriyaya köçür" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="">Kateqoriyaya köçür...</option>
                {tree.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"  ".repeat(c.depth)}
                    {c.name}
                  </option>
                ))}
                <option value="none">Kateqoriyasız</option>
              </Select>
              <button
                className="pill pill-ink h-[3.3rem] shrink-0 px-4"
                disabled={!moveTo || bulk.busy}
                onClick={async () => {
                  await run("category", { category_id: moveTo === "none" ? null : Number(moveTo) });
                  setMoveTo("");
                }}
              >
                Köçür
              </button>
            </div>
          </div>
        </div>
      )}
      {sel.size > 0 && <div className="h-44" aria-hidden />}
    </div>
  );
}
