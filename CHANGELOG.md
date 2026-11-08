# Dəyişikliklər

Versiya nömrəsi admin panelin **Hesab** bölməsində görünür. Yeniləmək üçün: GitHub-da repo → **Sync fork** (bax `docs/SAHIBKAR_TELIMATI.md`, 8-ci bölmə). Bazanın dəyişiklikləri deploy zamanı özü tətbiq olunur; məlumatlar qalır.

Format: [Keep a Changelog](https://keepachangelog.com/), versiyalar [SemVer](https://semver.org/).

## [1.0.0] — 2026-11-09

İlk tam versiya.

### Mağaza
- Ana səhifə (bannerlər, seçilmiş kateqoriyalar, seçilmiş və yeni məhsullar), kataloq (filtr, sıralama, axtarış, səhifələmə), məhsul səhifəsi (qalereya, variantlar, xüsusiyyətlər), səbət, sifariş forması, statik səhifələr.
- Azərbaycan, rus və ingilis dilləri; məzmun tərcümələri.
- Mağaza adı, rənglər, şrift, SEO və Open Graph teqləri serverdə HTML-ə yazılır.

### Sifariş
- Qiymət və cəm yalnız serverdə hesablanır; sifariş stoku dəyişmir, yalnız yoxlayır.
- Honeypot və IP üzrə limit (5 sifariş / 10 dəq).
- Telegram bildirişi (sifariş yazılandan sonra), opsional WhatsApp düyməsi.

### İdarə paneli (`/admin`)
- Quraşdırma sihirbazı, PBKDF2 şifrə, 30 günlük sessiya, giriş cəhdlərinə limit.
- Məhsullar (variantlar, şəkillər, kopya, toplu əməliyyat), kateqoriyalar, xüsusiyyətlər, sektor şablonları.
- Sifarişlər, statistika, ayarlar, görünüş, statik səhifələr.
- JSON ehtiyat nüsxə və bərpa, CSV ilə məhsul idxalı/ixracı.

### Deploy
- "Deploy to Cloudflare" düyməsi; `scripts/deploy.mjs` əvvəl migration, sonra deploy (ilk deploy-da əksinə).
- Sənədlər: `docs/TEHVIL.md` (təhvil yoxlama siyahısı), `docs/SAHIBKAR_TELIMATI.md` (sahibkar üçün təlimat).

<!--
Yeni versiya buraxanda:
1. src/shared/settings.ts → APP_VERSION və package.json → version
2. Bu fayla yuxarıdan yeni bölmə: ## [x.y.z] — tarix (Əlavə edildi / Dəyişdi / Düzəldildi)
3. Sxem dəyişirsə — yalnız yeni migrations/000N_*.sql (köhnəyə toxunma, sütun silmə),
   yeni ayarlara src/shared/settings.ts DEFAULTS-da dəyər, yeni sütunu worker/admin-backup.ts TABLES-a əlavə et.
-->
