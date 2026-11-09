# Mağaza şablonu — universal e-commerce template

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/amingryv/magaza)

İstənilən sahəyə (geyim, ev, kosmetika, elektronika, ərzaq…) uyğun mağaza saytı: məhsullar göstərilir, sifariş sayt üzərindən qəbul olunur, sahibkara Telegram ilə xəbər gedir, istəyə görə müştəri sifarişi WhatsApp-a da göndərir. Ödəniş sayt üzərindən alınmır.

Hər mağaza sahibkarın öz Cloudflare hesabında bir **Worker** kimi işləyir — pulsuz planda, əlavə server və ya pullu xidmət olmadan:

- **Front:** Next.js 16 (statik export) + React 19 + Tailwind 4; interfeys AZ / RU / EN
- **API:** Cloudflare Worker (`worker/`)
- **Baza:** Cloudflare D1 (SQLite), sxem `migrations/`-da
- **Şəkillər:** Cloudflare R2
- **Admin panel:** `/admin` — məhsullar, variantlar, kateqoriyalar, xüsusiyyətlər, sifarişlər, görünüş, səhifələr, ayarlar, ehtiyat nüsxə, CSV idxal/ixrac

Mağazaya aid heç bir məlumat (ad, rəng, məhsul, token) kodda yoxdur — hamısı ilk açılışdakı quraşdırma sihirbazında və admin paneldə daxil edilir.

## Tələblər

- **Node.js 22.18+** (`.node-version`) və npm
- Deploy üçün: Cloudflare hesabı (pulsuz plan bəsdir) və GitHub hesabı

## Lokal quraşdırma (sıfırdan)

```bash
git clone https://github.com/amingryv/magaza.git
cd magaza
npm install
npm run setup        # lokal D1 bazası (migration) + 10 məhsullu demo mağaza
npm run preview      # build + Worker: http://localhost:8787/az/
```

Sonra http://localhost:8787/admin aç — **quraşdırma sihirbazı** admin şifrəsini yaratmağı təklif edir (demo bazada admin yoxdur). Sihirbazda yazdığınız mağaza adı, rəng və əlaqə məlumatları demo ayarları əvəz edir; demo məhsullar qalır.

Kod üzərində işləyəndə (dəyişikliklər dərhal görünür) iki terminal:

```bash
npm run worker:dev   # API + lokal D1/R2: http://localhost:8787
npm run dev          # front: http://localhost:3000/az/ (API-ni 8787-dən götürür)
```

Lokal məlumat `.wrangler/state/`-dədir (git-ə düşmür). Tam təmiz başlamaq üçün həmin qovluğu sil və `npm run setup` işlət.

### Əmrlər

| Əmr | Nə edir |
|---|---|
| `npm run setup` | lokal bazaya migration + demo məlumat |
| `npm run db:seed:local` | demo məlumatı yenidən yazır (lokal kataloq, sifarişlər və səhifələr silinir; admin qalır) |
| `npm run admin:reset:local` | lokal admin şifrəsini sıfırlayır → `/admin` yenidən sihirbazı göstərir |
| `npm run preview` | production-a ən yaxın lokal işə salma |
| `npm run typecheck` / `npm run lint` | yoxlamalar (test sistemi yoxdur) |
| `npm run build` | `out/`-a statik front |
| `npm run deploy` | Cloudflare-ə deploy (migration + Worker) |
| `npm run cf-typegen` | `wrangler.jsonc` dəyişəndən sonra binding tiplərini yeniləyir |

### Demo məlumat

`seed/demo-catalog.ts`: 4 kateqoriya (Geyim, Ev və dekor, Elektronika, Aksesuarlar), 10 məhsul (ölçü/rəng variantları, endirim, stokda olmayan və stoku izlənməyən nümunələr) və 2 statik səhifə. Məhsulların şəkli yoxdur — front hər şəkilsiz məhsul üçün kateqoriyaya uyğun neytral placeholder çəkir (`src/components/ProductImage.tsx`). Demo yalnız lokal bazaya yazılır, deploy olunan mağazaya heç vaxt düşmür: real mağaza boş başlayır və sihirbazda seçilən sektora görə nümunə xüsusiyyətlər yaranır.

## Harada nə var

