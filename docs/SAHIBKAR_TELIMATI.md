# Mağazanızın idarə təlimatı

Saytınız tamamilə sizindir: öz hesablarınızda yaşayır və hər şeyi idarə panelindən özünüz dəyişə bilərsiniz. Kod bilmək lazım deyil.

**İdarə paneli:** saytınızın ünvanının sonuna `/admin` yazın. Məsələn: `https://magaza.az/admin`

Telefonda bu ünvanı brauzerdə açıb "Ana ekrana əlavə et" etsəniz, panel tətbiq kimi bir toxunuşla açılacaq.

---

## 1. Məhsul əlavə etmək

1. Panel → **Məhsullar** → **Yeni məhsul**.
2. **Şəkillər:** "Şəkil seç" ilə qalereyadan bir neçə şəkil seçin və ya kamera düyməsi ilə dərhal çəkin. Birinci şəkil əsas şəkildir; sırasını şəkli sürüşdürərək dəyişə bilərsiniz. Şəkillər avtomatik kiçildilir, böyük olmasından narahat olmayın.
3. **Ad, qiymət, təsvir** yazın. Endirim varsa, **köhnə qiyməti** də yazın — mağazada üstündən xətt çəkilmiş görünəcək.
4. **Kateqoriya** seçin. Kateqoriyaya aid xüsusiyyətlər (məs. ölçü, rəng, material) aşağıda çıxacaq — doldurun, boş qalanlar mağazada göstərilmir.
5. **Stok:** neçə ədəd olduğunu yazın. Boş qoysanız, say izlənmir və məhsul həmişə satışdadır. 0 yazsanız, "Stokda yoxdur" görünür.
6. **Variantlar** (məs. eyni köynəyin M və L ölçüsü): ölçü/rəng seçin, variantlar özü yaranır, hər birinə ayrıca stok və lazım olsa qiymət yazın.
7. **Yadda saxla.**

Faydalı:
- **Gizlətmək:** məhsulu silmədən mağazadan götürmək üçün "Mağazada görünsün" düyməsini söndürün.
- **Kopyasını yarat:** oxşar məhsulu sıfırdan yazmamaq üçün mövcud məhsulu açın, kopyasını yaradıb dəyişin.
- **Toplu iş:** siyahıda bir neçə məhsulu işarələyib birdən gizlədə, silə və ya başqa kateqoriyaya köçürə bilərsiniz.
- **Stok sifarişlə azalmır.** Malı satanda sayını özünüz azaldın (məhsulu açıb "Stok"u dəyişin).
- Çox məhsulu birdən əlavə etmək üçün bax: 6-cı bölmə (Excel).

**Kateqoriyalar** bölməsində kateqoriya əlavə edə, şəkil qoya, sırasını dəyişə bilərsiniz. **Xüsusiyyətlər** bölməsində yeni xüsusiyyət (məs. "Həcm", "Zəmanət") yaradıb onu mağazada filtr kimi göstərə bilərsiniz.

## 2. Sifarişlər

Yeni sifariş gələndə Telegram-a xəbər gəlir (qoşulubsa). Bütün sifarişlər həmişə panelin **Sifarişlər** bölməsində də var — Telegram işləməsə belə heç biri itmir. Yeni sifarişlərin sayı bölmənin yanında rəqəmlə görünür.

1. Sifarişi açın: müştərinin adı, telefonu, ünvanı, məhsullar və cəm.
2. **Zəng et** və ya **WhatsApp** düyməsi ilə müştəri ilə əlaqə saxlayın.
3. Statusu dəyişin: **Yeni → Təsdiqləndi → Göndərildi → Tamamlandı**, və ya **Ləğv edildi**.
4. Özünüz üçün **Qeyd** yaza bilərsiniz (müştəri görmür).

Yuxarıdakı axtarışla ad, telefon və ya sifariş nömrəsi (məs. `S-1042`) ilə sifariş tapa bilərsiniz. **Əsas** bölməsində bu günün, həftənin və ayın satışı görünür.

Əgər sifarişin yanında "Telegram bildirişi getməyib" yazılıbsa, sifariş yerindədir, sadəcə xəbər getməyib — **Yenidən göndər** basın və ya Telegram qoşulmasını yoxlayın (4-cü bölmə).

## 3. Görünüş: loqo, rənglər, əlaqə

- **Görünüş:** loqo, əsas və əlavə rəng, şrift, məhsulların düzülüşü (şəbəkə və ya siyahı), ana səhifənin bannerləri və ana səhifədə göstəriləcək kateqoriyalar. Dəyişikliyi **Önizləmə**də görüb sonra yadda saxlayın.
- **Ayarlar → Mağaza:** ad, qısa təsvir, valyuta.
- **Ayarlar → Əlaqə:** telefon, WhatsApp, e-poçt, ünvan, iş saatları, Instagram / Facebook / TikTok, xəritə linki.
- **Ayarlar → Sifarişlər:** sifariş qəbulunu açıb-bağlamaq, minimum məbləğ, çatdırılma haqqında qeyd, sifariş formasında hansı sahələrin olacağı və hansının məcburi olacağı, WhatsApp düyməsi.
- **Ayarlar → Axtarış sistemləri:** Google-da görünən başlıq və təsvir (boş qalsa mağaza adı istifadə olunur).
- **Səhifələr:** "Haqqımızda", "Çatdırılma", "Qaytarma şərtləri" kimi səhifələr. Sıraları menyudakı sıradır.

Mağaza bir neçə dildədirsə, məhsulda və səhifədə **Tərcümə** düyməsi ilə digər dillərdə mətn yaza bilərsiniz. Boş qalsa, əsas dildəki mətn göstərilir.

## 4. Telegram bildirişi

Telefonunuzda Telegram olmalıdır.

