# Mağaza şablonu (storefront template)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/amingryv/magaza)

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

### Düymə ilə (yeni mağaza)

Yuxarıdakı **Deploy to Cloudflare** düyməsi: repo sahibkarın GitHub-una kopyalanır, Cloudflare D1 bazası və R2 bucket-i yaradır, `npm run build` və `npm run deploy` işləyir, sayt `<worker>.<subdomen>.workers.dev` ünvanında açılır. Sonra `/admin` → quraşdırma sihirbazı. Hər sonrakı push (və ya GitHub-da "Sync fork") avtomatik yenidən deploy olunur, yeni migration-lar özü tətbiq olunur.

**Təmiz Cloudflare hesabında düymədən əvvəl bir dəfə** (yoxsa deploy düşür):

1. **R2-ni aktivləşdir:** panel → R2 Object Storage → aktivləşdir. Pulsuz həddə (10 GB) ödəniş yoxdur, amma Cloudflare kart məlumatı istəyə bilər. Bunsuz xəta: `Please enable R2 through the Cloudflare Dashboard [code: 10042]`.
2. **workers.dev subdomeni:** panel → Workers & Pages → subdomen seç (məs. `ilme` → `magaza.ilme.workers.dev`). Bunsuz xəta: `You need to register a workers.dev subdomain`.

Düymə səhifəsində Worker, D1 və R2 adlarını dəyişmək olar (bir hesabda bir neçə mağaza varsa, fərqli adlar ver).

### Əllə (wrangler ilə)

```bash
npx wrangler login
npm run build
npm run deploy     # = node scripts/deploy.mjs
```

`scripts/deploy.mjs` əvvəl `wrangler d1 migrations apply DB --remote`, sonra `wrangler deploy` işlədir (yeni kod köhnə sxemlə qarşılaşmır). Baza hələ yoxdursa (ilk deploy), əvvəl `wrangler deploy` (D1 və R2-ni yaradır), sonra migration. ID-lər `wrangler.jsonc`-yə yazılmır; növbəti deploy-lar bazanı və bucket-i adla (`magaza-db`, `magaza-images`) tapır, ona görə bu adları dəyişmə. Təmiz hesabda sınanıb (2026-11-09).

Gizli açar (secret) yoxdur: Telegram tokeni və digər ayarlar admin paneldən D1-ə yazılır.

### Domen

Panel → Workers & Pages → Worker → Settings → Domains & Routes → Custom domain. Domen həmin Cloudflare hesabında olmalıdır.

## Sənədlər

- [`docs/TEHVIL.md`](docs/TEHVIL.md) — yeni mağazanı quran və təhvil verən üçün yoxlama siyahısı
- [`docs/SAHIBKAR_TELIMATI.md`](docs/SAHIBKAR_TELIMATI.md) — sahibkar üçün sadə təlimat (məhsul, sifariş, Telegram, ehtiyat nüsxə, şifrə sıfırlama, yeniləmə)
- [`CHANGELOG.md`](CHANGELOG.md) — versiyalar
