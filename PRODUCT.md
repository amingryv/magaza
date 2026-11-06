# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (React) with `output: 'export'` (static HTML/CSS/JS), Tailwind CSS. Hosted entirely on the owner's own Cloudflare account as one Worker: static assets for the site, the same Worker for the JSON API, D1 for data, R2 for images, its own password login for /admin (no Cloudflare Access), honeypot + rate limit for spam (Turnstile optional), Telegram bot for order notifications. No other third-party service, API key or subscription. Chosen by the user.

## Users

- **Shopper (primary visitor):** an everyday buyer in Azerbaijan, almost always on a phone. Browses products, picks a variant, adds to cart, fills a short form (name, phone, optional note) and sends the order; it is saved on the site, and WhatsApp is an optional extra button. Reads AZ, RU or EN.
- **Shop owner (operator):** a small-business owner with no technical help after handover. Adds products from their phone (photo, name, price, variants, stock), changes shop settings, reads incoming orders. Must never need us or a developer again.

## Product Purpose

A sell-once storefront template that adapts to any retail sector. The owner shows products and takes orders easily, alone. Success: the owner runs the shop for years without contacting the builders, and a shopper completes an order in under a minute on a phone.

## Positioning

Not a marketplace and not a SaaS: each shop gets its own copy, own domain, own Cloudflare account, own data. No payment, no delivery logic, no monthly fee. The order is stored in the owner's own database first (so none is lost) and the owner gets a Telegram message; a WhatsApp button is optional.

## Operating Context

- Order flow: cart → short form → order saved by the server (number like S-1042, prices computed server-side) → Telegram notification → optional "Send on WhatsApp" button (wa.me link).
- No online payment, no delivery zones or fees, ever.
- Admin panel lives at `/admin` inside the same site; the Cloudflare dashboard is for the builders only.
- Builders install and hand over every shop; the owner does not deploy.

## Capabilities and Constraints

- Three languages: AZ (default, fallback), RU, EN — UI strings and owner-entered product text.
- Products have variants (colour, memory, size…) and stock counts; sector-specific attributes.
- Shop identity (name, logo, colours, font, WhatsApp number, address, hours, socials) must be editable by the owner without code.
- Mobile first. Free Cloudflare tier must suffice.
- Phase 1 is the storefront frontend only, on mock data, electronics demo. Admin UI, backend, deploy come after the user approves the front.

## Brand Commitments

None per shop yet; the template must re-skin per client. The electronics demo uses a coined name chosen by the builder.

## Evidence on Hand

No real products, prices, photographs, reviews or customers. Demo uses openly licensed photographs (credited) and synthetic catalogue data clearly treated as demo; no invented reviews, ratings or sales figures.

## Product Principles

1. The owner can do everything alone; anything that needs a developer is a defect.
2. Ordering is shortest-path: as few fields and taps as possible.
3. One template, many trades: nothing in the structure assumes electronics.
4. Zero dependence on outside services beyond the owner's own Cloudflare account.

## Accessibility & Inclusion

Phone-first, large touch targets, readable contrast, works for non-technical owners and shoppers in three languages.
