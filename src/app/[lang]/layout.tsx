import { notFound } from "next/navigation";
import { LANGS, isLang, type Lang } from "@/lib/i18n";
import { SiteProvider } from "@/lib/site";
import { CartProvider } from "@/lib/cart";
import { QuickViewProvider } from "@/components/QuickView";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { MobileBar } from "@/components/MobileBar";
import { SearchProvider } from "@/components/Search";

export const dynamicParams = false;

export function generateStaticParams() {
  // every language is built; the shop chooses which ones the switch offers
  return LANGS.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();

  return (
    <SiteProvider lang={lang as Lang}>
      <CartProvider>
        <QuickViewProvider>
          <SearchProvider>
          <div className="flex min-h-dvh flex-col">
            <Header />
            <main id="main" className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <CartDrawer />
          <MobileBar />
          </SearchProvider>
        </QuickViewProvider>
      </CartProvider>
    </SiteProvider>
  );
}