1. Telegram-da **@BotFather**-i açın, `/newbot` yazın, bota ad verin. BotFather sizə uzun bir **token** göndərəcək (məs. `123456:ABC...`). Onu kopyalayın.
2. Panel → **Ayarlar → Telegram bildirişləri** → tokeni yapışdırın.
3. Telegram-da yeni botunuzu açın və **/start** yazın.
4. Paneldə **Qoşul** basın. Bir neçə saniyəyə botdan test mesajı gələcək.

Bir neçə nəfər xəbər almalıdırsa: Telegram-da qrup yaradın, botu qrupa əlavə edin, qrupda bir mesaj yazın, sonra paneldə **Başqa bot və ya qrup qoş** → **Qoşul**.

İstənilən vaxt **Test mesajı göndər** ilə yoxlaya bilərsiniz.

## 5. Ehtiyat nüsxə (ayda bir dəfə)

Panel → **Ehtiyat nüsxə** → **Ehtiyat nüsxəni yüklə**. Bir fayl yüklənəcək — onu telefonda, kompüterdə və ya Google Drive-da saxlayın. Ayda bir dəfə, böyük dəyişikliklərdən əvvəl də edin.

Faylda məhsullar, kateqoriyalar, sifarişlər və ayarlar var. Şəkillər faylda yoxdur (onlar ayrıca saxlanır və silinmir).

**Bərpa:** eyni bölmədə **Bərpa et** → faylı seçin. Diqqət: bu, saytdakı hazırkı məlumatları fayldakılarla **əvəz edir** (təsdiq üçün düyməni iki dəfə basmaq lazımdır). Sonra səhifəni yeniləyin.

## 6. Excel ilə çoxlu məhsul

Panel → **Ehtiyat nüsxə → Excel (CSV) ilə məhsullar**.

- **Nümunə şablon**u və ya mövcud məhsullarınızı yükləyin, Excel-də açın, sətir əlavə edin və ya dəyişin, CSV kimi saxlayıb **İdxal et** ilə geri yükləyin.
- Kodu (SKU) uyğun gələn məhsul yenilənir, qalanları yeni məhsul kimi əlavə olunur.
- Şəkil və variantları Excel ilə əlavə etmək olmur — onları paneldə məhsulu açıb əlavə edin.

## 7. Şifrəni dəyişmək və ya unutmaq

**Dəyişmək:** Panel → **Hesab** → hazırkı şifrə + yeni şifrə → **Şifrəni dəyiş**.

**Unutmusunuzsa** (məhsullar, sifarişlər və ayarlar silinmir):

1. Kompüterdən **dash.cloudflare.com** açıb Cloudflare hesabınıza daxil olun.
2. Soldakı menyuda **Storage & Databases → D1 SQL Database** seçin.
3. Mağazanızın bazasını açın (adı adətən `magaza-db`).
4. **Console** vərəqini açın.
5. Bu mətni olduğu kimi yazın və **Execute** basın:

   ```sql
   DELETE FROM admin; DELETE FROM sessions;
   ```

6. Saytınızın `/admin` ünvanını açın. Yeni şifrə yaratmaq ekranı çıxacaq — yeni şifrəni yazın və panelə keçin.

Başqa heç nəyə toxunmayın. Bu konsolda başqa əmr yazmayın.

## 8. Yeniləmələr

Saytın yeni versiyası çıxanda (yeni imkanlar, düzəlişlər) onu istəsəniz özünüz ala bilərsiniz:

1. **github.com**-a daxil olun və mağazanızın repo-sunu açın.
2. Yuxarıda **Sync fork** → **Update branch** basın.
3. Bir neçə dəqiqəyə sayt avtomatik yenilənir. Məlumatlarınız qalır.

Hazırkı versiya nömrəsi panelin **Hesab** bölməsində görünür. Nə dəyişdiyini repo-dakı `CHANGELOG.md` faylında oxuya bilərsiniz.

Yeniləmədən əvvəl ehtiyat nüsxə almaq yaxşı vərdişdir (5-ci bölmə).

## 9. Təhlükəsizlik

- Panel şifrəsini heç kimə verməyin. Ən azı 8 simvol, ad və ya doğum tarixi olmasın.
- Cloudflare, GitHub və e-poçt hesablarınızda **iki addımlı giriş (2FA)** açıq qalsın, bərpa kodlarını saxlayın.
- Başqasının kompüterində paneldən istifadə etmisinizsə, **Hesab → Çıxış** edin.
- Telegram bot tokenini heç kimə göndərməyin. Başqasının əlinə keçibsə, BotFather-də `/revoke` ilə yeniləyib paneldə yenidən qoşun.

## 10. Tez-tez suallar

**Sifariş gəlib, amma Telegram-a xəbər gəlməyib.** Paneldə sifariş var. Ayarlar → Telegram → **Test mesajı göndər**. Gəlmirsə, botu yenidən qoşun (4-cü bölmə).

**Məhsul mağazada görünmür.** Məhsulun "Mağazada görünsün" düyməsi açıqdırmı? Kateqoriyası gizlədilməyib ki?

**Müştərilər sifariş verə bilmir.** Ayarlar → Sifarişlər → sifariş qəbulu açıqdırmı? Minimum məbləğ çox yüksək deyil ki? Məhsulun stoku 0 deyil ki?

**Şəkil yüklənmir.** Fayl şəkil olmalıdır (JPG, PNG, WebP), 5 MB-dan kiçik. Telefonun kamerası ilə çəkilmiş şəkillər avtomatik kiçildilir.

**Ödəniş lazımdırmı?** Cloudflare-in pulsuz planı kiçik və orta mağaza üçün kifayətdir. Domen üçün ildə bir dəfə domen haqqı ödənilir.
