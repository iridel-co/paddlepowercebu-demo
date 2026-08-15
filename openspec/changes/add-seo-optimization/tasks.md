## 1. Configuration layer

- [x] 1.1 Create `src/config/env.client.ts` resolving `NEXT_PUBLIC_BASE_URL` with a fallback to `https://paddlepowercebu.com`
- [x] 1.2 Create `src/config/app.config.ts` with name, short name, description, production hostname, Talisay address, Plus Code, opening hours, and the Instagram URL
- [x] 1.3 Verify the Plus Code `7R59+W5 Talisay, Cebu` against Google Maps and record the resulting latitude/longitude in the config
- [x] 1.4 Add `TODO` markers in the config for telephone, email, Facebook URL, Ondafit booking URLs, and court count — no placeholder values
- [x] 1.5 Export an `isIndexable` boolean derived from comparing the resolved base URL host against the configured production hostname
- [x] 1.6 Create `src/config/page-metadata.config.ts` with the homepage title, description, and pathname
- [x] 1.7 Add `.env.example` documenting `NEXT_PUBLIC_BASE_URL`

## 2. Metadata generators

- [x] 2.1 Create `src/lib/seo/generate-root-layout-metadata.ts` emitting `metadataBase`, title template, description, icons, Open Graph, and Twitter card
- [x] 2.2 Drive the `robots` block in that generator off `isIndexable`, including `max-snippet:-1`, `max-image-preview:large`, `max-video-preview:-1` for Googlebot
- [x] 2.3 Confirm the root generator does NOT set `alternates.canonical`
- [x] 2.4 Create `src/lib/seo/generate-page-metadata.ts` taking title, description, pathname, and optional OG image, and setting a per-route canonical
- [x] 2.5 Replace the inline `metadata` object in `src/app/layout.tsx` with `generateRootLayoutMetadata()`
- [x] 2.6 Add `generateMetadata` to `src/app/page.tsx` using the homepage config entry
- [x] 2.7 Add `export const metadata = { robots: { index: false, follow: false } }` to `src/app/ball-3d/page.tsx` and `src/app/paddle-3d/page.tsx`

## 3. Crawler directives

- [x] 3.1 Create `src/app/robots.ts` allowing `/` and disallowing `/api/*` in every environment; off-production builds advertise no sitemap
- [x] 3.2 Confirm neither `/_next/*` nor `/` is disallowed in any branch
- [x] 3.3 Point `robots.txt` at the absolute sitemap URL on the resolved base URL
- [x] 3.4 Create `src/app/sitemap.ts` returning the homepage when indexable and an empty array otherwise
- [x] 3.5 Confirm neither `/ball-3d` nor `/paddle-3d` appears in the sitemap
- [x] 3.6 Verify `tools/export-renders.mjs` still drives both harness routes end to end

## 4. Structured data

- [x] 4.1 Extract the FAQ array from `src/app/_sections/faq.tsx` into `src/app/_sections/faq.data.ts` and import it back
- [x] 4.2 Create `src/lib/seo/structured-data.ts` with a `SportsActivityLocation` builder reading from `APP_CONFIG`
- [x] 4.3 Make the builder omit any key whose config value is undefined, so no placeholder reaches the output
- [x] 4.4 Add a `FAQPage` builder generating entities from `faq.data.ts`, using prose answers only
- [x] 4.5 Create `src/components/common/json-ld.tsx` as a server component rendering escaped `application/ld+json`
- [x] 4.6 Mount both JSON-LD blocks in `src/app/layout.tsx`
- [x] 4.7 Confirm both blocks appear in the raw HTML with `curl -s localhost:3000 | grep ld+json`

## 5. OG image and icons

- [x] 5.1 Commit `assets/og/index.html` as the 1200×630 source template, reading the logo from `public/images/`
- [x] 5.2 Rasterise to `public/og/index.png` and confirm the output is exactly 1200×630
- [x] 5.3 Confirm the 2:1 crop clips nothing; note that a centred 1:1 crop drops the text panel by design
- [x] 5.4 Generate `public/favicon.svg` from `paddle-power-icon.svg`
- [x] 5.5 Generate `public/apple-touch-icon.png` (180×180) and `public/web-app-manifest-192x192.png` / `-512x512.png` from the icon mark
- [x] 5.6 Create `src/app/manifest.ts` with the site name, `#111111` background, `#C8DC3A` theme colour, and both PNG icons
- [x] 5.7 Wire the icon set into the root metadata generator

## 6. On-page semantics

- [x] 6.1 Add an `sr-only` span inside the `<h1>` in `src/app/_sections/hero.tsx` reading "— premium indoor pickleball courts in Talisay, Cebu"
- [x] 6.2 Confirm the visible headline, its line breaks, and the weight-sweep timing constants are unchanged at 390px, 768px, and 1440px
- [x] 6.3 Confirm the added text sits inside the `<h1>` element, not adjacent to it
- [x] 6.4 Add location wording to the Locations and Visit headings without breaking the `VariableWeightText` sweeps
- [x] 6.5 Audit every `alt` on the page and rewrite any that names a file or repeats the wordmark without context
- [x] 6.6 Confirm exactly one `<h1>` and no skipped heading levels on the homepage

## 7. Validation

- [x] 7.1 Run `npm run validate` and fix any typecheck, lint, or format failures
- [x] 7.2 Run `grep -r "<img" src/` and confirm it is empty
- [ ] 7.3 Validate both JSON-LD blocks in the Google Rich Results Test against the preview URL
- [ ] 7.4 Validate the OG card in the Facebook Sharing Debugger and the X Card Validator
- [ ] 7.5 Paste the preview URL into iMessage and Slack and confirm the card renders
- [x] 7.6 Confirm a preview deploy serves `noindex` while robots.txt still allows crawling
- [x] 7.7 Confirm setting `NEXT_PUBLIC_BASE_URL` to the production domain flips robots, sitemap, and meta robots together

## 8. Launch and follow-up

- [ ] 8.1 Set `NEXT_PUBLIC_BASE_URL=https://paddlepowercebu.com` in Vercel production
- [ ] 8.2 Submit the sitemap in Google Search Console and request indexing for the homepage
- [ ] 8.3 Ask the client whether a Google Business Profile exists for the Talisay venue, and align its NAP with `app.config.ts`
- [ ] 8.4 Run PageSpeed Insights against production and open a separate performance change if the canvas hero's LCP is poor
- [ ] 8.5 Chase the client for phone, email, Facebook URL, and Ondafit booking links, then fill the config TODOs and add a `ReserveAction`
