# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Əmrlər

```bash
npm run dev               # front (next dev :3000); /api və /images → wrangler dev :8787-yə proxy (next.config.ts)
npm run worker:dev        # Worker + lokal D1/R2 (:8787) — dev zamanı yuxarıdakı ilə birlikdə işləyir
npm run build             # next build (statik export → out/) + scripts/flatten-rsc.mjs
npm run preview           # build + lokal migration + wrangler dev: production-a ən yaxın (:8787)
npm run db:migrate:local  # migrations/ → lokal D1 (.wrangler/state)
npm run db:seed:local     # demo mağaza "İlmə": seed/demo.sql → lokal D1, seed/images → lokal R2
npm run typecheck         # tsc front + tsc -p worker
npm run lint
npm run cf-typegen        # wrangler.jsonc dəyişəndən sonra → worker-configuration.d.ts (Env)
npm run deploy            # wrangler d1 migrations apply DB --remote && wrangler deploy
```

Test sistemi yoxdur. `npx wrangler deploy --dry-run` konfiqurasiyanı deploy etmədən yoxlayır. Windows-da `wrangler dev` dayandırılanda workerd prosesləri qala bilər və yeni server cavab vermir — belə olanda bütün `workerd` proseslərini öldür.

## Arxitektura

Bir Worker hər şeyi verir (`wrangler.jsonc`): `run_worker_first` bütün yollar üçündür, yalnız `/_next/static/*` birbaşa static asset kimi gedir.

