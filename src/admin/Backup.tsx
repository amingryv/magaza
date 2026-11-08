"use client";

import { useState } from "react";
import { ApiError, call } from "./api";
import { useAttributes } from "./Attributes";
import { Card, ConfirmButton } from "./controls";
import { download, productsCsv, readSheet, templateCsv, type ExportRow, type Parsed } from "./csv";
import { Notice, Spinner, useAction } from "./ui";

const day = () => new Date().toISOString().slice(0, 10);
const NAMES: Record<string, string> = {
  products: "məhsul",
  categories: "kateqoriya",
  attributes: "xüsusiyyət",
  orders: "sifariş",
  pages: "səhifə",
};

type BackupFile = { format: string; created_at?: string; tables: Record<string, unknown[]> };

export function Backup() {
  return (
    <div className="mx-auto grid w-full max-w-[46rem] gap-4 px-4">
      <SaveBackup />
      <Restore />
      <Sheet />
    </div>
  );
}

function SaveBackup() {
  const a = useAction();
  return (
    <Card title="Ehtiyat nüsxə" lead="Məhsullar, kateqoriyalar, sifarişlər, səhifələr və ayarlar bir fayla yazılır. Ayda bir dəfə yükləyib saxlamağınız tövsiyə olunur.">
      <button
        className="pill pill-ink h-11 px-5"
        disabled={a.busy}
        onClick={() =>
          a.run(async () => {
            const data = await call<unknown>("GET", "export");
            download(JSON.stringify(data), `magaza-${day()}.json`, "application/json");
          })
        }
      >
        {a.busy ? <Spinner /> : "Ehtiyat nüsxəni yüklə"}
      </button>
      {a.err && <div className="mt-3"><Notice>{a.err}</Notice></div>}
      <p className="mt-3 text-[0.8rem] text-ink-soft">
        Şəkillər faylın içində deyil, onlar mağazanın öz anbarında qalır. Admin şifrəsi və Telegram açarı da təhlükəsizlik üçün fayla yazılmır.
      </p>
    </Card>
  );
}

function Restore() {
  const [file, setFile] = useState<BackupFile | null>(null);
  const [done, setDone] = useState("");
  const a = useAction();
  const counts = file ? Object.entries(NAMES).map(([t, n]) => `${(file.tables[t] ?? []).length} ${n}`) : [];

  return (
    <Card title="Ehtiyat nüsxədən bərpa" lead="Hazırkı məhsullar, sifarişlər və ayarlar fayldakılarla əvəz olunur.">
      <label className="pill pill-line h-11 cursor-pointer px-5">
        Fayl seç (.json)
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            setDone("");
            setFile(null);
            if (!f) return;
            await a.run(async () => {
              let data: BackupFile;
              try {
                data = JSON.parse(await f.text());
              } catch {
                throw new ApiError(0, "Fayl oxunmadı");
              }
              if (data?.format !== "magaza-backup" || !data.tables) throw new ApiError(0, "Bu fayl mağazanın ehtiyat nüsxəsi deyil");
              setFile(data);
            });
          }}
        />
      </label>

      {file && (
        <div className="mt-4 grid gap-3">
          <Notice tone="info">
            {file.created_at ? `${new Date(file.created_at).toLocaleString("az")} tarixli nüsxə: ` : ""}
            {counts.join(", ")}.
          </Notice>
          <ConfirmButton
            className="pill pill-ink h-11 justify-self-start px-5"
            confirm="Hazırkı məlumatlar silinəcək. Bir də basın"
            disabled={a.busy}
            onConfirm={() =>
              a.run(async () => {
                await call("POST", "import", file);
                setFile(null);
                setDone("Bərpa olundu. Səhifəni yeniləyin.");
              })
            }
          >
            {a.busy ? <Spinner /> : "Bərpa et"}
          </ConfirmButton>
        </div>
      )}
      {a.err && <div className="mt-3"><Notice>{a.err}</Notice></div>}
      {done && <div className="mt-3"><Notice tone="ok">{done}</Notice></div>}
    </Card>
  );
}

type Result = { created: number; updated: number; categories: number; errors: { line: number; error: string }[] };

