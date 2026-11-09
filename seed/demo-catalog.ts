/**
 * DEMO DATA for local development only (npm run db:seed:local).
 * Ten sector-neutral products without photos: the storefront draws its own
 * placeholder frame (src/components/ProductImage.tsx) for every missing picture.
 * Prices are in manat here; the seed script stores them as qəpik.
 * Not typechecked (seed/ is excluded in tsconfig); plain Node strips the types.
 */

type LT = { az: string; ru?: string; en?: string };
type Value = { id: string; name: LT; swatch?: string };
type Option = { id: string; name: LT; values: Value[] };
type Variant = { id: string; values: Record<string, string>; price: number; oldPrice?: number; stock: number | null };
type Spec = { name: LT; value: LT };
type DemoProduct = {
  slug: string;
  category: string;
  brand: string;
  name: LT;
  summary: LT;
  description: LT;
  options: Option[];
  variants: Variant[];
  specs: Spec[];
  featured?: boolean;
  addedAt: string;
};

const size: Option = {
  id: "size",
  name: { az: "Ölçü", ru: "Размер", en: "Size" },
  values: ["S", "M", "L", "XL"].map((s) => ({ id: s.toLowerCase(), name: { az: s } })),
};
const colour = (values: Value[]): Option => ({ id: "color", name: { az: "Rəng", ru: "Цвет", en: "Colour" }, values });
const black: Value = { id: "black", name: { az: "Qara", ru: "Чёрный", en: "Black" }, swatch: "#111111" };
const white: Value = { id: "white", name: { az: "Ağ", ru: "Белый", en: "White" }, swatch: "#ffffff" };
const brown: Value = { id: "brown", name: { az: "Qəhvəyi", ru: "Коричневый", en: "Brown" }, swatch: "#7a4a2a" };
const beige: Value = { id: "beige", name: { az: "Bej", ru: "Бежевый", en: "Beige" }, swatch: "#d9c8a9" };

const material = (az: string, ru: string, en: string): Spec => ({ name: { az: "Material", ru: "Материал", en: "Material" }, value: { az, ru, en } });
const warranty = (years: number): Spec => ({
  name: { az: "Zəmanət", ru: "Гарантия", en: "Warranty" },
  value: { az: `${years} il`, ru: `${years} год`, en: `${years} year` },
});
/** one product without options: a single variant carrying the price and stock */
const single = (price: number, stock: number | null, oldPrice?: number): Variant[] => [{ id: "0", values: {}, price, oldPrice, stock }];