- **`worker/index.ts`** — router: `/api/*` (JSON, `worker/catalog.ts`), `/images/*` (R2, bir illik immutable cache), `/` → dilə 302 (`lang` cookie, yoxsa mağazanın əsas dili), qalan hər şey `env.ASSETS`. Next prefetch fayllarının adındakı `$` Worker-də `%24`-ə çevrilir (yoxsa asset serveri 307 verir).
- **`worker/html.ts`** — HTML cavablarına `HTMLRewriter` ilə mağazanı yazır: `<title>`, description, OG teqləri (məhsul/kateqoriya/səhifəyə görə), `<style id="brand">` (`--brand-*`), `<html lang>`, `[data-store="name"]` mətni və `<script id="__boot">` (Bootstrap JSON). **Build-də heç bir mağaza məlumatı yoxdur** — ad/rəng/məhsul kodda və ya `out/`-da olmamalıdır.
- **`src/shared/`** — Worker, front və seed skriptinin ortaq kodu: `api-types.ts` (API JSON formaları), `settings.ts` (bütün ayarların defoltları + `publicStore()` — yalnız whitelist sahələr açıq API-yə çıxır), `text.ts` (`normalizeSearch`/`slugify`; import etməməlidir, çünki seed onu düz Node ilə işlədir).
- **Front data axını:** `src/lib/site.tsx` Bootstrap-ı `#__boot`-dan oxuyur (yoxdursa `/api/bootstrap`), `useSyncExternalStore` ilə — hydration build HTML-i ilə eyni qalır, sonra real data ilə yenidən render olunur (`ready`). Mağaza adının görünən yerləri `data-store="name"` + `suppressHydrationWarning` ilə Worker-in yazdığı mətni saxlayır. `src/lib/api.ts` — URL açarlı ortaq sorğu keşi (`useProducts` səhifələrlə, `useProductsById`, `useProduct`, `useFilters`, `usePage`). `src/lib/adapt.ts` API cavabını frontun tiplərinə (`catalog-types.ts`) çevirir: `translations` → `LocalText`, variant xüsusiyyətləri → `options`, qalan xüsusiyyətlər → `specs`, variantı olmayan məhsula `id:"0"` variant, izlənməyən stok → `UNLIMITED`.
- **Pul hər yerdə tam qəpikdir** (API, front, `formatPrice`). Kataloq URL-ində min/max manatla yazılır, API-yə ×100 gedir.
- **Kataloq URL-i:** `?c=<slug>&q=&sort=popular|cheap|expensive|new&f=<key>:<value>&stock=1&min=&max=`. API: `/api/products?category=&q=&attr[key]=v&in_stock=1&featured=1&ids=&sort=new|price_asc|price_desc|popular&page=&limit=` — kateqoriya alt kateqoriyaları da əhatə edir, stokda olanlar həmişə əvvəl.
- **Dillər:** interfeys mətnləri `src/lib/i18n.ts` (AZ/RU/EN, hamısı build olunur, `store.languages` hansıların göstəriləcəyini seçir). Məzmun əsas dildədir, digər dillər sətirin `translations` JSON sütunundadır: `{"ru":{"name":..,"description":..,"attributes":{..}}}`, xüsusiyyət seçimləri üçün `{"ru":{"name":..,"options":{"Qara":"Чёрный"}}}`.
- **D1:** sxem yalnız `migrations/` ilə (köhnə fayl heç vaxt dəyişmir). `0001_init.sql` spesifikasiya §4 + əlavələr: `translations`, `search_text`, `sold_count`, variantda `old_price`/`sort_order`, `rate_limits`. SQL həmişə `.bind()` ilə; siyahı parametrləri `json_each(?)` ilə (D1 parametr limitinə görə).
- **Sifariş (`worker/orders.ts`):** müştəridən yalnız id/say/forma gəlir; qiymət D1-dən. Bir `batch` (tranzaksiya): əvvəl stok qoruyucuları (`SELECT json(CASE … ELSE 'out of stock' END)` — çatmayanda xəta atır və bütün batch geri qaytarılır), sonra `orders` (nömrə `S-` + 1001+MAX(id)), `order_items` (`(SELECT MAX(id) FROM orders)` ilə), stok azaltma, `sold_count`. Honeypot `website` sahəsi, `worker/ratelimit.ts` (D1 `rate_limits`, IP-nin hash-i ilə, 5 sifariş/10 dəq). Telegram `ctx.waitUntil` ilə, uğurlu olsa `notified=1`. Xəta cavabı `{error: OrderError}` kodudur, front onu i18n mətninə çevirir. Front sifarişi `localStorage`-da saxlayır (təsdiq səhifəsi və WhatsApp mətni üçün); WhatsApp düyməsi yalnız `notify.whatsapp_button_enabled` olanda və sifariş yazılandan sonra çıxır.
- **Admin (`worker/auth.ts`, `worker/admin.ts`, front `src/admin/`, səhifə `/admin`):** PBKDF2-SHA256 100k (`pbkdf2-sha256$iter$hex`), sessiya tokeni cookie-də (`admin_session`, HttpOnly, SameSite=Strict, localhost-da Secure-siz), D1-də SHA-256-sı. Bütün admin yazıları `x-admin: 1` başlığı tələb edir (CSRF). `admin(h)` sarğısı sessiyasız 401 verir. Giriş/quraşdırma/şifrə: 5 cəhd/15 dəq/IP. Ayarlar həmişə `JSON.stringify` ilə yazılır; `PUT /api/admin/settings` yalnız `DEFAULTS` açarlarını qəbul edir, Telegram token/chat yalnız `telegram/token` və `telegram/connect` ilə. Sektor şablonları `worker/sectors.ts`. Şəkil yükləmə: xam body, `?folder=products|brand|categories|banners`, `?name=<uuid>[_thumb]`, maks. 5 MB, SVG yox. `/admin` bir client app-dir: status → sihirbaz / giriş / panel. Versiya `APP_VERSION` (`src/shared/settings.ts`).
- **Statik səhifələr** `/[lang]/page/?s=<slug>`, məzmun `components/Markdown.tsx` ilə (HTML yox, React elementləri — XSS yoxdur).
- `scripts/flatten-rsc.mjs` build-dən sonra mütləq işləməlidir (prefetch fayllarını düz adlara kopyalayır).
- **Next.js 16.4 + React 19.3 + Tailwind 4.** Bu Next versiyasında köklü dəyişikliklər var — kod yazmazdan əvvəl `node_modules/next/dist/docs/` oxu (bax `AGENTS.md`). Statik export `rewrites` dəstəkləmir, ona görə `next.config.ts` fazaya görə dəyişir.
- Dizayn qaydaları `DESIGN.md`-dədir (tək ağ tema, kölgə yoxdur, bütün məhsul şəkilləri `ProductImage.tsx` `.frame` ilə). UI dəyişikliyindən əvvəl oxu.

## Qərarlar (mərhələ 1)

Interfeys AZ/RU/EN qalır, məzmun əsas dildə + opsional `translations`; frontun tipləri saxlanılır, API adapterlə çevrilir; brend adi filtrlənən xüsusiyyətdir (`brand` açarı kartda göstərilir); `tone` silindi; `/` brauzer dilinə yox, saxlanmış seçimə və ya əsas dilə gedir. 

---

# Universal Mağaza Şablonu — Sistem Spesifikasiyası

> Bu sənəd Claude Code üçün yazılıb. Layihədə frontend artıq qismən hazırdır. İşə başlamazdan əvvəl mövcud kodu oxu, strukturunu və istifadə olunan texnologiyaları anla, sonra bu spesifikasiyanı mövcud koda uyğunlaşdıraraq tətbiq et. Mövcud dizaynı və komponentləri mümkün qədər saxla. Qeyri-müəyyən məqam olarsa, fərz etmək əvəzinə soruş.

---

## 1. Layihənin məqsədi

