# Təhvil yoxlama siyahısı

Hər yeni mağaza üçün bu siyahını yuxarıdan aşağı keç. Hər addım bitəndə `[ ]` → `[x]`. Siyahının bir nüsxəsini mağazanın adı ilə saxla (məs. `TEHVIL-ilme.md`).

Mağaza: ____________  Tarix: ____________  Quraşdıran: ____________

## 1. Hesablar (sahibkarın adına)

- [ ] Sahibkarın **öz e-poçtu** var və ona özü daxil ola bilir (hesablar bu ünvana bağlanacaq)
- [ ] **GitHub** hesabı açıldı (sahibkarın e-poçtu ilə)
- [ ] **Cloudflare** hesabı açıldı (sahibkarın e-poçtu ilə), e-poçt təsdiqləndi
- [ ] Şifrələr sahibkarın şifrə menecerinə / dəftərinə yazıldı; quraşdıran şifrəni yadda saxlamır

## 2. Cloudflare hazırlığı (düymədən əvvəl, bir dəfə)

- [ ] **R2 aktivləşdirildi:** panel → R2 Object Storage → aktivləşdir (pulsuz hədd 10 GB; kart istəyə bilər, pul tutulmur). Bunsuz xəta: `Please enable R2 ... [code: 10042]`
- [ ] **workers.dev subdomeni seçildi:** panel → Workers & Pages → subdomen (məs. `ilme` → `magaza.ilme.workers.dev`). Bunsuz xəta: `You need to register a workers.dev subdomain`

## 3. Deploy

- [ ] README-dəki **Deploy to Cloudflare** düyməsi basıldı (sahibkarın Cloudflare hesabı ilə daxil olaraq)
- [ ] GitHub qoşuldu, repo sahibkarın GitHub-una kopyalandı
- [ ] Worker / D1 / R2 adları yoxlandı (bir hesabda bir neçə mağaza varsa, fərqli adlar). Adlar sonradan **dəyişdirilmir**
- [ ] Build və deploy uğurla bitdi, sayt `https://<worker>.<subdomen>.workers.dev` ünvanında açılır
- [ ] `https://.../admin` açılır və quraşdırma sihirbazını göstərir

## 4. Quraşdırma sihirbazı (`/admin`)

Sahibkarla birlikdə, mümkünsə onun telefonundan:

- [ ] **Şifrə** — sahibkar özü yazır (ən azı 8 simvol), quraşdıran bilmir
- [ ] Mağaza adı, qısa təsvir, loqo
- [ ] Rənglər
- [ ] Əlaqə: telefon, WhatsApp, ünvan, sosial şəbəkələr
- [ ] Telegram (aşağıdakı 6-cı bölmədə yoxlanır; burada keçmək olar)
- [ ] Sektor seçildi (nümunə xüsusiyyətlər yarandı) və ya "özüm yaradacağam"
- [ ] "İdarə panelinə keç" → panel açıldı, **Hesab** bölməsində versiya görünür

## 5. Domen (varsa)

- [ ] Domen sahibkarın adına alınıb və **eyni Cloudflare hesabına** əlavə olunub (nameserver-lər Cloudflare-ə yönəldilib, status "Active")
- [ ] Workers & Pages → Worker → Settings → Domains & Routes → **Custom domain** → domen yazıldı (`magaza.az` və istəsən `www.magaza.az`)
- [ ] Domen HTTPS ilə açılır, `/admin` işləyir (giriş yenidən istənir — normaldır, cookie domenə bağlıdır)

## 6. Sınaq

- [ ] 2–3 məhsul əlavə edildi (telefondan, kamera ilə şəkil çəkərək) — mağazada görünür
- [ ] Ayarlar → Telegram: bot qoşuldu, **test mesajı** sahibkarın telefonuna gəldi
- [ ] Mağazadan **test sifarişi** verildi: təsdiq səhifəsi və sifariş nömrəsi çıxdı
- [ ] Telegram-a sifariş bildirişi gəldi, içindəki link paneldə həmin sifarişi açır
- [ ] WhatsApp düyməsi yandırılıbsa: sifarişdən sonra düymə çıxır, mətn düzgün nömrəyə gedir
- [ ] Paneldə sifarişin statusu dəyişdirildi; test sifarişi "Ləğv edildi" edildi
- [ ] Telefondan mağaza və panel yoxlandı (menyu, səbət, şəkillər)
- [ ] Ehtiyat nüsxə → **Ehtiyat nüsxəni yüklə** işləyir, fayl sahibkarın telefonuna / kompüterinə düşdü

## 7. Sahibkara təhvil

- [ ] `docs/SAHIBKAR_TELIMATI.md` sahibkara göndərildi (və ya çap olundu), birlikdə oxundu
- [ ] Sahibkar özü bir məhsul əlavə edib sildi, bir sifarişin statusunu dəyişdi
- [ ] "Şifrəni unutsam nə edim" bölməsi göstərildi (Cloudflare → D1 konsolu)
- [ ] Yeniləmə yolu göstərildi (GitHub → Sync fork)

## 8. Təhlükəsizlik və çıxış

- [ ] **GitHub-da 2FA** aktivdir (Settings → Password and authentication), bərpa kodları sahibkarda
- [ ] **Cloudflare-də 2FA** aktivdir (My Profile → Authentication), bərpa kodları sahibkarda
- [ ] E-poçt hesabında da 2FA aktivdir
- [ ] Cloudflare → Manage Account → **Members**: yalnız sahibkar var
- [ ] Cloudflare → My Profile → **API Tokens**: quraşdıranın yaratdığı token yoxdur (Workers Builds-in öz tokeni qala bilər)
- [ ] GitHub → repo → Settings → **Collaborators**: yalnız sahibkar
- [ ] Quraşdıranın brauzerində sahibkarın hesablarından çıxış edildi, saxlanmış şifrələr silindi
- [ ] Quraşdıranın kompüterində `wrangler login` sahibkarın hesabına edilibsə: `npx wrangler logout`
- [ ] Admin paneldə: Hesab → **Çıxış** (quraşdıranın sessiyası bağlandı)

Təhvil verdi: ____________  Təhvil aldı: ____________