export const demoCatalog: { categories: { id: string; name: LT }[]; products: DemoProduct[] } = {
  categories: [
    { id: "geyim", name: { az: "Geyim", ru: "Одежда", en: "Clothing" } },
    { id: "ev-ve-dekor", name: { az: "Ev və dekor", ru: "Дом и декор", en: "Home & decor" } },
    { id: "elektronika", name: { az: "Elektronika", ru: "Электроника", en: "Electronics" } },
    { id: "aksesuarlar", name: { az: "Aksesuarlar", ru: "Аксессуары", en: "Accessories" } },
  ],
  products: [
    {
      slug: "pambiq-koynek",
      category: "geyim",
      brand: "Nord",
      name: { az: "Pambıq köynək", ru: "Хлопковая рубашка", en: "Cotton shirt" },
      summary: { az: "Yumşaq pambıq, sərbəst biçim", ru: "Мягкий хлопок, свободный крой", en: "Soft cotton, relaxed fit" },
      description: {
        az: "Gündəlik geyim üçün 100% pambıq köynək. 30 °C-də yuyula bilər.",
        ru: "Рубашка из 100% хлопка на каждый день. Стирка при 30 °C.",
        en: "Everyday shirt in 100% cotton. Machine wash at 30 °C.",
      },
      options: [size, colour([white, black])],
      variants: ["s", "m", "l", "xl"].flatMap((s, i) => [
        { id: `${s}-white`, values: { size: s, color: "white" }, price: 39, stock: [4, 8, 6, 0][i] },
        { id: `${s}-black`, values: { size: s, color: "black" }, price: 39, stock: [3, 5, 2, 1][i] },
      ]),
      specs: [material("Pambıq", "Хлопок", "Cotton")],
      featured: true,
      addedAt: "2026-11-01",
    },
    {
      slug: "keten-salvar",
      category: "geyim",
      brand: "Nord",
      name: { az: "Kətan şalvar", ru: "Льняные брюки", en: "Linen trousers" },
      summary: { az: "Yay üçün yüngül kətan", ru: "Лёгкий лён для лета", en: "Light linen for summer" },
      description: {
        az: "Rezinli bel və iki cib. Təbii kətan nəfəs alır və isti havada rahatdır.",
        ru: "Эластичный пояс и два кармана. Натуральный лён дышит и удобен в жару.",
        en: "Elastic waist and two pockets. Natural linen breathes and stays cool in the heat.",
      },
      options: [{ ...size, values: size.values.slice(0, 3) }],
      variants: ["s", "m", "l"].map((s, i) => ({ id: s, values: { size: s }, price: 59, oldPrice: 75, stock: [2, 6, 3][i] })),
      specs: [material("Kətan", "Лён", "Linen")],
      addedAt: "2026-10-20",
    },
    {
      slug: "yun-sviter",
      category: "geyim",
      brand: "Arka",
      name: { az: "Yun sviter", ru: "Шерстяной свитер", en: "Wool sweater" },
      summary: { az: "İsti, yumşaq toxuma", ru: "Тёплая мягкая вязка", en: "Warm, soft knit" },
      description: {
        az: "Merinos yunundan klassik sviter. Bu məhsul hazırda stokda yoxdur — demo üçün.",
        ru: "Классический свитер из шерсти мериноса. Сейчас нет в наличии — для демо.",
        en: "A classic merino wool sweater. Currently out of stock — for the demo.",
      },
      options: [],
      variants: single(89, 0),
      specs: [material("Merinos yunu", "Шерсть мериноса", "Merino wool")],
      addedAt: "2026-09-15",
    },
    {
      slug: "keramika-vaza",
      category: "ev-ve-dekor",
      brand: "Lumo",
      name: { az: "Keramika vaza", ru: "Керамическая ваза", en: "Ceramic vase" },
      summary: { az: "Əl işi, mat şirli", ru: "Ручная работа, матовая глазурь", en: "Handmade, matte glaze" },
      description: {
        az: "Hər vaza əl ilə hazırlanır, ona görə forması bir az fərqli ola bilər. Hündürlüyü 24 sm.",
        ru: "Каждая ваза сделана вручную, поэтому форма может немного отличаться. Высота 24 см.",
        en: "Every vase is made by hand, so the shape may vary slightly. 24 cm tall.",
      },
      options: [],
      variants: single(45, 12),
      specs: [material("Keramika", "Керамика", "Ceramic"), { name: { az: "Hündürlük", ru: "Высота", en: "Height" }, value: { az: "24 sm", ru: "24 см", en: "24 cm" } }],
      featured: true,
      addedAt: "2026-10-28",
    },
    {
      slug: "soya-sami",
      category: "ev-ve-dekor",
      brand: "Lumo",
      name: { az: "Soya şamı", ru: "Соевая свеча", en: "Soy candle" },
      summary: { az: "40 saat yanma müddəti", ru: "40 часов горения", en: "40 hours burn time" },
      description: {
        az: "Təbii soya mumu və pambıq fitil. Stoku izlənmir — həmişə sifariş vermək olar.",
        ru: "Натуральный соевый воск и хлопковый фитиль. Остаток не отслеживается — заказ доступен всегда.",
        en: "Natural soy wax and a cotton wick. Stock is not tracked, so it can always be ordered.",
      },
      options: [],
      variants: single(18, null),
      specs: [{ name: { az: "Yanma müddəti", ru: "Время горения", en: "Burn time" }, value: { az: "40 saat", ru: "40 часов", en: "40 hours" } }],
      addedAt: "2026-10-05",
    },
    {
      slug: "simsiz-qulaqliq",
      category: "elektronika",
      brand: "Arka",
      name: { az: "Simsiz qulaqlıq", ru: "Беспроводные наушники", en: "Wireless headphones" },
      summary: { az: "Səs-küyü azaldan, 30 saat batareya", ru: "Шумоподавление, 30 часов работы", en: "Noise cancelling, 30-hour battery" },
      description: {
        az: "Qatlanan dizayn, USB‑C ilə sürətli şarj və qutuda daşıma çantası.",
        ru: "Складная конструкция, быстрая зарядка по USB‑C и чехол в комплекте.",
        en: "Folding design, fast USB‑C charging and a carrying case in the box.",
      },
      options: [colour([black, white])],
      variants: [
        { id: "black", values: { color: "black" }, price: 129, stock: 7 },
        { id: "white", values: { color: "white" }, price: 139, stock: 3 },
      ],
      specs: [{ name: { az: "Batareya", ru: "Батарея", en: "Battery" }, value: { az: "30 saat", ru: "30 часов", en: "30 hours" } }, warranty(1)],
      featured: true,
      addedAt: "2026-11-05",
    },
    {
      slug: "smart-saat",
      category: "elektronika",
      brand: "Arka",
      name: { az: "Smart saat", ru: "Смарт-часы", en: "Smartwatch" },
      summary: { az: "Nəbz, addım və yuxu izləmə", ru: "Пульс, шаги и сон", en: "Heart rate, steps and sleep" },
      description: {
        az: "Suya davamlı korpus və bir həftəlik batareya. Telefona bildirişlər gəlir.",
        ru: "Водозащищённый корпус и неделя без подзарядки. Уведомления с телефона.",
        en: "Water-resistant case and a week of battery. Shows phone notifications.",
      },
      options: [],
      variants: single(249, 5, 299),
      specs: [{ name: { az: "Ekran", ru: "Экран", en: "Display" }, value: { az: "1,4″ AMOLED" } }, warranty(1)],
      addedAt: "2026-10-12",
    },
    {
      slug: "powerbank-10000",
      category: "elektronika",
      brand: "Nord",
      name: { az: "Powerbank 10 000 mAh", ru: "Powerbank 10 000 мА·ч", en: "Power bank 10,000 mAh" },
      summary: { az: "Kiçik, iki çıxışlı", ru: "Компактный, два выхода", en: "Compact, two outputs" },
      description: {
        az: "Telefonu iki dəfəyə qədər doldurur. USB‑C və USB‑A çıxışları.",
        ru: "Заряжает телефон до двух раз. Выходы USB‑C и USB‑A.",
        en: "Charges a phone up to twice. USB‑C and USB‑A outputs.",
      },
      options: [],
      variants: single(49, 30),
      specs: [{ name: { az: "Tutum", ru: "Ёмкость", en: "Capacity" }, value: { az: "10 000 mAh" } }, warranty(1)],
      addedAt: "2026-08-30",
    },
    {
      slug: "deri-pul-kisesi",
      category: "aksesuarlar",
      brand: "Lumo",
      name: { az: "Dəri pul kisəsi", ru: "Кожаный кошелёк", en: "Leather wallet" },
      summary: { az: "Təbii dəri, 6 kart yeri", ru: "Натуральная кожа, 6 карт", en: "Genuine leather, 6 card slots" },
      description: {
        az: "İncə və möhkəm. Zamanla gözəl patina əmələ gətirir.",
        ru: "Тонкий и прочный. Со временем приобретает красивую патину.",
        en: "Slim and sturdy. Develops a beautiful patina over time.",
      },
      options: [colour([brown, black])],
      variants: [
        { id: "brown", values: { color: "brown" }, price: 55, stock: 9 },
        { id: "black", values: { color: "black" }, price: 55, stock: 4 },
      ],
      specs: [material("Təbii dəri", "Натуральная кожа", "Genuine leather")],
      featured: true,
      addedAt: "2026-11-03",
    },
    {
      slug: "keten-canta",
      category: "aksesuarlar",
      brand: "Nord",
      name: { az: "Kətan çanta", ru: "Льняная сумка", en: "Linen tote bag" },
      summary: { az: "Gündəlik alış-veriş üçün", ru: "Для покупок на каждый день", en: "For everyday shopping" },
      description: {
        az: "Geniş və yüngül, daxili cibi var. 10 kq-a qədər yük daşıyır.",
        ru: "Вместительная и лёгкая, с внутренним карманом. Выдерживает до 10 кг.",
        en: "Roomy and light with an inner pocket. Carries up to 10 kg.",
      },
      options: [colour([beige, black])],
      variants: [
        { id: "beige", values: { color: "beige" }, price: 25, oldPrice: 32, stock: 15 },
        { id: "black", values: { color: "black" }, price: 25, oldPrice: 32, stock: 6 },
      ],
      specs: [material("Kətan", "Лён", "Linen")],
      addedAt: "2026-09-02",
    },
  ],
};