Kiçik və orta bizneslər üçün **məhsulların nümayişi və sifariş qəbulu** saytı. Ödəniş sayt üzərindən alınmır; müştəri sifariş göndərir, sahibkar onunla özü əlaqə saxlayır.

Əsas prinsiplər:

1. **İstənilən sektora uyğun.** Geyim, mebel, kosmetika, elektronika, ərzaq və s. Kodda heç bir sektora xas sahə olmamalıdır. Sektor fərqləri admin paneldən təyin olunan dinamik xüsusiyyətlərlə həll olunur.
2. **Həcmdən asılı olmamalı.** 5 məhsul da, 5000 məhsul da rahat işləməlidir (pagination, axtarış, filtr).
3. **Sahibkarın tam müstəqilliyi.** Hər mağaza sahibkarın **öz Cloudflare və GitHub hesabında** yaşayır. Təhvildən sonra sahibkar heç kimdən kömək istəmədən hər şeyi admin paneldən idarə edə bilməlidir. Heç bir ayar üçün kod dəyişmək və ya Cloudflare panelinə girmək tələb olunmamalıdır.
4. **Minimal backend.** Yalnız Cloudflare Workers + D1 + R2. Əlavə server, xarici verilənlər bazası və ya pullu xidmət yoxdur.
5. **Bir kod bazası, çoxlu nüsxə.** Kod bir dəfə yazılır, hər mağaza üçün "Deploy to Cloudflare" düyməsi ilə ayrıca nüsxə qurulur. Mağazaya aid heç bir məlumat koda yazılmır.

---

## 2. Texnologiya yığını

| Hissə | Texnologiya | Qeyd |
|---|---|---|
| Hosting + API | **Cloudflare Workers** (static assets ilə) | Front və API eyni Worker-də. Pages yox, Workers istifadə et, çünki "Deploy to Cloudflare" düyməsi Workers üçündür. |
| Verilənlər bazası | **Cloudflare D1** (SQLite) | Məhsullar, kateqoriyalar, sifarişlər, ayarlar, admin. |
| Şəkillər | **Cloudflare R2** | Məhsul şəkilləri, logo, banner. |
| Spam qorunması | Honeypot + rate limit (standart), **Turnstile** (opsional) | Turnstile sahibkardan əlavə addım tələb etdiyi üçün opsional olsun. |
| Bildiriş | **Telegram Bot API** (əsas), WhatsApp linki (opsional) | |
| Frontend | Mövcud layihədə nə varsa | Mövcud frontu yoxla və onu saxla. |

Konfiqurasiya faylı `wrangler.jsonc` olsun. D1 və R2 binding-ləri orada təyin olunsun ki, Deploy düyməsi onları avtomatik yaratsın. (Cloudflare-in hazırkı sənədlərində Deploy düyməsinin resursları necə yaratdığını və migration-ların necə işə salındığını yoxla.)

Binding adları:
- `DB` — D1
- `IMAGES` — R2
- `ASSETS` — static assets

---

## 3. Ümumi arxitektura

```
Müştəri brauzeri ──► Worker
                     ├── /api/*        → API (JSON)
                     ├── /images/*     → R2-dən şəkil verir
                     ├── /admin/*      → admin panel (SPA)
                     └── qalan hər şey → mağaza frontu (static assets)

Worker ──► D1 (məlumatlar)
Worker ──► R2 (şəkillər)
Worker ──► Telegram API (sifariş bildirişi)
```

Worker `/api/*` və `/images/*` sorğularını özü emal edir, qalanını static assets-ə ötürür.

---

## 4. Verilənlər bazası modeli (D1)

Bütün sxem dəyişiklikləri **yalnız migration faylları** ilə edilir (`migrations/0001_init.sql`, `0002_...sql`). Bazaya heç vaxt əllə dəyişiklik edilmir. Bu, gələcək yeniləmələrin hər mağazada problemsiz işləməsi üçün vacibdir.

