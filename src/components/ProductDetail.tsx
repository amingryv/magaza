"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useSite } from "@/lib/site";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { tr } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { defaultVariant, findVariant, valueAvailable } from "@/lib/catalog";
import { jump, sparks, stillness } from "@/lib/spring";
import type { Product } from "@/lib/catalog-types";
import { Counter } from "./Counter";
import { RollPrice } from "./Roll";
import { BagButton } from "./BagButton";
import { IconBack, IconCheck, IconHeart } from "./Icons";
import { ProductImage } from "./ProductImage";

export type DetailRefs = {
  hero: React.RefObject<HTMLDivElement | null>;
  title: React.RefObject<HTMLHeadingElement | null>;
  price: React.RefObject<HTMLParagraphElement | null>;
};

/**
 * The product, as one tinted screen: hero photo, title and price on a row,
 * then the controls, each wrapped in `.ent` so the overlay can bring them
 * in on their own springs. Shared by the quick view and the /p/ page.
 */
export function ProductDetail({
  product,
  refs,
  onBack,
  onLeave,
  mode,
}: {
  product: Product;
  refs?: DetailRefs;
  onBack: () => void;
  /** close instantly before following a link out of the overlay */
  onLeave?: () => void;
  mode: "overlay" | "page";
}) {
  const { t, lang, href } = useSite();
  const { add } = useCart();
  const router = useRouter();
  const fav = useFavorites();
  const name = tr(product.name, lang);

  const [chosen, setChosen] = useState<Record<string, string>>(() => ({ ...defaultVariant(product).values }));
  const [qtyWanted, setQty] = useState(1);
  const [slide, setSlide] = useState(0);
  const [ok, setOk] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const sparkRef = useRef<HTMLSpanElement>(null);
  const heartRef = useRef<HTMLButtonElement>(null);
  const okTimer = useRef(0);
  const track = useRef<HTMLDivElement>(null);
  const page = mode === "page";
  // the page's buy bar shows once the real button has scrolled away above
  const [bar, setBar] = useState(false);
  useEffect(() => {
    const el = addRef.current;
    if (!page || !el) return;
    const io = new IntersectionObserver(([e]) => setBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [page]);
  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: stillness() ? "auto" : "smooth" });
  };

  const variant = findVariant(product, chosen);
  const variantText = product.options
    .map((o) => tr(o.values.find((v) => v.id === chosen[o.id])?.name, lang))
    .filter(Boolean)
    .join(" / ");
  const stock = variant?.stock ?? 0;
  const canBuy = !!variant && stock > 0;
  const max = Math.max(1, Math.min(20, stock));
  const qty = Math.min(qtyWanted, max);

  const addToCart = () => {
    if (!variant || !canBuy) return;
    add(product.id, variant.id, qty);
    setOk(true);
    sparks(sparkRef.current);
    window.clearTimeout(okTimer.current);
    okTimer.current = window.setTimeout(() => setOk(false), 1500);
  };

  const buyNow = () => {
    if (!variant || !canBuy) return;
    add(product.id, variant.id, qty);
    onLeave?.();
    router.push(href("/order/"));
  };

  return (
    <div className="detail">
      {/* nav */}
      <div className="ent flex items-center justify-between">
        <button type="button" onClick={onBack} className="t-orb" aria-label={t.nav.back} data-back>
          <IconBack />
        </button>
        <div className="flex items-center gap-2">
          <button
            ref={heartRef}
            type="button"
            className="t-orb"
            aria-pressed={fav.has(product.id)}
            aria-label={fav.has(product.id) ? t.fav.remove : t.fav.save}
            onClick={() => {
              fav.toggle(product.id);
              jump(heartRef.current, 1.25);
            }}
          >
            <IconHeart size={21} className={fav.has(product.id) ? "fill-current" : ""} />
          </button>
          <BagButton variant="tone" onOpen={mode === "overlay" ? onLeave : undefined} />
        </div>
      </div>

      <div className={`mt-4 md:grid md:items-start md:gap-10 ${page ? "md:grid-cols-[1.25fr_1fr] lg:gap-14" : "md:grid-cols-[1.15fr_1fr]"}`}>
        <div className={page ? "md:sticky md:top-20" : undefined}>
        {/* hero: the flight lands here, then swipe for more photos */}
        <div ref={refs?.hero} className="detail-hero" data-shared>
          <div
            ref={track}
            className="detail-hero-track"
            onScroll={(e) => {
              const el = e.currentTarget;
              setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
            }}
          >
            {/* no photos: one slide with the placeholder drawing */}
            {(product.images.length ? product.images : [""]).map((src, i) => (
              <div key={src || "none"} className="detail-hero-slide">
                <ProductImage product={product} src={src || undefined} alt={i === 0 ? name : ""} priority={i === 0} />
              </div>
            ))}
          </div>
          {product.images.length > 1 && (
            <>
              <button type="button" className="detail-arrow" data-side="prev" aria-label={t.nav.prevPhoto} disabled={slide <= 0} onClick={() => goTo(slide - 1)}>
                <IconBack size={20} />
              </button>
              <button type="button" className="detail-arrow" data-side="next" aria-label={t.nav.nextPhoto} disabled={slide >= product.images.length - 1} onClick={() => goTo(slide + 1)}>
                <IconBack size={20} className="-scale-x-100" />
              </button>
            </>
          )}
          {product.images.length > 1 && (
            <div className="detail-dots" aria-hidden>
              {product.images.map((src, i) => (
                <i key={src} data-on={i === slide || undefined} />
              ))}
            </div>
          )}
        </div>
        {page && product.images.length > 1 && (
          <div className="detail-thumbs no-scrollbar" role="group" aria-label={name}>
            {product.images.map((src, i) => (
              <button key={src} type="button" className="detail-thumb" aria-current={i === slide || undefined} aria-label={`${i + 1} / ${product.images.length}`} onClick={() => goTo(i)}>
                <ProductImage product={product} src={product.thumbs?.[i] ?? src} size="thumb" />
              </button>
            ))}
          </div>
        )}
        </div>

        <div>
          <div className="mt-5 flex items-baseline justify-between gap-3 md:mt-1">
            <h2 ref={refs?.title} className="detail-title">
              {name}
            </h2>
            <p ref={refs?.price} className="detail-price" data-shared>
              {variant ? <RollPrice value={variant.price} /> : null}
            </p>
          </div>

          <p className="ent detail-meta mt-1.5 flex flex-wrap items-center gap-x-2">
            <span>{product.brand}</span>
            <span aria-hidden>·</span>
            <span>{stock > 0 ? t.product.inStock(stock) : t.product.outOfStock}</span>
            {variant?.oldPrice && variant.oldPrice > variant.price && (
              <>
                <span aria-hidden>·</span>
                <s className="num">{formatPrice(variant.oldPrice)}</s>
              </>
            )}
          </p>
          <p className="ent detail-desc mt-3 line-clamp-3">{tr(product.summary, lang)}</p>

          {product.options.map((o) => {
            const current = o.values.find((v) => v.id === chosen[o.id]);
            const swatch = o.values.every((v) => v.swatch);
            return (
              <div key={o.id} className="ent mt-5">
                <p className="detail-label mb-2">
                  {tr(o.name, lang)} · <b>{tr(current?.name, lang)}</b>
                </p>
                {swatch ? (
                  <div className="swatches" role="radiogroup" aria-label={tr(o.name, lang)}>
                    {o.values.map((v) => {
                      const on = chosen[o.id] === v.id;
                      return (
                        <span key={v.id} className="relative grid place-items-center">
                          {on && (
                            <motion.i
                              layoutId={`ring-${product.id}-${o.id}`}
                              className="swatch-ring !left-1/2 -ml-[19px]"
                              transition={{ type: "spring", stiffness: 520, damping: 30 }}
                            />
                          )}
                          <button
                            type="button"
                            role="radio"
                            aria-checked={on}
                            aria-label={tr(v.name, lang)}
                            className="swatch"
                            style={{ "--c": v.swatch } as React.CSSProperties}
                            onClick={() => setChosen((c) => ({ ...c, [o.id]: v.id }))}
                          />
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="seg" role="radiogroup" aria-label={tr(o.name, lang)}>
                    {o.values.map((v) => {
                      const on = chosen[o.id] === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          data-out={!valueAvailable(product, chosen, o.id, v.id) || undefined}
                          className="seg-btn"
                          onClick={() => setChosen((c) => ({ ...c, [o.id]: v.id }))}
                        >
                          {on && (
                            <motion.span
                              layoutId={`seg-${product.id}-${o.id}`}
                              className="seg-fill"
                              transition={{ type: "spring", stiffness: 520, damping: 34 }}
                            />
                          )}
                          {tr(v.name, lang)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="ent mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="detail-label mb-2">{t.product.quantity}</p>
              <Counter
                value={qty}
                onChange={setQty}
                min={1}
                max={max}
                cell={36}
                label={t.product.quantity}
                lessLabel={t.product.less}
                moreLabel={t.product.more}
              />
            </div>
            {mode === "overlay" && (
              <Link href={href(`/p/?s=${product.slug}`)} onClick={onLeave} className="link-draw mb-3 text-sm font-bold">
                {t.product.details}
              </Link>
            )}
          </div>

          <div className="ent mt-6">
            <button ref={addRef} type="button" className="add" data-ok={ok || undefined} onClick={addToCart} disabled={!canBuy}>
              <span className="add-txt">
                <span>{canBuy ? t.product.addToCart : t.product.outOfStock}</span>
                {variant && (
                  <b className="add-total">
                    <RollPrice value={variant.price * qty} />
                  </b>
                )}
              </span>
              <span className="add-ok" aria-hidden>
                <IconCheck />
                {t.product.added}
              </span>
              <span className="sparks" ref={sparkRef} aria-hidden />
              <span className="sr-only" aria-live="polite">
                {ok ? t.product.added : ""}
              </span>
            </button>
            <button
              type="button"
              onClick={buyNow}
              disabled={!canBuy}
              className="mt-2 h-12 w-full rounded-full text-[0.95rem] font-bold text-[var(--t-ink)] transition-transform duration-500 [transition-timing-function:var(--spring)] active:scale-95 disabled:opacity-40"
            >
              {t.product.orderNow}
            </button>
          </div>

          {!page && (
            <div className="ent mt-6 pb-4">
              <p className="detail-desc text-[0.95rem]">{tr(product.description, lang)}</p>
              <Specs product={product} />
            </div>
          )}
        </div>
      </div>
      {page && (
        <div className="buybar" data-on={bar || undefined} aria-hidden={!bar} inert={!bar}>
          <div className="buybar-in">
            <span className="buybar-pic frame frame-thumb" aria-hidden>
              <ProductImage product={product} size="thumb" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[0.92rem] font-semibold tracking-[-0.015em]">{name}</b>
              <span className="block truncate text-[0.8rem] text-ink-soft">
                {[variantText, variant ? formatPrice(variant.price) : ""].filter(Boolean).join(" · ")}
              </span>
            </span>
            <button type="button" className="pill pill-ink buybar-btn" onClick={addToCart} disabled={!canBuy}>
              {ok ? t.product.added : canBuy ? t.product.addToCart : t.product.outOfStock}
            </button>
          </div>
        </div>
      )}
      {mode === "overlay" && !stillness() && (
        <p className="sr-only">{t.product.swipeBack}</p>
      )}
    </div>
  );
}

/** The long description and the specs table; the page shows them full width below the buy column. */
export function ProductAbout({ product }: { product: Product }) {
  const { t, lang } = useSite();
  const text = tr(product.description, lang);
  if (!text && !product.specs.length) return null;
  return (
    <div className="about-grid">
      {text && (
        <section aria-labelledby="about-desc">
          <h2 id="about-desc" className="section-title">{t.product.description}</h2>
          <p className="mt-4 whitespace-pre-line text-[1.02rem] leading-[1.65] text-ink-soft">{text}</p>
        </section>
      )}
      {product.specs.length > 0 && (
        <section aria-labelledby="about-specs">
          <h2 id="about-specs" className="section-title">{t.product.specs}</h2>
          <Specs product={product} />
        </section>
      )}
    </div>
  );
}

function Specs({ product }: { product: Product }) {
  const { lang } = useSite();
  if (!product.specs.length) return null;
  return (
    <dl className="specs">
      {product.specs.map((s) => (
        <div key={tr(s.name, "az")}>
          <dt>{tr(s.name, lang)}</dt>
          <dd className="num">{tr(s.value, lang)}</dd>
        </div>
      ))}
    </dl>
  );
}
