# Mağaza şablonu (storefront template)

Hər sahəyə uyğunlaşan mağaza saytı: məhsullar göstərilir, sifariş sayt üzərindən qəbul olunur, sahibkara Telegram ilə xəbər gedir. Hər mağaza sahibkarın öz Cloudflare hesabında bir **Worker** kimi işləyir: front (Next.js statik export), API, D1 bazası və R2 şəkilləri.

Tam tələblər: `CLAUDE.md` (Sistem Spesifikasiyası).

## İşə salmaq

```bash
npm install
npm run db:migrate:local && npm run db:seed:local   # lokal baza + demo mağaza "İlmə"
npm run worker:dev   # API + lokal D1/R2: http://localhost:8787
npm run dev          # front: http://localhost:3000/az/ (API-ni 8787-dən götürür)
npm run preview      # və ya: build + Worker birlikdə, production kimi: http://localhost:8787/az/
```

`wrangler.jsonc` dəyişəndən sonra `npm run cf-typegen`.

## Harada nə var

| Yer | Nə üçün |
|---|---|
| `src/` | mağaza frontu (Next.js, `output: "export"` → `out/`) |
| `worker/` | Worker: `/api/*`, `/images/*` (R2), HTML-ə mağaza adı/rəng/SEO yazır; qalan hər şey `out/`-dan |
| `src/shared/` | Worker və frontun ortaq kodu: API tipləri, ayar defoltları, axtarış mətni |
| `seed/` | yalnız lokal inkişaf üçün demo məlumat və fotolar (deploy olunmur) |
| `migrations/` | D1 sxemi. Köhnə migration heç vaxt dəyişdirilmir, hər dəyişiklik yeni fayldır |
| `wrangler.jsonc` | binding-lər: `DB` (D1), `IMAGES` (R2), `ASSETS`; resurs ID-ləri yoxdur, Deploy düyməsi yaradır |
| `scripts/flatten-rsc.mjs` | build-dən sonra işləyir; Next 16.4 statik export-da prefetch fayllarının adını düzəldir |
| `src/app/globals.css`, `DESIGN.md` | dizayn sistemi |

## Deploy

`npm run deploy` = `wrangler d1 migrations apply DB --remote && wrangler deploy`. "Deploy to Cloudflare" düyməsi mərhələ 9-da əlavə olunacaq.
