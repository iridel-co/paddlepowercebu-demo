# Paddle Power Cebu — Demo Site

Single-page teaser site for Paddle Power Cebu: premium indoor pickleball courts,
solar-powered, open 24/7, two branches (AS Fortuna and Talisay). Booking is handled
externally by Onda Fit — this site's job is to get a visitor to the right branch's
booking link in one tap.

Built by Iridel from `PRD.md` and the Claude Design files. **This is a demo build being
handed off — it is not production-ready. See [Handoff status](#handoff-status).**

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS 4 · TypeScript ·
Radix UI · GSAP + Motion · Three.js · Lucide

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script                            | What it does                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev`                     | Dev server (Turbopack)                                                                 |
| `npm run build`                   | Production build                                                                       |
| `npm run start`                   | Serve the production build                                                             |
| `npm run validate`                | typecheck + lint + format check — **run before any PR**                                |
| `npm run typecheck`               | `tsc --noEmit`                                                                         |
| `npm run lint` / `lint:fix`       | ESLint over `src`                                                                      |
| `npm run lint:css`                | Stylelint over `src/**/*.css`                                                          |
| `npm run format` / `format:check` | Prettier                                                                               |
| `node tools/optimize-assets.mjs`  | Re-encode hero frames + renders to WebP (idempotent)                                   |
| `node tools/export-renders.mjs`   | Screenshot the 3D review routes to `assets/renders/` (needs a dev server + Playwright) |

---

## Handoff status

**Blocked on the client.** Every item below is marked `TODO` in the source. The site
builds and ships without them, but the booking flow is a dead end until the Onda Fit
links land.

| Item                                  | Where                                                                                                    | Current placeholder                                                                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Onda Fit booking URL — AS Fortuna** | [hero.tsx:406](src/app/_sections/hero.tsx#L406), [locations.tsx:45](src/app/_sections/locations.tsx#L45) | Hero CTA scrolls to `#locations`; the Locations card's `bookingUrl` is `"#"`                                                                                                           |
| **Onda Fit booking URL — Talisay**    | [hero.tsx:414](src/app/_sections/hero.tsx#L414), [locations.tsx:55](src/app/_sections/locations.tsx#L55) | Same — `#locations` / `"#"`                                                                                                                                                            |
| Street address — AS Fortuna           | [visit.tsx:58](src/app/_sections/visit.tsx#L58)                                                          | "AS Fortuna Street, Mandaue City" (guess). The Google Maps query is derived from `address`, so the pin fixes with it                                                                   |
| Street address — Talisay              | [visit.tsx:58](src/app/_sections/visit.tsx#L58)                                                          | "Talisay City, Cebu" (guess)                                                                                                                                                           |
| Map pins                              | [locations.tsx:47,57](src/app/_sections/locations.tsx#L47)                                               | Maps _search_ URLs, not real place pins                                                                                                                                                |
| Facebook page URL                     | [visit.tsx:40](src/app/_sections/visit.tsx#L40)                                                          | `facebook.com/paddlepowercebu` — unverified                                                                                                                                            |
| Phone + email                         | [visit.tsx:25](src/app/_sections/visit.tsx#L25)                                                          | Not shown. Add as `tel:` / `mailto:` rows in `CHANNELS` when supplied                                                                                                                  |
| Court count                           | [visit.tsx:182](src/app/_sections/visit.tsx#L182)                                                        | The "Courts" row shows hours instead of a count — AS Fortuna floorplan was never confirmed                                                                                             |
| Solar coverage claim                  | hero, footer, locations meta                                                                             | "Solar-powered" is stated unqualified. Confirm before this goes live as a marketing claim                                                                                              |
| FAQ copy                              | [faq.tsx:33-62](src/app/_sections/faq.tsx#L33-L62)                                                       | Five Q&As written by us, not the client. Needs sign-off — especially the rental/beginner/group answers                                                                                 |
| **Official logo files**               | `public/images/paddle-power-*.svg`                                                                       | **Every logo currently in the repo is a generated placeholder**, traced to match the brand guidelines — not the client's real artwork. Swap all of them when the official files arrive |

Once the Onda Fit links arrive, both Hero CTAs and both Locations half-court links should
point at them directly (`target="_blank"`), and the `#locations` interstitial hop goes away.

### Not yet done (team scope)

Named out loud so nothing is assumed complete:

- **SEO.** Only `title` + `description` exist, in [layout.tsx](src/app/layout.tsx#L26).
  Missing: `metadataBase`, canonical URL, Open Graph / Twitter card + OG image,
  `app/sitemap.ts`, `app/robots.ts`, LocalBusiness / SportsActivityLocation JSON-LD
  (two branches, hours, geo — high value for "pickleball Cebu" local search), and a real
  favicon set. Both the OG image and the favicon are blocked on the official logo files —
  see [Assets](#assets).
- **Analytics.** None wired.
- **Performance budget.** Never measured on real hardware. The hero ships 55 WebP frames
  (~1.3 MB) and the page mounts two WebGL viewers — see [Performance notes](#performance-notes).
- **Accessibility audit.** `eslint-plugin-jsx-a11y` passes; no screen-reader or contrast
  pass has been run. The lime-on-white pill CTA in particular should be checked.
- **Content pass.** All body copy is Iridel-written from the PRD and unreviewed by the client.
- **Deploy.** No hosting configured. Currently a Vercel preview only.

---

## Architecture

Standard Next App Router. One route matters; two others are internal tools.

```
src/app/
  layout.tsx        Montserrat (variable) + metadata + SmoothAnchorScroll
  page.tsx          Composition only — no copy lives here
  globals.css       Tailwind 4 theme: --color-pp-* brand tokens, --nav-h, keyframes
  _sections/        One file per section; all copy inline in its own file
  _ui/              Per-client UI, deliberately outside the shared library
  ball-3d/          Internal 3D review route (see below)
  paddle-3d/        Internal 3D review route (see below)
src/components/     Shared Iridel template library — do not edit per-client
src/lib/paddle3d/   Procedural Three.js paddle + ball, built in code
tools/              Asset + render scripts (not part of the build)
docs/               3D pipeline notes and reference renders
```

### Page flow

`SiteHeader → Hero → Locations → Coming Soon → FAQ → Visit → Footer`

Note the deliberate overlap in [page.tsx](src/app/page.tsx): everything after the hero
sits in a `-mt-[70svh]` wrapper so the body slides up over the tail of the hero's scroll
track while the rally keeps scrubbing underneath. **If you change hero heights, that
offset has to move with them.**

| Section     | File                                                 | Notes                                                                                                                                                            |
| ----------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header      | [site-header.tsx](src/app/_sections/site-header.tsx) | Fixed; transparent white over the hero, cream + blur past 24px. Sheet drawer below `lg`                                                                          |
| Hero        | [hero.tsx](src/app/_sections/hero.tsx)               | 55-frame scroll-scrubbed rally behind a liquid-glass overlay panel                                                                                               |
| Locations   | [locations.tsx](src/app/_sections/locations.tsx)     | The two branches _are_ the two halves of one pickleball court. 44:20 at `lg`, stands on its baseline below that. Mounts the 3D paddle + ball on scroll-into-view |
| Coming Soon | [coming-soon.tsx](src/app/_sections/coming-soon.tsx) | Six items: Memberships, Coaching, Events, Café, Equipment, Partnerships (the only "Live now")                                                                    |
| FAQ         | [faq.tsx](src/app/_sections/faq.tsx)                 | Chat-bubble accordion; hover/focus opens, click toggles                                                                                                          |
| Visit       | [visit.tsx](src/app/_sections/visit.tsx)             | Closing CTA on ink. Contact is social link-out only — **the client declined an email/form integration**                                                          |
| Footer      | [footer.tsx](src/app/_sections/footer.tsx)           | Lockup, section links, IG handles                                                                                                                                |

### Conventions to keep

- **Copy lives in the section that renders it.** No shared `content.ts` / constants file.
  `page.tsx` holds imports and composition, nothing else.
- **Never edit `src/components/`** — that's the shared Iridel template library, used by
  other demos. Client-specific UI goes in `src/app/_ui/`.
- Tailwind only. No CSS modules, no inline styles unless a value is computed at runtime.
- TypeScript everywhere; no plain JS.

---

## Assets

**Client asset drive:** https://drive.google.com/drive/folders/1WymbbQGZaF5J_m8QPOqpaCCyDl3zVdMU?usp=sharing
— brand guidelines, court render, floorplan. Check here first before generating anything.

Everything the site serves is flat in `public/images/` (no subfolders), plus the 55-frame
hero rally in `public/frames/`.

> ⚠️ **The logos are placeholders.** `paddle-power-horizontal.svg`,
> `paddle-power-icon.svg`, `paddle-power-icon-black.svg`,
> `paddle-power-primary-stacked.svg`, `paddle-power-one-color-white.svg`,
> `paddle-power-one-color-black.svg` and `paddle-power-social.svg` were **generated by us**
> from the brand guideline PDFs so the build had something to render. They are close, but
> they are not the client's official artwork — vector paths, kerning and the paddle-in-triangle
> mark's proportions have not been verified against a source file. We are still waiting on
> the official logo package from the client. Replace all of them, keeping the same filenames,
> and re-check the header, footer and Visit lockups at every breakpoint afterwards.
>
> The same applies to the favicon — `src/app/favicon.ico` is still the Next.js default and
> needs the real mark plus a full icon set.

`court-render.webp` is real. `paddle-face-*` / `paddle-grip-*` are PBR maps for the 3D
model. `pickleball-ball.png` feeds the ball material.

---

## Brand

Tokens are in [globals.css](src/app/globals.css#L23-L55) as `--color-pp-*`, consumed as
`bg-pp-cream`, `text-pp-ink`, `border-pp-ink/12`, etc.

| Token                        | Hex                   | Role                                                                                                                    |
| ---------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pp-cream`                   | `#F7F4EE`             | Page ground                                                                                                             |
| `pp-tan`                     | `#E8D8C2`             | Warm secondary                                                                                                          |
| `pp-ink`                     | `#111111`             | Text, dark surfaces                                                                                                     |
| `pp-charcoal`                | `#2A2824`             | Softer dark                                                                                                             |
| `pp-ink-wash`                | `#ECE9E3`             | Opaque `ink/5` — FAQ closed bubbles                                                                                     |
| `pp-lime-light`              | `#C8DC3A`             | **The accent green.** Every display-headline accent word, the primary pill CTA, the locations cards, the FAQ open state |
| `pp-lime`                    | `#A3B500`             | Darker brand primary — solid fills that need weight only                                                                |
| `pp-olive`                   | `#7E8C00`             | Focus rings, header link hover                                                                                          |
| `pp-court` / `pp-court-deep` | `#24512D` / `#0E1E12` | **Surfaces only, never accents**                                                                                        |

`pp-olive-deep` is unused; olives were retired as accents on 2026-08-13. If you're
reaching for a green, it's `pp-lime-light` unless the fill needs weight.

**Type:** Montserrat exclusively — 900 logo/display, 700 subheads/buttons, 500 labels,
400 body. No serif anywhere. Loaded as the _variable_ font (no static `weight` list) so
`VariableWeightText` can animate the `wght` axis continuously — don't pin weights in
`layout.tsx` or that breaks.

---

## The 3D paddle and ball

`src/lib/paddle3d/` builds the paddle and pickleball procedurally in Three.js — there is
no `.glb` to hand anyone, the geometry is the code. PBR maps live in `public/images/`
(`paddle-face-*`, `paddle-grip-*`).

Both viewers are `dynamic(..., { ssr: false })` and share a chunk, so whichever of
Locations / showcase the visitor reaches first warms the other.

`/paddle-3d` and `/ball-3d` are **internal review routes** — they take size, angle and
background off the query string and expose `window.__paddle*` / `window.__ball*` hooks
for `tools/export-renders.mjs`. They are not linked from anywhere.

> **Before launch: decide whether these routes ship.** They're harmless but indexable.
> Either `noindex` them, gate them behind a non-production check, or delete them along
> with `tools/export-renders.mjs` and `docs/`.

Pipeline notes and reference renders: [docs/paddle3d/README.md](docs/paddle3d/README.md).

---

## Performance notes

Already handled — don't undo these:

- **Static asset caching.** [next.config.ts](next.config.ts) sets
  `max-age=31536000, immutable` on `/frames/*` and `/images/*` in production. Without it
  Next serves `public/` with `max-age=0`, and a refresh becomes ~74 conditional requests
  that all 304 — no bytes, but a full round-trip each, six at a time, before the hero can
  paint. Dev uses a 300s window so swapping a frame still shows up.
- **WebP everywhere.** `tools/optimize-assets.mjs` halves the frame sequence and cuts the
  court render ~89%. Re-run it after re-extracting frames from the source video (the
  ffmpeg command is in the header comment of [hero.tsx](src/app/_sections/hero.tsx#L11)).
- **Smooth anchor scrolling.** [smooth-anchor-scroll.tsx](src/app/_ui/smooth-anchor-scroll.tsx)
  routes every `href="#id"` through `window.scrollTo` with a post-animation correction.
  Native fragment nav lands short on iOS Safari (collapsing toolbar) and in Chromium when
  the Locations WebGL mount janks mid-scroll. Don't "simplify" this back to native.

Still open: no Lighthouse run, no real-device test, no LCP measurement. The frame
sequence and the two WebGL contexts are the obvious first suspects.

Mobile was verified by hand at 390px and 768px — no horizontal overflow.

---

## Cleaning up the template

This repo started from the Iridel demo template and still carries some of its scaffolding.
Worth clearing during the production pass:

- `package.json` still says `"name": "iridel-demo-template"` with the template description.
- [next.config.ts](next.config.ts) whitelists `assets.nanobanana.io` and
  `images.unsplash.com` as remote image hosts. **Neither is used** — both entries should go.
- `src/lib/images.ts` exports `placeholderImg`; verify `grep -r "placeholderImg" src/`
  comes back empty (it currently does).
- `CLAUDE.md` and `PRD.md` are Iridel working documents, not deliverables.
