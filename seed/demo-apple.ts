/**
 * DEMO DATA — Apple line-up for the demo shop (merged in seed/demo-catalog.ts).
 * Prices: US list price × 1.70, rounded to whole manat. Stock is synthetic.
 * Texts are our own. Photos: Wikimedia Commons, credited in seed/images/credits.json.
 */

type LT = { az: string; ru?: string; en?: string };
type Val = { id: string; name: LT; swatch?: string; usd?: number };
type Opt = { id: string; name: LT; values: Val[] };

const azn = (usd: number) => Math.round(usd * 1.7);
const t = (az: string, ru: string, en: string): LT => ({ az, ru, en });

/* option names */
const N = {
  color: t("Rəng", "Цвет", "Colour"),
  memory: t("Yaddaş", "Память", "Storage"),
  ssd: t("Disk", "Диск", "Storage"),
  size: t("Korpus ölçüsü", "Размер корпуса", "Case size"),
  pack: t("Dəst", "Комплект", "Pack"),
  version: t("Versiya", "Версия", "Version"),
  length: t("Kabel uzunluğu", "Длина кабеля", "Cable length"),
};

/* colours (az label is the stored value) */
const c = (id: string, az: string, ru: string, en: string, swatch: string, usd = 0): Val => ({ id, name: t(az, ru, en), swatch, usd });
const K = {
  orange: c("orange", "Kosmik narıncı", "Космический оранжевый", "Cosmic orange", "#e8743b"),
  deepBlue: c("deep-blue", "Tünd göy", "Глубокий синий", "Deep blue", "#2f3e5a"),
  silver: c("silver", "Gümüşü", "Серебристый", "Silver", "#e3e4e6"),
  spaceBlack: c("space-black", "Kosmik qara", "Космический чёрный", "Space black", "#2e2e30"),
  skyBlue: c("sky-blue", "Səma mavisi", "Небесно-голубой", "Sky blue", "#c9dbe9"),
  lightGold: c("light-gold", "Açıq qızılı", "Светло-золотой", "Light gold", "#ece0c8"),
  cloudWhite: c("cloud-white", "Bulud ağı", "Облачно-белый", "Cloud white", "#f4f3ef"),
  black: c("black", "Qara", "Чёрный", "Black", "#1e1e1e"),
  white: c("white", "Ağ", "Белый", "White", "#f5f5f3"),
  mistBlue: c("mist-blue", "Duman mavisi", "Туманно-голубой", "Mist blue", "#a9bfd6"),
  sage: c("sage", "Adaçayı", "Шалфей", "Sage", "#b7c3a8"),
  lavender: c("lavender", "Lavanda", "Лавандовый", "Lavender", "#d3c6e3"),
  starlight: c("starlight", "Ulduz işığı", "Сияющая звезда", "Starlight", "#ece4d6"),
  midnight: c("midnight", "Gecə yarısı", "Тёмная ночь", "Midnight", "#2c3340"),
  blue: c("blue", "Mavi", "Голубой", "Blue", "#7d9cc9"),
  green: c("green", "Yaşıl", "Зелёный", "Green", "#a6c9a1"),
  pink: c("pink", "Çəhrayı", "Розовый", "Pink", "#f0c3c4"),
  yellow: c("yellow", "Sarı", "Жёлтый", "Yellow", "#f3d77a"),
  orangeSoft: c("orange-soft", "Narıncı", "Оранжевый", "Orange", "#f0a46b"),
  purple: c("purple", "Bənövşəyi", "Фиолетовый", "Purple", "#b8a6d9"),
  spaceGrey: c("space-grey", "Kosmik boz", "Серый космос", "Space grey", "#7d7e80"),
  jetBlack: c("jet-black", "Parlaq qara", "Глянцевый чёрный", "Jet black", "#141416"),
  roseGold: c("rose-gold", "Çəhrayı qızılı", "Розовое золото", "Rose gold", "#e9c7b8"),
  naturalTi: c("natural", "Təbii titan", "Натуральный титан", "Natural titanium", "#bab4a8"),
  blackTi: c("black", "Qara titan", "Чёрный титан", "Black titanium", "#2b2b2d"),
};
const colors = (...v: Val[]): Opt => ({ id: "color", name: N.color, values: v });
const plain = (id: string, label: string, usd = 0): Val => ({ id, name: { az: label }, usd });
const storage = (...v: [string, number][]): Opt => ({
  id: "memory",
  name: N.memory,
  values: v.map(([s, usd]) => plain(s.replace(" ", "").toLowerCase(), s, usd)),
});
const ssd = (...v: [string, number][]): Opt => ({
  id: "ssd",
  name: N.ssd,
  values: v.map(([s, usd]) => plain(s.replace(" ", "").toLowerCase(), `${s} SSD`, usd)),
});

/* specs */
const S = {
  display: t("Ekran", "Экран", "Display"),
  chip: t("Çip", "Чип", "Chip"),
  camera: t("Kamera", "Камера", "Camera"),
  battery: t("Batareya", "Батарея", "Battery"),
  ram: t("Operativ yaddaş", "Оперативная память", "Memory"),
  weight: t("Çəki", "Вес", "Weight"),
  warranty: t("Zəmanət", "Гарантия", "Warranty"),
};
const spec = (name: LT, value: string | LT) => ({ name, value: typeof value === "string" ? { az: value } : value });
const year = spec(S.warranty, t("1 il", "1 год", "1 year"));
const hours = (h: number) => t(`${h} saata qədər`, `до ${h} ч`, `up to ${h} h`);