### 4.1. `settings` — mağaza ayarları (açar-dəyər)

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL            -- JSON və ya sadə mətn
);
```

Nümunə açarlar:
- `store.name`, `store.description`, `store.logo`, `store.favicon`
- `store.currency` (standart `AZN`), `store.currency_symbol` (`₼`)
- `store.language` (standart `az`)
- `theme.primary_color`, `theme.secondary_color`, `theme.font`, `theme.layout` (məs. `grid` / `list`)
- `contact.phone`, `contact.whatsapp`, `contact.email`, `contact.address`, `contact.instagram`, `contact.facebook`, `contact.tiktok`, `contact.map_url`
- `orders.enabled`, `orders.min_amount`, `orders.delivery_note`, `orders.form_fields` (sifariş formasının hansı sahələri göstərəcəyi, JSON)
- `notify.telegram_token`, `notify.telegram_chat_id`, `notify.telegram_enabled`
- `notify.whatsapp_button_enabled`
- `home.banners` (JSON), `home.featured_category_ids` (JSON)
- `seo.title`, `seo.description`
- `setup.completed` (`true`/`false`)

### 4.2. `admin` — admin hesabı

```sql
CREATE TABLE admin (
  id            INTEGER PRIMARY KEY CHECK (id = 1),  -- yalnız bir admin
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);
```

### 4.3. `categories` — kateqoriyalar (iç-içə ola bilər)

```sql
CREATE TABLE categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  image      TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active  INTEGER DEFAULT 1
);
```

### 4.4. `attributes` — dinamik xüsusiyyət təyinləri

Sektor çevikliyinin açarı budur. Sahibkar admin paneldən öz xüsusiyyətlərini yaradır.

```sql
CREATE TABLE attributes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,        -- "Ölçü", "Rəng", "Material", "Həcm"
  key         TEXT NOT NULL UNIQUE, -- "size", "color"
  type        TEXT NOT NULL,        -- text | number | select | multiselect | color | boolean
  options     TEXT,                 -- select tipləri üçün JSON massiv
  unit        TEXT,                 -- "sm", "ml", "kq" (opsional)
  filterable  INTEGER DEFAULT 0,    -- mağazada filtr kimi göstərilsin?
  is_variant  INTEGER DEFAULT 0,    -- variant yaradırmı (ölçü/rəng kimi)?
  category_ids TEXT,                -- yalnız bu kateqoriyalarda göstər (JSON, boş = hamısında)
  sort_order  INTEGER DEFAULT 0
);
```

### 4.5. `products` — məhsullar

```sql
CREATE TABLE products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  price         INTEGER NOT NULL,     -- qəpiklə saxla (1250 = 12.50 ₼)
  old_price     INTEGER,              -- endirim göstərmək üçün
  stock         INTEGER,              -- NULL = stok izlənmir
  sku           TEXT,
  images        TEXT,                 -- R2 açarlarının JSON massivi, ilki əsas şəkildir
  attributes    TEXT,                 -- {"material":"pambıq","brand":"X"} JSON
  is_active     INTEGER DEFAULT 1,
  is_featured   INTEGER DEFAULT 0,
  sort_order    INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX idx_products_category ON products(category_id, is_active);
CREATE INDEX idx_products_featured ON products(is_featured, is_active);
```

### 4.6. `product_variants` — variantlar (opsional istifadə)

Məsələn, eyni köynəyin "M / Qırmızı" və "L / Mavi" variantları fərqli stok və ya qiymətə malik ola bilər. Variantı olmayan məhsullar bu cədvəli istifadə etmir.

```sql
CREATE TABLE product_variants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  options    TEXT NOT NULL,   -- {"size":"M","color":"Qırmızı"}
  price      INTEGER,         -- NULL = məhsulun qiyməti
  stock      INTEGER,
  sku        TEXT,
  image      TEXT
);
```

### 4.7. `orders` və `order_items` — sifarişlər

```sql
CREATE TABLE orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number    TEXT NOT NULL UNIQUE,  -- insan oxuya bilən, məs. "S-1042"
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  customer_data   TEXT,                  -- qalan forma sahələri JSON (ünvan, qeyd və s.)
  total           INTEGER NOT NULL,      -- qəpiklə
  status          TEXT NOT NULL DEFAULT 'new',  -- new | confirmed | shipped | completed | cancelled
  admin_note      TEXT,
  notified        INTEGER DEFAULT 0,     -- Telegram bildirişi uğurla getdimi
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE order_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INTEGER,               -- məhsul silinsə belə sifariş qalır
  variant_id   INTEGER,
  product_name TEXT NOT NULL,         -- sifariş anındakı ad (snapshot)
  variant_text TEXT,                  -- "M / Qırmızı"
  price        INTEGER NOT NULL,      -- sifariş anındakı qiymət
  quantity     INTEGER NOT NULL
);