function Sheet() {
  const attrs = useAttributes();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const a = useAction();
  const list = attrs.items ?? [];

  const send = () =>
    a.run(async () => {
      if (!parsed) return;
      const res: Result = { created: 0, updated: 0, categories: 0, errors: [...parsed.errors] };
      const size = 100;
      try {
        for (let i = 0; i < parsed.rows.length; i += size) {
          setProgress(`${Math.min(i + size, parsed.rows.length)} / ${parsed.rows.length}`);
          const r = await call<{ created: number; updated: number; categories_created: number; errors: Result["errors"] }>("POST", "import/products", {
            rows: parsed.rows.slice(i, i + size),
          });
          res.created += r.created;
          res.updated += r.updated;
          res.categories += r.categories_created;
          res.errors.push(...r.errors);
        }
      } finally {
        res.errors.sort((x, y) => x.line - y.line);
        setResult(res);
        setParsed(null);
        setProgress("");
      }
    });

  return (
    <Card title="Excel (CSV) ilə məhsullar" lead="Çoxlu məhsulu bir dəfəyə əlavə edin və ya qiymətləri, stoku cədvəldə dəyişib geri yükləyin.">
      <div className="flex flex-wrap gap-2">
        <button className="pill pill-line h-10 px-4 text-[0.88rem]" disabled={!attrs.items} onClick={() => download(templateCsv(list), "mehsullar-sablon.csv")}>
          Nümunə şablon
        </button>
        <button
          className="pill pill-line h-10 px-4 text-[0.88rem]"
          disabled={!attrs.items || a.busy}
          onClick={() =>
            a.run(async () => {
              const r = await call<{ items: ExportRow[] }>("GET", "export/products");
              download(productsCsv(r.items, list), `mehsullar-${day()}.csv`);
            })
          }
        >
          Bütün məhsulları yüklə
        </button>
        <label className={`pill pill-ink h-10 px-4 text-[0.88rem] ${attrs.items ? "cursor-pointer" : "pointer-events-none opacity-40"}`}>
          CSV faylı seç
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              setResult(null);
              if (f) setParsed(readSheet(await f.text(), list));
            }}
          />
        </label>
      </div>

      <ul className="mt-4 grid gap-1 text-[0.8rem] text-ink-soft">
        <li>• «Link» və ya «Kod» sütunu mağazadakı məhsulla eyni olan sətir o məhsulu yeniləyir, qalanları yeni məhsul kimi əlavə olunur. Ən rahatı: «Bütün məhsulları yüklə», Excel-də dəyiş, geri yüklə.</li>
        <li>• Faylda olmayan sütuna toxunulmur. Xananı boşaltsanız, o məlumat silinir (məs. köhnə qiymət).</li>
        <li>• Qiymət manatla: 12.50 və ya 12,50. Bir neçə seçim: Qırmızı | Mavi. Bəli/xeyr sütunları: bəli və ya xeyr.</li>
        <li>• Olmayan kateqoriya avtomatik yaradılır. Şəkil və variantları məhsulun öz səhifəsində əlavə edin.</li>
      </ul>

      {parsed && (
        <div className="mt-4 grid gap-3">
          {parsed.known.length ? (
            <Notice tone="info">
              {parsed.rows.length} məhsul tapıldı. Sütunlar: {parsed.known.join(", ")}.
              {parsed.unknown.length > 0 && ` Tanınmayan (nəzərə alınmayacaq): ${parsed.unknown.join(", ")}.`}
              {parsed.errors.length > 0 && ` ${parsed.errors.length} sətirdə xəta var, onlar keçiləcək.`}
            </Notice>
          ) : (
            <Notice>Faylda tanış sütun tapılmadı. Nümunə şablonu yükləyib ona uyğun doldurun.</Notice>
          )}
          {parsed.rows.length > 0 && parsed.known.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button className="pill pill-ink h-11 px-5" disabled={a.busy} onClick={send}>
                {a.busy ? <Spinner /> : "İdxal et"}
              </button>
              <button className="pill pill-line h-11 px-5" disabled={a.busy} onClick={() => setParsed(null)}>
                Ləğv et
              </button>
              {progress && <span className="num text-[0.86rem] text-ink-soft">{progress}</span>}
            </div>
          )}
        </div>
      )}

      {a.err && <div className="mt-3"><Notice>{a.err}</Notice></div>}
      {result && (
        <div className="mt-4 grid gap-2">
          <Notice tone="ok">
            {result.created} yeni məhsul, {result.updated} yeniləndi
            {result.categories > 0 && `, ${result.categories} yeni kateqoriya`}.
          </Notice>
          {result.errors.length > 0 && (
            <div className="rounded-[14px] bg-danger/8 px-4 py-3 text-[0.86rem] text-danger">
              <p className="font-medium">Bu sətirlər yazılmadı:</p>
              <ul className="mt-1 max-h-60 overflow-auto">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Sətir <span className="num">{e.line}</span>: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