/* deterministic synthetic stock: mostly in stock, a few sold out */
const STOCK = [6, 3, 9, 2, 0, 5, 4, 8, 1, 7, 3, 12];
let seed = 0;

type Def = {
  slug: string;
  category: string;
  name: string;
  summary: LT;
  description: LT;
  images: string[];
  usd: number;
  options?: Opt[];
  specs: { name: LT; value: LT }[];
  featured?: boolean;
  oldUsd?: number;
};

let day = 0;
function product(d: Def) {
  const options = d.options ?? [];
  // cartesian product of option values
  let combos: Val[][] = [[]];
  for (const o of options) combos = combos.flatMap((cmb) => o.values.map((v) => [...cmb, v]));
  const variants = combos.map((cmb) => {
    const usd = d.usd + cmb.reduce((s, v) => s + (v.usd ?? 0), 0);
    const old = d.oldUsd ? d.oldUsd + cmb.reduce((s, v) => s + (v.usd ?? 0), 0) : undefined;
    return {
      id: cmb.map((v) => v.id).join("-") || "default",
      values: Object.fromEntries(cmb.map((v, i) => [options[i].id, v.id])),
      price: azn(usd),
      ...(old ? { oldPrice: azn(old) } : {}),
      stock: STOCK[seed++ % STOCK.length],
    };
  });
  const added = new Date(Date.UTC(2026, 10, 8) - day++ * 86_400_000 * 0.5).toISOString().slice(0, 10);
  return {
    id: `apple-${d.slug}`,
    slug: d.slug,
    category: d.category,
    brand: "Apple",
    name: { az: d.name },
    summary: d.summary,
    description: d.description,
    images: d.images.map((f) => `/demo/${f}`),
    options: options.map((o) => ({ ...o, values: o.values.map((v) => ({ id: v.id, name: v.name, ...(v.swatch ? { swatch: v.swatch } : {}) })) })),
    variants,
    specs: d.specs,
    featured: d.featured,
    addedAt: added,
  };
}

const proColors = colors(K.orange, K.deepBlue, K.silver);

export const appleCategories = [
  { id: "desktops", name: { az: "Masaüstü", ru: "Настольные", en: "Desktops" }, image: "/demo/imac-m4.jpg" },
];

