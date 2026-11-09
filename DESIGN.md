# Design system: one white theme

The site has one theme: white. Type and primary buttons are black. Product pictures and quiet panels sit on soft grey (`--tile` #f5f5f7, `--paper-2`). Nothing has a box-shadow and nothing is 3D. Surfaces are separated by space, grey fills and 1px hairlines, drawn as `outline` with a negative offset so they never move layout. Blur is used only on the frosted header, the phone tab bar and the search backdrop.

## Owner colours

Settings `theme.primary_color` (ink), `theme.secondary_color` (accent) and `theme.paper_color`, written by the Worker as `<style id="brand">` with `--brand-*`. `paper` is the ground and `ink` the text and buttons; every other token is mixed from these two. WhatsApp actions are always `#1f8a55`, and sale/new labels are `#b64400`. The product detail is white too. Its `--t-*` tokens still exist, so a later shop could tint it without touching components.

## Type

Geist Variable, self-hosted (`@fontsource-variable/geist`; covers Azerbaijani Latin (ə, ğ, ş) and Cyrillic). It is the default `theme.font`; the owner can still pick Inter Tight, Manrope, Montserrat, Onest, Playfair or the phone's own font. Page titles use `.page-title` (2.1 → 3rem, 650) and section titles `.section-title` (1.55 → 2.1rem). Labels are sentence case, not uppercase. Prices are tabular with no-break spaces: `2 399 ₼`.

## Pictures: one frame for everything (`ProductImage.tsx`)

Every product picture (card, detail, flight, search, cart, order) sits in a `.frame`: a grey square with a 20px radius.

- The image keeps its proportions and is centred at most 78% of the frame, so tall, wide and square pictures read the same size.
- `mix-blend-mode: multiply` melts white studio grounds into the grey.
- A photo with its own background gets rounded corners on its real box, so it reads as a print in the frame.
- No picture or a broken link shows a line drawing for the category (phones, laptops, tablets, audio, watches, gaming, accessories, plus common synonyms; anything else gets a parcel) and the brand name. There is never an empty box or a broken-image icon.

## Header and footer

The header is a thin frosted bar: name, then (desktop) the catalogue, up to six top categories and contact in 0.8rem type, then bare round icons (search, favourites on desktop, bag). The footer is #f5f5f7 with small type: name + tagline + WhatsApp, then Catalogue / Information (pages, favourites, contact) / Contact columns, then the fine print.

## Cards

Frame on top, then a fixed-height row of colour dots (empty when the product has no colour swatches, max 5 + "+N"), then three fixed-height lines: an eyebrow (sale / new / brand / out of stock), the name on one line, and the price. Rows always line up. Hover scales only the picture (1.04). The heart sits top-right in the frame. Grid: 2 / 3 / 4 columns. The grid is plain CSS; it fades up once when the list changes.

## Home

The shop's name, large, letters rising one after another, the tagline, then a search bar that opens the search card. After that: banners, the spotlight (featured products as big grey 28px tiles, one wide then two side by side; text centred above the picture; a tap flies into the quick view like a card), a swipeable row of all top categories, the owner's featured categories, all products (chips filter in place, 8 cards), "How it works" as one grey row of three steps, and a single row with the address, hours and the WhatsApp button.

## Search (`Search.tsx`)

The magnifier (header, phone tab bar, hero) opens a white card over a frosted white backdrop. Results show while typing, from the catalogue already loaded. Arrow keys move through them and Enter opens one in the quick view. It closes with Esc, the "Close" button, a tap outside, or the phone's back button (it has its own history entry, caught before the Next.js router). With an empty field the card shows categories and popular products.

## Motion

- Shared-element flight (`QuickView.tsx`): the picture, title and price travel from the card; a white circle opens behind them; the controls rise in turn. Back: arrow, Esc, the phone's back button, or a drag from the left edge.
- The flight spring is critically damped (k 170) and snaps home within 0.4%. Landing flips `data-flying` / `data-live` on the layer (CSS does the rest), so it causes no React render. Nothing is set on the whole layer per frame. Earlier, an under-damped spring kept the detail untouchable for about 0.6 s after it looked finished, which read as a freeze.
- The phone tab bar stays above the detail. Any tab, the bag in the detail, and checkout close the detail first.
- Only transform, opacity and clip-path animate. `scrollbar-gutter: stable` plus locking before measuring keep the page from shifting. There is one shared scroll lock (`lib/scroll-lock.ts`).

## Catalogue

From 1024px the filters live in a sidebar (`.catalog-split`); below that they open in a bottom sheet. A facet with more than twelve values shows the first ten plus any chosen ones, then a "+N daha" link. Chosen filters repeat above the grid as chips (`.chip-on`), each removable with one tap, plus "Sıfırla".

## Product page

Gallery on the left (sticky on desktop) with thumbnails under it. Options are bordered pills (`.seg`), colours are swatches. When the add button scrolls away, a thin buy bar (`.buybar`) shows the product, the chosen variant, the price and the button. Description and the specs table run full width below, side by side on desktop.

## Cart, order, sent

The cart page has two columns on desktop: lines on the left, a sticky grey summary on the right (total, share meter, delivery note, checkout). Its item count only counts lines that still match a product. The order form is one page of numbered steps (contact, delivery, confirm); on phones the summary folds into one line above the form. The sent page shows the order number, what was ordered, and three next steps. "Sifariş et" writes the order to D1 (`POST /api/orders`); the WhatsApp button appears only after that, when the owner turned it on.

## Checked

v2.0.0 was checked at 1440px and at 390px with mobile emulation: home, catalogue, product, cart, order, contact and favourites, in AZ and RU. No horizontal scroll and no console errors.