| Yer | Nə üçün |
|---|---|
| `src/` | mağaza frontu (`src/app`, `src/views`, `src/components`) və admin panel (`src/admin`) |
| `worker/` | Worker: `/api/*`, `/images/*` (R2), HTML-ə mağaza adı/rəng/SEO yazır; qalan hər şey `out/`-dan |
| `src/shared/` | Worker və frontun ortaq kodu: API tipləri, ayar defoltları, axtarış mətni |
| `migrations/` | D1 sxemi. Köhnə migration heç vaxt dəyişdirilmir, hər dəyişiklik yeni fayldır |
| `seed/`, `scripts/seed-demo.mts` | yalnız lokal inkişaf üçün demo məlumat |
| `scripts/deploy.mjs` | deploy: migration → Worker |
| `scripts/flatten-rsc.mjs` | build-dən sonra işləyir; Next 16.4 statik export-da prefetch fayllarının adını düzəldir |
| `wrangler.jsonc` | binding-lər: `DB` (D1), `IMAGES` (R2), `ASSETS`; resurs ID-ləri yoxdur, Deploy düyməsi yaradır |
| `DESIGN.md`, `src/app/globals.css` | dizayn sistemi |
| `CLAUDE.md` | arxitektura qeydləri və tam spesifikasiya |

## Deploy

### Düymə ilə (yeni mağaza)

Yuxarıdakı **Deploy to Cloudflare** düyməsi: repo sahibkarın GitHub-una kopyalanır, Cloudflare D1 bazası və R2 bucket-i yaradır, `npm run build` və `npm run deploy` işləyir, sayt `<worker>.<subdomen>.workers.dev` ünvanında açılır. Sonra `/admin` → quraşdırma sihirbazı. Hər sonrakı push (və ya GitHub-da "Sync fork") avtomatik yenidən deploy olunur, yeni migration-lar özü tətbiq olunur.

**Təmiz Cloudflare hesabında düymədən əvvəl bir dəfə** (yoxsa deploy düşür):

1. **R2-ni aktivləşdir:** panel → R2 Object Storage → aktivləşdir. Pulsuz həddə (10 GB) ödəniş yoxdur, amma Cloudflare kart məlumatı istəyə bilər. Bunsuz xəta: `Please enable R2 through the Cloudflare Dashboard [code: 10042]`.
2. **workers.dev subdomeni:** panel → Workers & Pages → subdomen seç (məs. `mymagaza` → `magaza.mymagaza.workers.dev`). Bunsuz xəta: `You need to register a workers.dev subdomain`.

Düymə səhifəsində Worker, D1 və R2 adlarını dəyişmək olar (bir hesabda bir neçə mağaza varsa, fərqli adlar ver).

### Əllə (wrangler ilə)

```bash
npx wrangler login
npm run build
npm run deploy     # = node scripts/deploy.mjs
```

`scripts/deploy.mjs` əvvəl `wrangler d1 migrations apply DB --remote`, sonra `wrangler deploy` işlədir (yeni kod köhnə sxemlə qarşılaşmır). Baza hələ yoxdursa (ilk deploy), əvvəl `wrangler deploy` (D1 və R2-ni yaradır), sonra migration. ID-lər `wrangler.jsonc`-yə yazılmır; növbəti deploy-lar bazanı və bucket-i adla (`magaza-db`, `magaza-images`) tapır, ona görə bu adları dəyişmə. Təmiz hesabda sınanıb (2026-11-09).

Gizli açar (secret) və mühit dəyişəni yoxdur: Telegram tokeni və digər ayarlar admin paneldən D1-ə yazılır. Terminaldan `wrangler login` olmadan (məs. CI) deploy üçün `.env.example`-a bax.

### Admin şifrəsi unudulanda

Cloudflare panel → Storage & Databases → D1 → `magaza-db` → Console: `DELETE FROM admin; DELETE FROM sessions;` → `/admin` yenidən sihirbazı göstərir. Məhsullar, sifarişlər və ayarlar silinmir. Lokal: `npm run admin:reset:local`.

### Domen

Panel → Workers & Pages → Worker → Settings → Domains & Routes → Custom domain. Domen həmin Cloudflare hesabında olmalıdır.

## Sənədlər

- [`docs/TEHVIL.md`](docs/TEHVIL.md) — yeni mağazanı quran və təhvil verən üçün yoxlama siyahısı
- [`docs/SAHIBKAR_TELIMATI.md`](docs/SAHIBKAR_TELIMATI.md) — sahibkar üçün sadə təlimat (məhsul, sifariş, Telegram, ehtiyat nüsxə, şifrə sıfırlama, yeniləmə)
- [`CHANGELOG.md`](CHANGELOG.md) — versiyalar

## Lisenziya

Müəllif hüquqları qorunur, bax [`LICENSE`](LICENSE). Repo yalnız Deploy düyməsinin işləməsi üçün açıqdır; lisenziya almış sahibkar kodu bir mağaza üçün işlədə və dəyişə bilər, yenidən yaymaq və satmaq qadağandır.