export const appleProducts = [
  /* ── phones ── */
  product({
    slug: "iphone-17-pro-max",
    category: "phones",
    name: "iPhone 17 Pro Max",
    summary: t(
      "Ən böyük ekran, ən uzun batareya, üç 48 MP kamera",
      "Самый большой экран, самая долгая батарея, три камеры 48 Мп",
      "The biggest screen, the longest battery, three 48 MP cameras",
    ),
    description: t(
      "Alüminium gövdə, buxar kamerası ilə soyudulan A19 Pro çipi və 8 dəfə optik yaxınlaşdırma. Uzun səfər və çox çəkiliş edənlər üçün.",
      "Алюминиевый корпус, чип A19 Pro с испарительной камерой охлаждения и 8‑кратный оптический зум. Для долгих поездок и активной съёмки.",
      "Aluminium unibody, an A19 Pro chip cooled by a vapour chamber and 8× optical zoom. Made for long trips and lots of shooting.",
    ),
    images: ["iphone-17-pro-max-orange.jpg", "iphone-17-pro-max-blue.jpg", "iphone-17-pro-max-silver.jpg"],
    usd: 1199,
    options: [storage(["256 GB", 0], ["512 GB", 200], ["1 TB", 400], ["2 TB", 800]), proColors],
    specs: [spec(S.display, "6,9″ OLED, 120 Hz"), spec(S.chip, "A19 Pro"), spec(S.camera, "48 + 48 + 48 MP"), spec(S.battery, hours(37)), year],
    featured: true,
  }),
  product({
    slug: "iphone-17-pro",
    category: "phones",
    name: "iPhone 17 Pro",
    summary: t("Pro kamera sistemi, yığcam ölçüdə", "Pro‑камеры в компактном корпусе", "Pro cameras in a compact size"),
    description: t(
      "Pro Max-ın bütün kamera imkanları 6,3 düymlük gövdədə. Arxa paneldə Ceramic Shield, ön kamera 18 MP.",
      "Все камеры Pro Max в корпусе 6,3 дюйма. Ceramic Shield на задней панели, фронтальная камера 18 Мп.",
      "Every Pro Max camera in a 6.3-inch body. Ceramic Shield on the back, 18 MP front camera.",
    ),
    images: ["iphone-17-pro-silver.jpg", "iphone-17-pro-orange-back.jpg", "iphone-17-family.jpg"],
    usd: 1099,
    options: [storage(["256 GB", 0], ["512 GB", 200], ["1 TB", 400]), proColors],
    specs: [spec(S.display, "6,3″ OLED, 120 Hz"), spec(S.chip, "A19 Pro"), spec(S.camera, "48 + 48 + 48 MP"), spec(S.battery, hours(31)), year],
    featured: true,
  }),
  product({
    slug: "iphone-air",
    category: "phones",
    name: "iPhone Air",
    summary: t("İndiyədək ən nazik iPhone — 5,6 mm", "Самый тонкий iPhone — 5,6 мм", "The thinnest iPhone yet — 5.6 mm"),
    description: t(
      "Titan çərçivə, hər iki tərəfdə Ceramic Shield və 6,5 düymlük ekran. Əldə demək olar hiss olunmur.",
      "Титановая рамка, Ceramic Shield с обеих сторон и экран 6,5 дюйма. В руке почти не ощущается.",
      "Titanium frame, Ceramic Shield on both sides and a 6.5-inch display. You barely feel it in your hand.",
    ),
    images: ["iphone-air-blue.jpg", "iphone-air-black.jpg", "iphone-air-gold.jpg"],
    usd: 999,
    options: [storage(["256 GB", 0], ["512 GB", 200], ["1 TB", 400]), colors(K.skyBlue, K.spaceBlack, K.lightGold, K.cloudWhite)],
    specs: [spec(S.display, "6,5″ OLED, 120 Hz"), spec(S.chip, "A19 Pro"), spec(S.camera, "48 MP"), spec(S.weight, "165 g"), year],
    featured: true,
  }),
  product({
    slug: "iphone-17",
    category: "phones",
    name: "iPhone 17",
    summary: t("120 Hz ekran, 256 GB-dan başlayır", "Экран 120 Гц, от 256 ГБ", "120 Hz display, from 256 GB"),
    description: t(
      "Daha böyük və parlaq ProMotion ekran, iki 48 MP kamera və mərkəzdə qalan Center Stage ön kamerası. Beş incə rəngdə.",
      "Больший и более яркий экран ProMotion, две камеры 48 Мп и фронтальная камера Center Stage. Пять мягких цветов.",
      "A larger, brighter ProMotion display, two 48 MP cameras and a Center Stage front camera. In five soft colours.",
    ),
    images: ["iphone-17-sage.jpg", "iphone-17-lavender.jpg", "iphone-17-mist-blue.jpg", "iphone-17-black.jpg", "iphone-17-white.jpg"],
    usd: 799,
    options: [storage(["256 GB", 0], ["512 GB", 200]), colors(K.sage, K.lavender, K.mistBlue, K.black, K.white)],
    specs: [spec(S.display, "6,3″ OLED, 120 Hz"), spec(S.chip, "A19"), spec(S.camera, "48 + 48 MP"), spec(S.battery, hours(30)), year],
    featured: true,
  }),
  product({
    slug: "iphone-16e",
    category: "phones",
    name: "iPhone 16e",
    summary: t("Əsas iPhone imkanları, sərfəli qiymətə", "Главное от iPhone по доступной цене", "The iPhone essentials at a friendly price"),
    description: t(
      "A18 çipi, 48 MP kamera və uzun batareya ömrü. İlk iPhone və ya ikinci telefon üçün yaxşı seçim.",
      "Чип A18, камера 48 Мп и долгая работа от батареи. Хороший выбор для первого iPhone или второго телефона.",
      "A18 chip, 48 MP camera and long battery life. A good pick for a first iPhone or a second phone.",
    ),
    images: ["iphone-16e.jpg", "iphone-16e-front.jpg"],
    usd: 599,
    options: [storage(["128 GB", 0], ["256 GB", 100], ["512 GB", 300]), colors(K.black, K.white)],
    specs: [spec(S.display, "6,1″ OLED"), spec(S.chip, "A18"), spec(S.camera, "48 MP"), spec(S.battery, hours(26)), year],
  }),

  /* ── laptops ── */
  product({
    slug: "macbook-air-13-m4",
    category: "laptops",
    name: "MacBook Air 13″ M4",
    summary: t("Yüngül, səssiz, bütün günlük batareya", "Лёгкий, бесшумный, батарея на весь день", "Light, silent, all-day battery"),
    description: t(
      "Ventilyatorsuz M4 noutbuku: 1,24 kq, 18 saata qədər işləmə və iki xarici monitor dəstəyi. Dərs, ofis və səyahət üçün.",
      "Ноутбук на M4 без вентилятора: 1,24 кг, до 18 часов работы и поддержка двух внешних мониторов. Для учёбы, офиса и поездок.",
      "A fanless M4 laptop: 1.24 kg, up to 18 hours of battery and support for two external displays. For study, work and travel.",
    ),
    images: ["macbook-air-13.jpg"],
    usd: 999,
    options: [ssd(["256 GB", 0], ["512 GB", 200], ["1 TB", 400]), colors(K.skyBlue, K.silver, K.starlight, K.midnight)],
    specs: [spec(S.display, "13,6″ Liquid Retina"), spec(S.chip, "M4"), spec(S.ram, "16 GB"), spec(S.weight, "1,24 kq"), spec(S.battery, hours(18)), year],
    featured: true,
  }),
  product({
    slug: "macbook-air-15-m4",
    category: "laptops",
    name: "MacBook Air 15″ M4",
    summary: t("Böyük ekran, yenə də nazik və yüngül", "Большой экран и всё так же тонкий", "A big screen, still thin and light"),
    description: t(
      "15,3 düymlük ekran, altı dinamik və M4 çipi. Cədvəllər və iki pəncərə ilə rahat iş üçün geniş sahə.",
      "Экран 15,3 дюйма, шесть динамиков и чип M4. Много места для таблиц и работы в двух окнах.",
      "A 15.3-inch display, six speakers and the M4 chip. Plenty of room for spreadsheets and two windows side by side.",
    ),
    images: ["macbook-air-15.jpg"],
    usd: 1199,
    options: [ssd(["256 GB", 0], ["512 GB", 200], ["1 TB", 400]), colors(K.skyBlue, K.silver, K.starlight, K.midnight)],
    specs: [spec(S.display, "15,3″ Liquid Retina"), spec(S.chip, "M4"), spec(S.ram, "16 GB"), spec(S.weight, "1,51 kq"), spec(S.battery, hours(18)), year],
  }),
  product({
    slug: "macbook-pro-14-m5",
    category: "laptops",
    name: "MacBook Pro 14″ M5",
    summary: t("Peşəkar ekran, M5 gücü", "Профессиональный экран и мощность M5", "A pro display with M5 power"),
    description: t(
      "Liquid Retina XDR ekran, HDMI, SD kart yuvası və MagSafe. Foto, video və proqramlaşdırma üçün səssiz və güclü.",
      "Экран Liquid Retina XDR, HDMI, слот SD и MagSafe. Тихий и мощный для фото, видео и программирования.",
      "Liquid Retina XDR display, HDMI, an SD slot and MagSafe. Quiet and powerful for photos, video and code.",
    ),
    images: ["macbook-pro-14.jpg"],
    usd: 1599,
    options: [ssd(["512 GB", 0], ["1 TB", 200]), colors(K.spaceBlack, K.silver)],
    specs: [spec(S.display, "14,2″ Liquid Retina XDR"), spec(S.chip, "M5"), spec(S.ram, "16 GB"), spec(S.weight, "1,55 kq"), spec(S.battery, hours(24)), year],
  }),
  product({
    slug: "macbook-pro-16-m4-pro",
    category: "laptops",
    name: "MacBook Pro 16″ M4 Pro",
    summary: t("Ən böyük Mac noutbuku, ağır işlər üçün", "Самый большой MacBook для тяжёлых задач", "The biggest Mac laptop, built for heavy work"),
    description: t(
      "M4 Pro çipi, 24 GB yaddaş və 16 düymlük XDR ekran. Montaj, 3D və böyük layihələr üçün, adapterdən uzaqda belə.",
      "Чип M4 Pro, 24 ГБ памяти и экран XDR 16 дюймов. Для монтажа, 3D и больших проектов — даже без розетки.",
      "M4 Pro chip, 24 GB memory and a 16-inch XDR display. For editing, 3D and big projects — even away from the plug.",
    ),
    images: ["macbook-pro-16.jpg"],
    usd: 2499,
    options: [ssd(["512 GB", 0], ["1 TB", 200]), colors(K.spaceBlack, K.silver)],
    specs: [spec(S.display, "16,2″ Liquid Retina XDR"), spec(S.chip, "M4 Pro"), spec(S.ram, "24 GB"), spec(S.weight, "2,14 kq"), spec(S.battery, hours(24)), year],
  }),

  /* ── desktops ── */
  product({
    slug: "imac-24-m4",
    category: "desktops",
    name: "iMac 24″ M4",
    summary: t("Hamısı bir yerdə, yeddi rəngdə", "Всё в одном, в семи цветах", "All-in-one, in seven colours"),
    description: t(
      "4.5K Retina ekran, 12 MP Center Stage kamera və rəngə uyğun klaviatura və siçan. Ev və qəbul masası üçün səliqəli kompüter.",
      "Экран Retina 4.5K, камера Center Stage 12 Мп, клавиатура и мышь в цвет. Аккуратный компьютер для дома и ресепшена.",
      "A 4.5K Retina display, 12 MP Center Stage camera and a colour-matched keyboard and mouse. A tidy computer for home or the front desk.",
    ),
    images: ["imac-m4.jpg"],
    usd: 1299,
    options: [ssd(["256 GB", 0], ["512 GB", 200], ["1 TB", 400]), colors(K.blue, K.green, K.pink, K.silver, K.yellow, K.orangeSoft, K.purple)],
    specs: [spec(S.display, "24″ 4.5K Retina"), spec(S.chip, "M4"), spec(S.ram, "16 GB"), year],
  }),
  product({
    slug: "mac-mini-m4",
    category: "desktops",
    name: "Mac mini M4",
    summary: t("Ovuc boyda, böyük gücdə", "Размером с ладонь, но очень мощный", "Palm-sized, seriously capable"),
    description: t(
      "12,7 sm-lik kiçik gövdədə M4 çipi, önündə USB‑C və qulaqlıq yuvası. Öz monitorunuza, klaviaturanıza qoşun.",
      "Чип M4 в корпусе 12,7 см, спереди USB‑C и разъём для наушников. Подключите свой монитор и клавиатуру.",
      "An M4 chip in a 12.7 cm box, with USB‑C and a headphone jack on the front. Plug in your own display and keyboard.",
    ),
    images: ["mac-mini.jpg", "mac-mini-back.jpg"],
    usd: 599,
    options: [ssd(["256 GB", 0], ["512 GB", 200], ["1 TB", 400])],
    specs: [spec(S.chip, "M4"), spec(S.ram, "16 GB"), spec(S.weight, "0,67 kq"), year],
    featured: true,
  }),
  product({
    slug: "mac-studio",
    category: "desktops",
    name: "Mac Studio M4 Max",
    summary: t("Studiyalar üçün masaüstü güc", "Настольная мощность для студий", "Desktop power for studios"),
    description: t(
      "M4 Max çipi, 36 GB yaddaş və çoxlu port: Thunderbolt 5, 10 Gb Ethernet, HDMI, SD kart. Səssiz işləyir.",
      "Чип M4 Max, 36 ГБ памяти и много портов: Thunderbolt 5, 10 Гбит Ethernet, HDMI, SD. Работает тихо.",
      "M4 Max chip, 36 GB memory and plenty of ports: Thunderbolt 5, 10 Gb Ethernet, HDMI and SD. Runs quietly.",
    ),
    images: ["mac-studio.jpg", "desk-setup.jpg"],
    usd: 1999,
    options: [ssd(["512 GB", 0], ["1 TB", 200])],
    specs: [spec(S.chip, "M4 Max"), spec(S.ram, "36 GB"), spec(S.weight, "2,74 kq"), year],
  }),
  product({
    slug: "studio-display",
    category: "desktops",
    name: "Studio Display",
    summary: t("27 düymlük 5K Retina monitor", "Монитор 27 дюймов 5K Retina", "27-inch 5K Retina monitor"),
    description: t(
      "Mac üçün 5K monitor: daxili 12 MP kamera, üç mikrofon və altı dinamik. Bir kabellə noutbuku da şarj edir.",
      "Монитор 5K для Mac: встроенная камера 12 Мп, три микрофона и шесть динамиков. Заряжает ноутбук одним кабелем.",
      "A 5K display for the Mac with a built-in 12 MP camera, three mics and six speakers. Charges your laptop over one cable.",
    ),
    images: ["studio-display.jpg", "desk-setup.jpg"],
    usd: 1599,
    specs: [spec(S.display, "27″ 5K Retina, 600 nit"), spec(S.camera, "12 MP"), year],
  }),

  /* ── tablets ── */
  product({
    slug: "ipad-pro-11-m5",
    category: "tablets",
    name: "iPad Pro 11″ M5",
    summary: t("Ultra Retina XDR, 5,3 mm nazikliyində", "Ultra Retina XDR толщиной 5,3 мм", "Ultra Retina XDR at 5.3 mm thin"),
    description: t(
      "Tandem OLED ekran, M5 çipi və Apple Pencil Pro dəstəyi. Rəsm, montaj və qeydlər üçün ən güclü iPad.",
      "Экран Tandem OLED, чип M5 и поддержка Apple Pencil Pro. Самый мощный iPad для рисования, монтажа и заметок.",
      "Tandem OLED display, M5 chip and Apple Pencil Pro support. The most capable iPad for drawing, editing and notes.",
    ),
    images: ["ipad-pro-store.jpg"],
    usd: 999,
    options: [storage(["256 GB", 0], ["512 GB", 200], ["1 TB", 600]), colors(K.spaceBlack, K.silver)],
    specs: [spec(S.display, "11″ Ultra Retina XDR"), spec(S.chip, "M5"), spec(S.weight, "444 g"), year],
    featured: true,
  }),
  product({
    slug: "ipad-pro-13-m5",
    category: "tablets",
    name: "iPad Pro 13″ M5",
    summary: t("Böyük kətan, Pro gücü", "Большой холст и мощность Pro", "A big canvas with Pro power"),
    description: t(
      "13 düymlük Ultra Retina XDR ekran və M5. Magic Keyboard ilə noutbuku əvəz edə bilər.",
      "Экран Ultra Retina XDR 13 дюймов и M5. С Magic Keyboard может заменить ноутбук.",
      "A 13-inch Ultra Retina XDR display and M5. With a Magic Keyboard it can stand in for a laptop.",
    ),
    images: ["ipad-pro-store-2.jpg"],
    usd: 1299,
    options: [storage(["256 GB", 0], ["512 GB", 200], ["1 TB", 600]), colors(K.spaceBlack, K.silver)],
    specs: [spec(S.display, "13″ Ultra Retina XDR"), spec(S.chip, "M5"), spec(S.weight, "579 g"), year],
  }),
  product({
    slug: "ipad-air-11-m3",
    category: "tablets",
    name: "iPad Air 11″ M3",
    summary: t("Yüngül, sürətli, dörd rəngdə", "Лёгкий, быстрый, в четырёх цветах", "Light, fast, in four colours"),
    description: t(
      "M3 çipi, Liquid Retina ekran və Touch ID. Dərs, oxu və yaradıcılıq üçün ən balanslı iPad.",
      "Чип M3, экран Liquid Retina и Touch ID. Самый сбалансированный iPad для учёбы, чтения и творчества.",
      "M3 chip, Liquid Retina display and Touch ID. The most balanced iPad for study, reading and creative work.",
    ),
    images: ["ipad-air-back.jpg", "ipad-air-store.jpg"],
    usd: 599,
    options: [storage(["128 GB", 0], ["256 GB", 100], ["512 GB", 300]), colors(K.blue, K.purple, K.starlight, K.spaceGrey)],
    specs: [spec(S.display, "11″ Liquid Retina"), spec(S.chip, "M3"), spec(S.weight, "460 g"), year],
  }),
  product({
    slug: "ipad-mini-a17-pro",
    category: "tablets",
    name: "iPad mini",
    summary: t("Bir əldə tutulan tam iPad", "Полноценный iPad в одной руке", "A full iPad you hold in one hand"),
    description: t(
      "8,3 düymlük ekran, A17 Pro çipi və Apple Pencil Pro dəstəyi. Oxumaq, qeyd və səyahət üçün çantaya sığır.",
      "Экран 8,3 дюйма, чип A17 Pro и поддержка Apple Pencil Pro. Помещается в сумку — для чтения, заметок и поездок.",
      "An 8.3-inch display, A17 Pro chip and Apple Pencil Pro support. Fits any bag — for reading, notes and travel.",
    ),
    images: ["ipad-mini-back.jpg", "ipad-mini-front.jpg"],
    usd: 499,
    options: [storage(["128 GB", 0], ["256 GB", 100], ["512 GB", 300]), colors(K.starlight, K.blue, K.purple, K.spaceGrey)],
    specs: [spec(S.display, "8,3″ Liquid Retina"), spec(S.chip, "A17 Pro"), spec(S.weight, "293 g"), year],
  }),
  product({
    slug: "ipad-11-a16",
    category: "tablets",
    name: "iPad 11″",
    summary: t("Hər gün üçün iPad", "iPad на каждый день", "The everyday iPad"),
    description: t(
      "A16 çipi, 11 düymlük ekran və şən rənglər. Film, dərs və video zənglər üçün sərfəli seçim.",
      "Чип A16, экран 11 дюймов и яркие цвета. Выгодный выбор для фильмов, учёбы и видеозвонков.",
      "A16 chip, an 11-inch display and cheerful colours. A sensible choice for films, school and video calls.",
    ),
    images: ["ipad-11.jpg"],
    usd: 349,
    options: [storage(["128 GB", 0], ["256 GB", 100], ["512 GB", 300]), colors(K.blue, K.pink, K.yellow, K.silver)],
    specs: [spec(S.display, "11″ Liquid Retina"), spec(S.chip, "A16"), spec(S.weight, "477 g"), year],
  }),

  /* ── audio ── */
  product({
    slug: "airpods-4",
    category: "audio",
    name: "AirPods 4",
    summary: t("Yeni forma, istəsəniz səs-küy azaltma ilə", "Новая форма, по желанию с шумоподавлением", "A new fit, with optional noise cancellation"),
    description: t(
      "Qulağa daha rahat oturan forma və USB‑C qutu. Səs-küy azaltma versiyası metro və ofis üçün daha sakitdir.",
      "Более удобная форма и кейс с USB‑C. Версия с шумоподавлением тише в метро и офисе.",
      "A more comfortable shape and a USB‑C case. The noise-cancelling version keeps the metro and office quieter.",
    ),
    images: ["airpods-4.jpg"],
    usd: 129,
    options: [
      {
        id: "version",
        name: N.version,
        values: [
          { id: "standard", name: t("Standart", "Стандарт", "Standard") },
          { id: "anc", name: t("Səs-küy azaltma ilə", "С шумоподавлением", "With noise cancellation"), usd: 50 },
        ],
      },
    ],
    specs: [spec(S.battery, hours(30)), spec(S.chip, "H2"), year],
  }),
  product({
    slug: "airpods-pro-3",
    category: "audio",
    name: "AirPods Pro 3",
    summary: t("Güclü səs-küy azaltma, nəbz ölçmə", "Мощное шумоподавление и пульсометр", "Strong noise cancellation and heart-rate sensing"),
    description: t(
      "Əvvəlkindən iki dəfə güclü səs-küy azaltma, idman zamanı nəbz ölçmə və 8 saata qədər dinləmə.",
      "Шумоподавление вдвое сильнее прежнего, измерение пульса во время тренировок и до 8 часов прослушивания.",
      "Noise cancellation twice as strong as before, heart-rate sensing during workouts and up to 8 hours of listening.",
    ),
    images: ["airpods-pro-3.jpg", "airpods-pro-3-case.jpg"],
    usd: 249,
    specs: [spec(S.battery, hours(8)), spec(S.chip, "H2"), year],
    featured: true,
  }),
  product({
    slug: "airpods-max",
    category: "audio",
    name: "AirPods Max",
    summary: t("Qulaqüstü, studiya səviyyəli səs", "Накладные, со студийным звуком", "Over-ear, studio-grade sound"),
    description: t(
      "Alüminium qapaqlar, toxunulan tac və aktiv səs-küy azaltma. USB‑C ilə şarj və itkisiz səs.",
      "Алюминиевые чашки, колёсико Digital Crown и активное шумоподавление. Зарядка и звук без потерь по USB‑C.",
      "Aluminium ear cups, a Digital Crown and active noise cancellation. USB‑C charging and lossless audio.",
    ),
    images: ["airpods-max.jpg", "airpods-max-2.jpg"],
    usd: 549,
    options: [colors(K.midnight, K.starlight, K.blue, K.purple, K.orangeSoft)],
    specs: [spec(S.battery, hours(20)), spec(S.weight, "385 g"), year],
  }),
  product({
    slug: "homepod-mini",
    category: "audio",
    name: "HomePod mini",
    summary: t("Kiçik ağıllı dinamik, otağı doldurur", "Маленькая умная колонка с большим звуком", "A small smart speaker that fills the room"),
    description: t(
      "360° səs, Siri və evdəki ağıllı cihazların idarəsi. iPhone-u yaxınlaşdıraraq musiqini ötürün.",
      "Звук 360°, Siri и управление умным домом. Поднесите iPhone, чтобы передать музыку.",
      "360° sound, Siri and smart-home control. Bring your iPhone close to hand the music over.",
    ),
    images: ["homepod-mini-orange.jpg", "homepod-mini.jpg"],
    usd: 99,
    options: [colors(K.orangeSoft, K.white, K.midnight, K.yellow, K.blue)],
    specs: [spec(S.weight, "345 g"), year],
  }),

  /* ── watches ── */
  product({
    slug: "apple-watch-series-10",
    category: "watches",
    name: "Apple Watch Series 10",
    summary: t("Ən nazik Apple Watch, böyük ekran", "Самые тонкие Apple Watch с большим экраном", "The thinnest Apple Watch, with a big screen"),
    description: t(
      "Geniş bucaqlı OLED ekran, sürətli şarj, yuxu və nəbz izləmə. Gündəlik geyim üçün yüngül alüminium korpus.",
      "Широкоугольный OLED, быстрая зарядка, отслеживание сна и пульса. Лёгкий алюминиевый корпус на каждый день.",
      "A wide-angle OLED display, fast charging, sleep and heart tracking. A light aluminium case for every day.",
    ),
    images: ["watch-series-10.jpg"],
    usd: 399,
    options: [
      { id: "size", name: N.size, values: [plain("42", "42 mm"), plain("46", "46 mm", 30)] },
      colors(K.jetBlack, K.roseGold, K.silver),
    ],
    specs: [spec(S.display, t("OLED, həmişə aktiv", "OLED, всегда включён", "Always-on OLED")), spec(S.chip, "S10"), spec(S.battery, hours(18)), year],
  }),
  product({
    slug: "apple-watch-ultra-3",
    category: "watches",
    name: "Apple Watch Ultra 3",
    summary: t("Titan korpus, səyahət və idman üçün", "Титановый корпус для путешествий и спорта", "Titanium case for adventure and sport"),
    description: t(
      "49 mm titan korpus, ən parlaq ekran və 42 saata qədər batareya. Dalış, dağ və uzun qaçışlar üçün.",
      "Титановый корпус 49 мм, самый яркий экран и до 42 часов работы. Для дайвинга, гор и длинных забегов.",
      "A 49 mm titanium case, the brightest display and up to 42 hours of battery. For diving, mountains and long runs.",
    ),
    images: ["watch-ultra-3.jpg"],
    usd: 799,
    options: [colors(K.naturalTi, K.blackTi)],
    specs: [spec(S.display, "49 mm, 3000 nit"), spec(S.chip, "S10"), spec(S.battery, hours(42)), year],
    featured: true,
  }),
  product({
    slug: "apple-watch-se",
    category: "watches",
    name: "Apple Watch SE",
    summary: t("Əsas Apple Watch imkanları, sərfəli", "Главное от Apple Watch по доступной цене", "Apple Watch essentials at a friendly price"),
    description: t(
      "Bildirişlər, məşq izləmə, yıxılma aşkarlama və təcili zəng. İlk saat və ya uşaq üçün yaxşı seçim.",
      "Уведомления, тренировки, обнаружение падения и экстренный вызов. Хороший выбор для первых часов или ребёнка.",
      "Notifications, workout tracking, fall detection and emergency calls. A good first watch, or one for the kids.",
    ),
    images: ["watch-se.jpg"],
    usd: 249,
    options: [
      { id: "size", name: N.size, values: [plain("40", "40 mm"), plain("44", "44 mm", 30)] },
      colors(K.midnight, K.starlight),
    ],
    specs: [spec(S.display, "Retina OLED"), spec(S.battery, hours(18)), year],
  }),

  /* ── accessories ── */
  product({
    slug: "apple-pencil-pro",
    category: "accessories",
    name: "Apple Pencil Pro",
    summary: t("Sıxma jesti, fırlanma və titrəmə hissi", "Сжатие, вращение и тактильный отклик", "Squeeze, barrel roll and haptic feedback"),
    description: t(
      "Qələmi sıxaraq alətlər panelini açın, fırladaraq fırçanın bucağını dəyişin. iPad-in yanına maqnitlə yapışıb şarj olunur.",
      "Сожмите, чтобы открыть панель инструментов, вращайте, чтобы менять угол кисти. Крепится к iPad магнитом и заряжается.",
      "Squeeze to open the tool palette, roll to turn the brush. It snaps to the side of the iPad to pair and charge.",
    ),
    images: ["apple-pencil-pro.png"],
    usd: 129,
    specs: [year],
  }),
  product({
    slug: "magic-keyboard-touch-id",
    category: "accessories",
    name: "Magic Keyboard (Touch ID)",
    summary: t("Simsiz klaviatura, barmaq izi ilə giriş", "Беспроводная клавиатура со входом по отпечатку", "Wireless keyboard with fingerprint sign-in"),
    description: t(
      "Səssiz düymələr, Touch ID və bir ay davam edən batareya. Apple çipli Mac-larla işləyir, USB‑C ilə şarj olunur.",
      "Тихие клавиши, Touch ID и батарея на месяц. Работает с Mac на чипах Apple, заряжается по USB‑C.",
      "Quiet keys, Touch ID and a battery that lasts about a month. Works with Apple-silicon Macs and charges over USB‑C.",
    ),
    images: ["magic-keyboard.jpg"],
    usd: 149,
    options: [colors(K.white, { ...K.black, usd: 30 })],
    specs: [year],
  }),
  product({
    slug: "magic-mouse",
    category: "accessories",
    name: "Magic Mouse",
    summary: t("Toxunuşla idarə olunan siçan", "Мышь с сенсорной поверхностью", "A mouse with a touch surface"),
    description: t(
      "Üst səth barmaq jestlərini tanıyır: sürüşdürmə, səhifə çevirmə. USB‑C ilə şarj olunur.",
      "Поверхность распознаёт жесты: прокрутка, перелистывание страниц. Заряжается по USB‑C.",
      "The top surface reads gestures for scrolling and swiping between pages. Charges over USB‑C.",
    ),
    images: ["magic-mouse.jpg"],
    usd: 79,
    options: [colors(K.white, { ...K.black, usd: 20 })],
    specs: [year],
  }),
  product({
    slug: "magic-trackpad",
    category: "accessories",
    name: "Magic Trackpad",
    summary: t("Geniş toxunma paneli, Force Touch", "Большая сенсорная панель с Force Touch", "A large Force Touch surface"),
    description: t(
      "Noutbuk kimi jestlər masaüstü Mac-da. Basma gücünü hiss edir, USB‑C ilə şarj olunur.",
      "Жесты как на ноутбуке — на настольном Mac. Чувствует силу нажатия, заряжается по USB‑C.",
      "Laptop-style gestures on a desktop Mac. It senses how hard you press and charges over USB‑C.",
    ),
    images: ["magic-trackpad.jpg"],
    usd: 129,
    options: [colors(K.white, { ...K.black, usd: 20 })],
    specs: [year],
  }),
  product({
    slug: "airtag",
    category: "accessories",
    name: "AirTag",
    summary: t("Açar və çantanı tapmaq üçün", "Чтобы находить ключи и сумки", "Find your keys and bags"),
    description: t(
      "Açara, çantaya və ya baqaja taxın — “Tap” tətbiqində harada olduğunu görün. Batareya təxminən bir il işləyir.",
      "Прикрепите к ключам, сумке или багажу — и смотрите, где они, в приложении «Локатор». Батарейки хватает примерно на год.",
      "Attach it to keys, a bag or luggage and see where they are in the Find My app. The battery lasts about a year.",
    ),
    images: ["airtag.jpg"],
    usd: 29,
    options: [
      {
        id: "pack",
        name: N.pack,
        values: [
          { id: "1", name: t("1 ədəd", "1 шт.", "1 pack") },
          { id: "4", name: t("4 ədəd", "4 шт.", "4 pack"), usd: 70 },
        ],
      },
    ],
    specs: [spec(S.battery, t("~1 il", "~1 год", "~1 year")), year],
  }),
  product({
    slug: "magsafe-charger",
    category: "accessories",
    name: "MagSafe şarj cihazı",
    summary: t("Maqnitlə yapışan simsiz şarj", "Беспроводная зарядка на магните", "Magnetic wireless charging"),
    description: t(
      "iPhone-un arxasına maqnitlə düz oturur və sürətli simsiz şarj edir. Kabeli USB‑C-dir.",
      "Точно примагничивается к задней панели iPhone и быстро заряжает без проводов. Кабель USB‑C.",
      "Snaps into place on the back of an iPhone for fast wireless charging. USB‑C cable.",
    ),
    images: ["magsafe-charger.jpg"],
    usd: 39,
    options: [{ id: "length", name: N.length, values: [plain("1m", "1 m"), plain("2m", "2 m", 10)] }],
    specs: [year],
  }),
  product({
    slug: "apple-tv-4k",
    category: "accessories",
    name: "Apple TV 4K",
    summary: t("Televizoru ağıllı ekrana çevirir", "Превращает телевизор в умный экран", "Turns any TV into a smart screen"),
    description: t(
      "4K HDR film, oyunlar və FaceTime televizorda. Siri Remote pultu ilə gəlir; 128 GB versiyada Ethernet də var.",
      "Фильмы 4K HDR, игры и FaceTime на телевизоре. В комплекте пульт Siri Remote; в версии 128 ГБ есть Ethernet.",
      "4K HDR films, games and FaceTime on your TV. Comes with the Siri Remote; the 128 GB model adds Ethernet.",
    ),
    images: ["apple-tv-4k.jpg"],
    usd: 129,
    options: [storage(["64 GB", 0], ["128 GB", 20])],
    specs: [spec(S.chip, "A15 Bionic"), year],
  }),

  /* ── gaming / spatial ── */
  product({
    slug: "apple-vision-pro",
    category: "gaming",
    name: "Apple Vision Pro",
    summary: t("Məkan kompüteri: film, iş və oyun", "Пространственный компьютер: кино, работа, игры", "A spatial computer for films, work and play"),
    description: t(
      "Gözlər, əllər və səslə idarə olunur. Nəhəng virtual ekranda film, Mac ekranının davamı və məkan fotoları.",
      "Управление глазами, руками и голосом. Огромный виртуальный экран для кино, продолжение экрана Mac и пространственные фото.",
      "Controlled with your eyes, hands and voice. A giant virtual screen for films, your Mac's display extended and spatial photos.",
    ),
    images: ["vision-pro.jpg"],
    usd: 3499,
    options: [storage(["256 GB", 0], ["512 GB", 200], ["1 TB", 400])],
    specs: [spec(S.chip, "M5 + R1"), spec(S.battery, t("~2,5 saat", "~2,5 ч", "~2.5 h")), year],
    featured: true,
  }),
];