CREATE INDEX idx_orders_status ON orders(status, created_at);
```

### 4.8. `pages` — sadə statik səhifələr (opsional)

"Haqqımızda", "Çatdırılma", "Qaytarma şərtləri" kimi səhifələr üçün.

```sql
CREATE TABLE pages (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  slug      TEXT NOT NULL UNIQUE,
  title     TEXT NOT NULL,
  content   TEXT,                 -- markdown
  is_active INTEGER DEFAULT 1,
  show_in_menu INTEGER DEFAULT 0
);
```

---

## 5. API

Bütün cavablar JSON. Xətalar `{ "error": "mesaj" }` formatında, uyğun HTTP statusu ilə.

### 5.1. Açıq (public) API

| Metod | Yol | Təsvir |
|---|---|---|
| GET | `/api/store` | Mağaza üçün lazım olan açıq ayarlar (ad, logo, tema, əlaqə, valyuta). Gizli ayarlar (Telegram token və s.) **heç vaxt** qaytarılmır. |
| GET | `/api/categories` | Aktiv kateqoriyalar ağacı |
| GET | `/api/products` | Siyahı. Parametrlər: `category`, `q` (axtarış), `min_price`, `max_price`, `attr[key]=value`, `sort` (`new`, `price_asc`, `price_desc`, `popular`), `page`, `limit` |
| GET | `/api/products/:slug` | Tək məhsul + variantlar |
| GET | `/api/attributes/filters` | Filtrlənə bilən xüsusiyyətlər və mövcud dəyərləri |
| GET | `/api/pages/:slug` | Statik səhifə |
| POST | `/api/orders` | Sifariş yarat |
| GET | `/images/:key` | R2-dən şəkil (uzun müddətli cache header-ləri ilə) |

**`POST /api/orders` qaydaları (vacib):**
- Müştəridən yalnız `product_id`, `variant_id`, `quantity` və forma sahələri qəbul edilir.
- **Qiymətlər heç vaxt müştəridən götürülmür.** Server qiyməti bazadan oxuyub cəmi özü hesablayır.
- Stok izlənirsə, yoxlanılır və sifarişdən sonra azaldılır (D1 `batch` ilə atomik).
- Honeypot sahəsi doludursa, sorğu səssizcə rədd edilir.
- Eyni IP-dən qısa müddətdə çoxlu sifarişə məhdudiyyət.
- Telefon nömrəsi validasiya edilir.
- Əvvəlcə sifariş bazaya yazılır, **sonra** bildiriş göndərilir. Bildiriş uğursuz olsa belə sifariş itmir (`notified = 0` qalır, admin paneldə xəbərdarlıq göstərilir). Bildirişi `ctx.waitUntil()` ilə göndər ki, müştəri gözləməsin.
- Cavabda `order_number` qaytarılır.

### 5.2. Admin API (`/api/admin/*`)

Bütün admin endpoint-ləri sessiya yoxlaması tələb edir.

| Metod | Yol | Təsvir |
|---|---|---|
| GET | `/api/admin/setup-status` | Quraşdırma tamamlanıbmı (açıq endpoint) |
| POST | `/api/admin/setup` | İlk quraşdırma (yalnız admin yoxdursa işləyir) |
| POST | `/api/admin/login` | Giriş |
| POST | `/api/admin/logout` | Çıxış |
| POST | `/api/admin/password` | Şifrəni dəyiş |
| GET/PUT | `/api/admin/settings` | Bütün ayarlar |
| CRUD | `/api/admin/categories` | Kateqoriyalar |
| CRUD | `/api/admin/attributes` | Xüsusiyyətlər |
| CRUD | `/api/admin/products` | Məhsullar (+ variantlar) |
| POST | `/api/admin/products/bulk` | Toplu əməliyyat (aktiv/deaktiv, sil, kateqoriya dəyiş) |
| POST | `/api/admin/upload` | Şəkil yüklə → R2 açarı qaytarır |
| DELETE | `/api/admin/upload/:key` | Şəkli sil |
| GET | `/api/admin/orders` | Sifarişlər (status və tarixə görə filtr, pagination) |
| GET/PATCH | `/api/admin/orders/:id` | Sifariş detalları, status və qeyd dəyişmək |
| GET | `/api/admin/stats` | Sadə statistika: bu gün/həftə/ay sifariş sayı və məbləği, yeni sifarişlər |
| POST | `/api/admin/telegram/connect` | Telegram chat_id-ni avtomatik tap (bax: 7.1) |
| POST | `/api/admin/telegram/test` | Test mesajı göndər |
| GET | `/api/admin/export` | Bütün məlumatların JSON ehtiyat nüsxəsi |
| POST | `/api/admin/import` | Ehtiyat nüsxədən bərpa / CSV ilə məhsul idxalı |
| CRUD | `/api/admin/pages` | Statik səhifələr |

---

## 6. Autentifikasiya

Cloudflare Access istifadə **edilmir**, çünki sahibkardan Cloudflare panelində əlavə quraşdırma tələb edir. Öz sadə sistemimiz:

- **İlk açılış:** `admin` cədvəli boşdursa, `/admin` açılanda quraşdırma sihirbazı göstərilir. Admin yarandıqdan sonra `/api/admin/setup` həmişəlik bağlanır.
- **Şifrə hash:** Web Crypto API ilə PBKDF2-SHA256, təsadüfi salt. Workers-də PBKDF2 iterasiya sayı 100 000 ilə məhdudlaşır, bu dəyəri istifadə et.
- **Sessiya:** təsadüfi token `sessions` cədvəlində saxlanır, `HttpOnly; Secure; SameSite=Strict` cookie ilə göndərilir, müddəti 30 gün.
- **Brute force qorunması:** ardıcıl uğursuz girişlərdən sonra müvəqqəti bloklama.
- **Şifrə unudulanda:** sahibkar Cloudflare panelində D1 konsoluna girib bir SQL əmri işlədir (`DELETE FROM admin;`), sonra `/admin` yenidən quraşdırma sihirbazını göstərir. Bu zaman məhsullar və sifarişlər silinmir. Bu addımı təhvil təlimatına yaz (bax: 11).

---

## 7. Sifariş bildirişləri

### 7.1. Telegram (əsas kanal)

Sahibkarın edəcəyi iş minimal olmalıdır:

1. Admin paneldə "Telegram qoşulması" bölməsində addım-addım təlimat göstərilir: BotFather-də bot yarat, tokeni kopyala.
2. Sahibkar tokeni yapışdırır.
3. Panel ona "İndi botunuza Telegram-da /start yazın" deyir və "Qoşul" düyməsi göstərir.
4. "Qoşul" basılanda Worker `getUpdates` çağırır, son mesajdan `chat_id`-ni tapıb saxlayır və test mesajı göndərir.
5. Bir neçə nəfərin bildiriş alması lazımdırsa, bot Telegram qrupuna əlavə oluna bilər; eyni üsulla qrupun `chat_id`-si tapılır.

Bildiriş mesajı formatı (nümunə):

```
🛒 Yeni sifariş #S-1042

👤 Əli Məmmədov
📞 +994 50 123 45 67
📍 Bakı, Nəsimi r., ...

• Pambıq köynək (M / Qırmızı) × 2 — 50.00 ₼
• Kəmər × 1 — 15.00 ₼

💰 Cəmi: 65.00 ₼
📝 Qeyd: Axşam saat 6-dan sonra

Admin paneldə bax: https://magaza.az/admin/orders/1042
```

### 7.2. WhatsApp düyməsi (opsional)

Admin paneldən yandırılıb-söndürülür. Aktiv olduqda, sifariş **əvvəlcə bazaya yazılır**, sonra müştəriyə "WhatsApp-da göndər" düyməsi göstərilir. Düymə `https://wa.me/<nömrə>?text=<sifariş mətni>` linkini açır. Rəsmi WhatsApp Business API istifadə edilmir.

### 7.3. Admin panel

Bütün sifarişlər bildirişdən asılı olmayaraq admin paneldə görünür. Yeni sifarişlərin sayı paneldə nişan (badge) kimi göstərilir.

---

## 8. Şəkillər (R2)

- Yükləmədən **əvvəl brauzerdə** şəkil kiçildilir və sıxılır (canvas ilə, maks. ~1600px, WebP, keyfiyyət ~0.82). Bu, telefonla çəkilmiş 8 MB-lıq şəkillərin problemini həll edir və R2 xərcini sıfıra yaxın saxlayır.
- Kiçik ölçülü önizləmə (thumbnail, ~400px) də brauzerdə yaradılıb ayrıca yüklənir.
- R2 açarı formatı: `products/<uuid>.webp`, `products/<uuid>_thumb.webp`.
- `/images/:key` cavabında `Cache-Control: public, max-age=31536000, immutable`.
- Məhsul silinəndə şəkilləri də R2-dən silinir.
- Admin paneldə telefondan birbaşa kamera ilə şəkil çəkib yükləmək mümkün olmalıdır (`<input type="file" accept="image/*" capture>`), çoxlu şəkil seçimi, sürükləyərək sıralama.

---

## 9. Admin panel

**Əvvəlcə mobil üçün dizayn et.** Sahibkarların çoxu paneli telefondan istifadə edəcək. İnterfeys dili Azərbaycan dilidir, texniki termin istifadə edilmir.

### 9.1. Quraşdırma sihirbazı (ilk açılış)

Addımlar, hər biri ayrıca ekran, irəli/geri düymələri ilə:
1. Admin şifrəsi yarat
2. Mağaza adı, qısa təsvir, logo
3. Rənglər (hazır palitralardan seç və ya öz rəngin)
4. Əlaqə məlumatları və sosial şəbəkələr
5. Telegram bildirişi (keçmək olar, sonra da qurmaq olar)
6. Sektor seçimi (opsional köməkçi): "Geyim", "Mebel", "Kosmetika", "Elektronika", "Ərzaq", "Digər". Seçimə görə uyğun nümunə xüsusiyyətlər avtomatik yaradılır (məs. geyim → Ölçü, Rəng, Material). Sahibkar sonra bunları dəyişə və silə bilər.
7. Hazırdır → idarə panelinə keçid

### 9.2. Bölmələr

- **Əsas səhifə (dashboard):** yeni sifarişlər, bu günün/həftənin satışı, bildiriş xətası xəbərdarlığı, "Məhsul əlavə et" sürətli düyməsi.
- **Sifarişlər:** siyahı, status filtri, axtarış (ad, telefon, nömrə), detallar, status dəyişmək, zəng etmək və WhatsApp-a yazmaq düymələri, admin qeydi.
- **Məhsullar:** siyahı (axtarış, kateqoriya filtri, pagination), əlavə et / redaktə et / kopyala / sil, toplu əməliyyatlar, aktiv/deaktiv keçidi. Redaktə formasında seçilmiş kateqoriyaya aid xüsusiyyətlər dinamik göstərilir. Variant redaktoru: xüsusiyyət dəyərlərini seç → variantlar avtomatik yaransın, hər birinə stok/qiymət yaz.
- **Kateqoriyalar:** ağac görünüşü, sıralama, şəkil.
- **Xüsusiyyətlər:** yarat/redaktə et, tip seç, seçimlər, filtr və variant bayraqları.
- **Görünüş:** logo, rənglər, şrift, bannerlər, ana səhifədə hansı kateqoriyaların göstərilməsi, düzülüş. Dəyişikliklərin canlı önizləməsi.
- **Səhifələr:** statik səhifələr (sadə mətn redaktoru).
- **Ayarlar:** mağaza məlumatları, valyuta, sifariş forması sahələri (hansı sahə görünür, hansı məcburidir), minimum sifariş məbləği, çatdırılma qeydi, Telegram, WhatsApp düyməsi, SEO.
- **Ehtiyat nüsxə:** JSON ixracı/idxalı, CSV ilə toplu məhsul idxalı (nümunə CSV şablonu yüklənə bilsin).
- **Hesab:** şifrə dəyiş, çıxış.

---

## 10. Mağaza frontu

Mövcud frontu saxla və onu API-yə qoş. Bütün mətnlər, rənglər, logo və əlaqə məlumatları `/api/store`-dan gəlməli, koda yazılmamalıdır.

Lazım olan səhifələr:
- **Ana səhifə:** banner(lər), seçilmiş kateqoriyalar, seçilmiş məhsullar, yeni məhsullar.
- **Kateqoriya / kataloq:** grid, filtrlər (qiymət + `filterable` xüsusiyyətlər, dinamik), sıralama, pagination və ya "daha çox yüklə".
- **Axtarış.**
- **Məhsul səhifəsi:** şəkil qalereyası, qiymət (köhnə qiymət üstündən xətli), variant seçimi (seçilən varianta görə qiymət/stok/şəkil dəyişir), xüsusiyyətlər cədvəli, təsvir, səbətə əlavə et.
- **Səbət:** brauzerdə saxlanılır (localStorage), miqdar dəyiş, sil, cəm.
- **Sifariş forması:** sahələr admin ayarlarına görə dinamik qurulur. Uğurlu sifarişdən sonra sifariş nömrəsi və (aktivdirsə) WhatsApp düyməsi göstərilir.
- **Statik səhifələr** və **əlaqə** səhifəsi.
- Mobil uyğun, sürətli, SEO üçün hər səhifədə düzgün `title`/`description`/Open Graph.
- Stokda olmayan məhsul "Stokda yoxdur" kimi göstərilir, səbətə əlavə edilə bilmir.
- Tema rəngləri CSS dəyişənləri ilə tətbiq olunur ki, admin paneldən dəyişdirilə bilsin.

---

## 11. Deploy və təhvil prosesi

### 11.1. Repo hazırlığı (bir dəfə)

- Repo GitHub-da **public** olmalıdır (Deploy düyməsi üçün).
- `README.md`-də "Deploy to Cloudflare" düyməsi.
- `wrangler.jsonc`-də D1 və R2 binding-ləri, resurs ID-ləri olmadan (Deploy düyməsi yeniləri yaradır).
- `package.json`-da deploy skripti migration-ları da işə salmalıdır (məs. `wrangler d1 migrations apply DB --remote && wrangler deploy`). Bunun Deploy düyməsi ilə necə işlədiyini Cloudflare-in hazırkı sənədlərinə görə yoxla və test et.
- Repoda heç bir mağazaya aid məlumat, token və ya gizli açar olmamalıdır.

### 11.2. Hər yeni mağaza üçün addımlar

1. Sahibkarın öz e-poçtu ilə **Cloudflare** və **GitHub** hesabı açılır.
2. README-dəki **"Deploy to Cloudflare"** düyməsi basılır. Repo sahibkarın GitHub-una kopyalanır, D1 və R2 yaradılır, sayt `*.workers.dev` ünvanında işə düşür.
3. `/admin` açılır, **quraşdırma sihirbazı** tamamlanır.
4. **Domen** qoşulur (Cloudflare-də Workers → Custom Domains).
5. 2-3 məhsul əlavə edilir, **test sifarişi** verilir, Telegram bildirişi yoxlanılır.
6. Sahibkara **təlimat** verilir (aşağıya bax).
7. Bütün hesablarda **2FA** aktiv edilir, quraşdıranın heç bir girişi qalmadığı yoxlanılır.

Bu addımları `docs/TEHVIL.md` faylında yoxlama siyahısı kimi yaz.

### 11.3. Sahibkar üçün təlimat

`docs/SAHIBKAR_TELIMATI.md` faylı yarat, sadə dildə, texniki termin olmadan:
- Məhsul necə əlavə edilir (telefondan, şəkil ilə)
- Sifarişlərə necə baxılır və status necə dəyişdirilir
- Rənglər, logo, əlaqə məlumatları necə dəyişdirilir
- Telegram necə qoşulur
- Ehtiyat nüsxə necə alınır (ayda bir dəfə tövsiyə olunur)
- Şifrə unudulanda nə etməli (Cloudflare panelində D1 konsolu ilə sıfırlama, addım-addım)
- Yeniləmələri necə almaq olar (bax: 12)

---

## 12. Yeniləmələr

Hər mağaza sahibkarın öz hesabında müstəqil yaşayır, avtomatik yeniləmə yoxdur. Yeni versiya çıxdıqda sahibkar istəsə öz GitHub repo-sunda **"Sync fork"** düyməsini basır, Cloudflare dəyişikliyi avtomatik deploy edir.

Bunun problemsiz işləməsi üçün:
- Sxem dəyişiklikləri yalnız yeni migration faylları ilə, köhnə migration-lar heç vaxt dəyişdirilmir.
- Migration-lar həmişə geriyə uyğun olmalıdır (sütun silmək əvəzinə yenisini əlavə et, mövcud məlumatı qoru).
- Yeni ayarların standart dəyərləri olmalıdır ki, köhnə mağazalar onları təyin etmədən işləməyə davam etsin.
- Versiya nömrəsi `settings`-də saxlanılır və admin paneldə göstərilir.
- `CHANGELOG.md` saxlanılır.

---

## 13. Təhlükəsizlik yoxlama siyahısı

- [ ] Qiymətlər və cəm yalnız serverdə hesablanır
- [ ] Gizli ayarlar (`notify.telegram_token` və s.) açıq API-də qaytarılmır
- [ ] Bütün admin endpoint-ləri sessiya yoxlayır
- [ ] SQL sorğuları yalnız parametrlərlə (`.bind()`), heç vaxt string birləşdirmə ilə
- [ ] Yüklənən fayllar tip və ölçüyə görə yoxlanılır (yalnız şəkil, maks. ölçü)
- [ ] İstifadəçi daxil etdiyi mətn frontda escape edilir (XSS)
- [ ] Sifariş endpoint-ində honeypot + rate limit
- [ ] Giriş endpoint-ində brute force qorunması
- [ ] Cookie-lər `HttpOnly`, `Secure`, `SameSite=Strict`
- [ ] `/api/admin/setup` admin yarandıqdan sonra bağlıdır

---

## 14. İş mərhələləri

Hər mərhələni bitirdikdən sonra dayan, nəticəni göstər və təsdiq gözlə.

1. **Analiz:** mövcud frontu oxu, strukturu və texnologiyaları qısa izah et, bu spesifikasiya ilə uyğunsuzluqları göstər, plan təklif et.
2. **Əsas infrastruktur:** `wrangler.jsonc`, Worker giriş nöqtəsi və router, static assets, D1 migration-ları, lokal inkişaf mühiti (`wrangler dev`).
3. **Açıq API + front inteqrasiyası:** mağaza ayarları, kateqoriyalar, məhsullar, filtrlər, məhsul səhifəsi. Test üçün seed məlumatı.
4. **Səbət və sifariş:** sifariş forması, `POST /api/orders`, Telegram bildirişi, WhatsApp düyməsi.
5. **Admin: autentifikasiya + quraşdırma sihirbazı.**
6. **Admin: məhsullar, kateqoriyalar, xüsusiyyətlər, variantlar, şəkil yükləmə.**
7. **Admin: sifarişlər, dashboard, ayarlar, görünüş.**
8. **Ehtiyat nüsxə və CSV idxalı, statik səhifələr.**
9. **Deploy düyməsi:** README, deploy skripti, təmiz Cloudflare hesabında sınaq.
10. **Sənədlər:** `docs/TEHVIL.md`, `docs/SAHIBKAR_TELIMATI.md`, `CHANGELOG.md`.
