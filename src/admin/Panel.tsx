"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { call, type SettingsRes } from "./api";
import { Account } from "./Home";
import { Products } from "./Products";
import { ProductForm } from "./ProductForm";
import { Categories } from "./Categories";
import { Attributes } from "./Attributes";
import { Dashboard, loadStats } from "./Dashboard";
import { OrderView, Orders } from "./Orders";
import { Settings } from "./Settings";
import { Appearance } from "./Appearance";
import { Pages } from "./Pages";
import { Backup } from "./Backup";

/*
 * The panel after login. One page (/admin), sections chosen by the hash so
 * the static export needs no extra routes and the back button works:
 *   #/home  #/orders  #/orders/<id>  #/products  #/products/new  #/products/<id>
 *   #/categories  #/attributes  #/appearance  #/pages  #/settings  #/backup  #/account
 */

export type Shop = { name: string; main: string; languages: string[]; symbol: string };
const ShopCtx = createContext<Shop>({ name: "", main: "az", languages: ["az"], symbol: "₼" });
export const useShop = () => useContext(ShopCtx);

export function go(hash: string) {
  window.location.hash = hash;
}

function useHash(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [h, setH] = useState<string[]>([]);
  useEffect(() => {
    const on = () => {
      setH(read());
      window.scrollTo({ top: 0 });
    };
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return h;
}

const TABS = [
  ["home", "Əsas"],
  ["orders", "Sifarişlər"],
  ["products", "Məhsullar"],
  ["categories", "Kateqoriyalar"],
  ["attributes", "Xüsusiyyətlər"],
  ["appearance", "Görünüş"],
  ["pages", "Səhifələr"],
  ["settings", "Ayarlar"],
  ["backup", "Ehtiyat nüsxə"],
  ["account", "Hesab"],
] as const;

export function Panel({ version, onLogout }: { version: string; onLogout: () => void }) {
  const [shop, setShop] = useState<Shop>({ name: "", main: "az", languages: ["az"], symbol: "₼" });
  const route = useHash();
  const section = route[0] ?? "home";
  const [fresh, setFresh] = useState(0);
  const routeKey = route.join("/");
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  // the number on the Orders tab: on every move and once a minute
  useEffect(() => {
    let live = true;
    const get = () => loadStats().then((s) => live && setFresh(s.new_orders), () => {});
    void get();
    const t = setInterval(get, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [routeKey, tick]);

  const [shopTick, setShopTick] = useState(0);
  useEffect(() => {
    call<SettingsRes>("GET", "settings")
      .then(({ settings: s }) => {
        const main = typeof s["store.language"] === "string" ? (s["store.language"] as string) : "az";
        const langs = Array.isArray(s["store.languages"]) ? (s["store.languages"] as string[]) : [main];
        const name = s["store.name"];
        setShop({
          name: typeof name === "string" ? name : name && typeof name === "object" ? String(Object.values(name)[0] ?? "") : "",
          main,
          languages: langs.includes(main) ? langs : [main, ...langs],
          symbol: String(s["store.currency_symbol"] ?? "₼"),
        });
      })
      .catch(() => {});
  }, [shopTick]);

  const editing = (section === "products" || section === "orders") && route[1];

  return (
    <ShopCtx.Provider value={shop}>
      <div className="min-h-dvh pb-16">
        {!editing && (
          <header className="mx-auto w-full max-w-[46rem] px-4 pt-6 md:pt-10">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.85rem] font-medium text-ink-soft">İdarə paneli</p>
                <h1 className="truncate text-[1.6rem]">{shop.name || " "}</h1>
              </div>
              <a href="/" target="_blank" className="pill pill-soft h-10 shrink-0 px-4 text-[0.88rem]">
                Mağazaya bax
              </a>
            </div>
            <nav className="no-scrollbar -mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0" aria-label="Bölmələr">
              {TABS.map(([id, label]) => (
                <a
                  key={id}
                  href={`#/${id}`}
                  aria-current={section === id ? "page" : undefined}
                  className={`inline-flex h-10 shrink-0 items-center rounded-full px-4 text-[0.9rem] font-medium transition-colors ${section === id ? "bg-ink text-paper" : "bg-paper-2 text-ink hover:bg-paper-3"}`}
                >
                  {label}
                  {id === "orders" && fresh > 0 && (
                    <span className={`num ml-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.72rem] font-semibold ${section === id ? "bg-paper text-ink" : "bg-ink text-paper"}`}>
                      {fresh}
                    </span>
                  )}
                </a>
              ))}
            </nav>
          </header>
        )}

        <div className={editing ? "" : "mt-6"}>
          {section === "home" && <Dashboard />}
          {section === "orders" && !route[1] && <Orders />}
          {section === "orders" && route[1] && <OrderView key={route[1]} id={Number(route[1])} onChange={refresh} />}
          {section === "products" && !route[1] && <Products />}
          {section === "products" && route[1] && <ProductForm key={route[1]} id={route[1] === "new" ? null : Number(route[1])} />}
          {section === "appearance" && <Appearance onSaved={() => setShopTick((t) => t + 1)} />}
          {section === "settings" && <Settings onSaved={() => setShopTick((t) => t + 1)} />}
          {section === "categories" && <Categories />}
          {section === "attributes" && <Attributes />}
          {section === "pages" && <Pages />}
          {section === "backup" && <Backup />}
          {section === "account" && <Account version={version} onLogout={onLogout} />}
        </div>
      </div>
    </ShopCtx.Provider>
  );
}
