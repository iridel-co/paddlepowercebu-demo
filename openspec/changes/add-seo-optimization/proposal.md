## Why

The site ships two lines of metadata — a title and a description — and nothing else. No
canonical, no Open Graph, no Twitter card, no `robots.txt`, no `sitemap.xml`, no structured
data, and no social preview image, so every link shared in a DM or a group chat renders as a
blank grey card. Paddle Power Cebu is a physical venue whose customers search "pickleball
Cebu" and "pickleball court near me", and the page currently gives search engines almost
nothing to work with: the `<h1>` reads "Your court. Anytime.", which contains none of those
terms, and the seven-question FAQ and the Talisay address are invisible as machine-readable
facts.

Two review harness routes (`/ball-3d`, `/paddle-3d`) are also publicly routable and would be
indexed alongside the real page.

## What Changes

- **Config layer** — a single `APP_CONFIG` holding the verified business facts (name,
  description, address, Plus Code geo, hours, socials) and an `ENV_CLIENT` module resolving
  `NEXT_PUBLIC_BASE_URL`. Adapted from a previously merged SEO implementation.
- **Metadata generators** — `generateRootLayoutMetadata()` producing `metadataBase`, title
  template, description, canonical, Open Graph, Twitter `summary_large_image`, icons, and
  `robots` directives; plus `generatePageMetadata()` for future routes.
- **Env-gated indexability** — the site is indexable only when the resolved base URL is the
  production domain. Vercel preview deploys emit `noindex` automatically, so the demo cannot
  leak into search results before launch.
- **`robots.ts` and `sitemap.ts`** — sitemap lists the single real route; robots allows
  crawling and points at the sitemap. **Unlike LRA#53, `/_next/*` is NOT disallowed** —
  blocking it starves Googlebot of the JS and CSS it needs to render a canvas-driven page.
- **Structured data** — `SportsActivityLocation` JSON-LD (name, address, geo, `openingHours`
  24/7, `sameAs` Instagram) and `FAQPage` JSON-LD built from the seven live FAQ entries.
  Verified facts only: phone, email, booking URL, and court count are omitted rather than
  stubbed, so no invented NAP data can reach Google.
- **OG image** — a 1200×630 branded PNG in the site's own visual language (overhead court,
  tan surround, green service zones, lime accent, Montserrat Black lockup), plus an HTML
  source template that reads the real logo files so the card can be regenerated on demand.
- **Icon set** — `favicon.svg`, `apple-touch-icon.png`, and 192/512 PNGs with a web manifest,
  replacing the lone `.ico`.
- **On-page semantics** — an `sr-only` context line inside the `<h1>` carrying "premium indoor
  pickleball courts in Talisay, Cebu", and keyword-bearing wording in the Locations and Visit
  headings. The visible hero design is unchanged.
- **Harness routes excluded** — `/ball-3d` and `/paddle-3d` get `robots: { index: false }` and
  stay out of the sitemap. They are kept, not deleted: `tools/export-renders.mjs` drives both
  routes to produce the paddle and ball renders.

## Capabilities

### New Capabilities

- `search-metadata`: Head-tag metadata for every route — canonical URL, title template,
  description, Open Graph, Twitter card, icon set, and the social preview image asset.
- `crawler-directives`: `robots.txt` and `sitemap.xml` generation, plus the environment-gated
  rule deciding when the site is indexable and which routes are excluded.
- `structured-data`: JSON-LD describing the business as a local sports venue and the FAQ
  content, emitted only from verified facts.
- `on-page-semantics`: Crawlable text content — heading keyword coverage, screen-reader
  context, and image alternative text.

### Modified Capabilities

None — `openspec/specs/` is empty; this is the first change in the repo.

## Impact

**New files**

- `src/config/env.client.ts`, `src/config/app.config.ts`, `src/config/page-metadata.config.ts`
- `src/lib/seo/generate-root-layout-metadata.ts`, `src/lib/seo/generate-page-metadata.ts`
- `src/lib/seo/structured-data.ts`, `src/components/common/json-ld.tsx`
- `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/manifest.ts`
- `public/og/index.png` and `assets/og/index.html`
- `public/favicon.svg`, `public/apple-touch-icon.png`, `public/web-app-manifest-{192,512}.png`

**Modified files**

- `src/app/layout.tsx` — swap the inline `metadata` object for the generator, mount JSON-LD
- `src/app/_sections/hero.tsx` — `sr-only` context inside the `<h1>`
- `src/app/_sections/locations.tsx`, `src/app/_sections/visit.tsx` — heading wording, alt text
- `src/app/ball-3d/page.tsx`, `src/app/paddle-3d/page.tsx` — `noindex` metadata
- `.env.example` — document `NEXT_PUBLIC_BASE_URL`

**Not touched**

- `src/components/ui/**` and `src/components/common/**` existing files — per project rules,
  shared components are not edited per client. One new file (`json-ld.tsx`) is added.
- No new runtime dependencies. `next/og` is deliberately not used; the OG image is a static
  asset because the site has one page and no dynamic preview content.

**Blocked on the client** (tracked as TODOs, not stubbed):
Ondafit booking URLs, phone, email, confirmed Facebook page URL, court count, and whether a
Google Business Profile exists for the Talisay venue. Structured data ships without them and
gains `telephone`, `sameAs`, and a booking `potentialAction` once supplied.
