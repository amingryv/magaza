# Design system: one white theme

The site has one theme: white. Type and primary buttons are black. Product pictures and quiet panels sit on soft grey (`--tile` #f5f5f7, `--paper-2`). Nothing has a box-shadow and nothing is 3D. Surfaces are separated by space, grey fills and 1px hairlines, drawn as `outline` with a negative offset so they never move layout. The only blur is the frosted phone tab bar and the search backdrop.

## Owner colours

Settings `theme.primary_color` (ink), `theme.secondary_color` (accent) and `theme.paper_color`, written by the Worker as `<style id="brand">` with `--brand-*`. `paper` is the ground and `ink` the text and buttons; every other token is mixed from these two. WhatsApp actions are always `#1f8a55`, and sale/new labels are `#b64400`. The product detail is white too. Its `--t-*` tokens still exist, so a later shop could tint it without touching components.

## Type

Inter Tight Variable, self-hosted (`@fontsource-variable/inter-tight`; covers Azerbaijani Latin and Cyrillic). Page titles use `.page-title` (2.1 → 3rem, 650) and section titles `.section-title` (1.55 → 2.1rem). Labels are sentence case, not uppercase. Prices are tabular with no-break spaces: `2 399 ₼`.

## Pictures: one frame for everything (`ProductImage.tsx`)

Every product picture (card, detail, flight, search, cart, order) sits in a `.frame`: a grey square with a 20px radius.

- The image keeps its proportions and is centred at most 78% of the frame, so tall, wide and square pictures read the same size.
- `mix-blend-mode: multiply` melts white studio grounds into the grey.
- A photo with its own background gets rounded corners on its real box, so it reads as a print in the frame.
- No picture or a broken link shows a line drawing for the category (phones, laptops, tablets, audio, watches, gaming, accessories, plus common synonyms; anything else gets a parcel) and the brand name. There is never an empty box or a broken-image icon.

## Cards

Frame on top, then three fixed-height lines: an eyebrow (sale / new / brand / out of stock), the name on one line, and the price. Rows always line up. Hover scales only the picture (1.04). The heart sits top-right in the frame. Grid: 2 / 3 / 4 columns. The grid is plain CSS; it fades up once when the list changes.

## Home

The shop's name, large, letters rising one after another, then a search bar that opens the search card. After that: all products (chips filter in place, 8 cards), "How it works" as one grey row of three steps, the week's picks (one row of four), and a single row with the address, hours and the WhatsApp button.

## Search (`Search.tsx`)

The magnifier (header, phone tab bar, hero) opens a white card over a frosted white backdrop. Results show while typing, from the catalogue already loaded. Arrow keys move through them and Enter opens one in the quick view. It closes with Esc, the "Close" button, a tap outside, or the phone's back button (it has its own history entry, caught before the Next.js router). With an empty field the card shows categories and popular products.

## Motion

- Shared-element flight (`QuickView.tsx`): the picture, title and price travel from the card; a white circle opens behind them; the controls rise in turn. Back: arrow, Esc, the phone's back button, or a drag from the left edge.
- The flight spring is critically damped (k 170) and snaps home within 0.4%. Landing flips `data-flying` / `data-live` on the layer (CSS does the rest), so it causes no React render. Nothing is set on the whole layer per frame. Earlier, an under-damped spring kept the detail untouchable for about 0.6 s after it looked finished, which read as a freeze.
- The phone tab bar stays above the detail. Any tab, the bag in the detail, and checkout close the detail first.
- Only transform, opacity and clip-path animate. `scrollbar-gutter: stable` plus locking before measuring keep the page from shifting. There is one shared scroll lock (`lib/scroll-lock.ts`).

## Order page

There are two ways to send. "WhatsApp ilə sifariş et" opens WhatsApp with the message. "Sifariş et" goes to the shop; in phase 3 it is written to D1 via `NEXT_PUBLIC_ORDERS_API`.
