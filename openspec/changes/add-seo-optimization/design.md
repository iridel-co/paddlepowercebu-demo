## Context

`src/app/layout.tsx` exports a five-line `metadata` object. That is the whole SEO surface.
The site is one route (`/`) with anchor-based navigation (`#top`, `#locations`, `#soon`,
`#faq`, `#visit`, `#contact`) plus two three.js review harnesses at `/ball-3d` and
`/paddle-3d` that exist to feed `tools/export-renders.mjs` and are not marketing pages.

The reference implementation is `iridel-co/LRA#53` (merged, branch `feat/seo`), which
established a config → generator → route pattern across five files. It is a good skeleton and
we adopt its shape, but it has three defects we do not carry over (see Decisions).

Constraints from the project's own rules:

- `src/components/ui/**` and existing `src/components/common/**` files are never edited per
  client. Only `globals.css`, `layout.tsx`, `page.tsx`, `_sections/*`, and `public/` change.
- `page.tsx` holds composition only — no strings.
- `npm run validate` (typecheck + eslint + prettier) must pass.

Constraints from the client:

- The venue has one open branch (Talisay); a second is under construction.
- No phone, no email, no confirmed Facebook URL, no Ondafit booking URLs. Contact is
  social link-out only.

## Goals / Non-Goals

**Goals:**

- Rich, correct link previews wherever the URL is shared — the demo's most common first
  impression is a pasted link in a chat.
- Machine-readable local-business facts so the venue can surface for "pickleball Cebu",
  "pickleball Talisay", and "pickleball court near me".
- Indexing that is safe by construction: preview deploys must not be _indexable_, and the
  correctness of that must not depend on anyone remembering to flip a flag. They stay
  crawlable — see decision 2b.
- A metadata layer that survives the site growing to multiple pages without rework.

**Non-Goals:**

- Core Web Vitals work. The 55-frame canvas hero is very likely the LCP element and the
  site's largest ranking liability, but fixing it is a rendering change, not a metadata
  change. Called out in Risks; scoped to its own change.
- Multi-page IA. The anchor-based single page stays as designed.
- Runtime OG image generation via `next/og`. One page, one preview image.
- Analytics, Search Console verification, or Google Business Profile setup — operational
  work outside the repo, flagged in Open Questions.
- Any invented business data to fill a schema field.

## Decisions

### 1. Adopt LRA#53's config → generator → route layering, with three corrections

The pattern is sound: facts in `app.config.ts`, per-route copy in `page-metadata.config.ts`,
assembly in `lib/seo/*`, consumption in route files. It keeps copy out of components and
makes adding a page a two-line job.

The corrections:

| LRA#53 does                                              | We do instead                                                               | Why                                                                                                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `robots.ts` disallows `/_next/*`                         | Allow `/_next/*`; disallow only `/api/*`                                    | Googlebot fetches JS and CSS from `/_next/static` to render the page. On a canvas-and-three.js site, blocking it risks the crawler seeing an empty hero. This is the single most consequential fix. |
| Root layout sets `alternates.canonical` to the site root | Root layout sets `metadataBase` only; each route declares its own canonical | A root-level canonical is inherited by any route that forgets its own metadata, silently pointing it at `/`. Fail-open beats fail-silent.                                                           |
| No structured data                                       | `SportsActivityLocation` + `FAQPage` JSON-LD                                | For a physical venue this is the highest-leverage item available, and it is entirely absent from the reference.                                                                                     |

Also dropped: `openGraph.phoneNumbers` / `emails` / `countryName`, which are only meaningful
for `og:type=business.business`, not `website`.

**Alternative considered:** inline the metadata object in `layout.tsx` and skip the config
layer. Rejected — three files of indirection is close to YAGNI's limit for a one-page site,
but the JSON-LD, the sitemap, and the OG image all need the same address and hours, and
duplicating NAP data across four call sites is exactly how local SEO breaks.

### 2. Indexability derives from the resolved base URL, not a separate flag

The base URL resolves from whatever the deployment can tell us, so a build is correct
without anyone setting anything:

```
  NEXT_PUBLIC_BASE_URL                          explicit override, always wins
       └─ unset ─► VERCEL_ENV === "production"
                     └─ yes ─► VERCEL_PROJECT_PRODUCTION_URL   project's own domain
                     └─ no  ─► VERCEL_URL                      this deployment
       └─ neither ─► https://paddlepowercebu.com               local dev
```

`VERCEL_ENV` is checked deliberately: `VERCEL_PROJECT_PRODUCTION_URL` is set on preview
builds too, so using it unguarded would let every branch deploy claim to be production and
invite Google in.

Indexability then falls out of the host:

```
  IS_INDEXABLE = new URL(baseUrl).host === "paddlepowercebu.com"
          │
          ├──► layout metadata  index/follow   vs.  noindex/nofollow
          ├──► sitemap.ts       real routes    vs.  []
          └──► robots.ts        sitemap: …     vs.  no sitemap advertised
                                (crawling itself is allowed either way — see 2b)
```

One derived boolean. While the site lives on `paddlepowercebu-demo.vercel.app` it is
crawlable but `noindex`; attaching the real domain to the project flips it to indexable with
no code change and no env var.

**Alternative considered:** an explicit `NEXT_PUBLIC_ALLOW_INDEXING` flag. Rejected — it is
one more thing that can be wrong, and its correct value is always derivable from the URL.

### 2b. Non-indexable does not mean non-crawlable

A first pass had `robots.ts` return `Disallow: /` whenever `IS_INDEXABLE` was false. That is
wrong twice over, and deploying the demo made both concrete:

- A crawler blocked from fetching the page never reads the `noindex` in its head. A URL
  linked from anywhere can still surface as a bare result, and there is no directive
  available to suppress it. Blocking the fetch is what _prevents_ de-indexing.
- Link-preview scrapers honour `robots.txt` too. A blanket disallow means the Open Graph
  card silently stops working in exactly the situation it exists for — sharing a demo link
  for review.

So `robots.txt` allows crawling in every environment, `/api/` aside, and search exclusion is
carried by the `noindex` header on the page. Off-production builds additionally advertise no
sitemap, so there is nothing inviting discovery.

### 3. Structured data emits only verified facts

`SportsActivityLocation` (a subtype of `LocalBusiness`, and the correct type for a court
venue) with:

```
  name          Paddle Power Cebu
  address       Maghaway Rd, Talisay City, 6045 Cebu, PH   (PostalAddress)
  geo           derived from Plus Code 7R59+W5             (GeoCoordinates)
  openingHours  Mo-Su 00:00-23:59                          (24/7, matches the FAQ)
  sameAs        [ instagram ]
  url / image   site URL and the OG image
```

Fields whose values are unknown — `telephone`, `email`, the Facebook `sameAs` entry, a
booking `potentialAction`, `amenityFeature` for court count — are **omitted from the emitted
object entirely**, not stubbed. A missing property is neutral; a wrong phone number is an
active local-ranking harm and an inconsistency Google will hold against the listing. The
config marks each gap with a `TODO` so the field is one edit away when the client answers.

`FAQPage` is generated from the same array that renders the FAQ section, so the two cannot
drift. That means the FAQ copy moves out of `faq.tsx` into a shared module — the one place
this change bends the project's "content inline in its section file" rule, and it bends it
because two sources of truth for the same seven questions is worse.

### 4. The OG image is a static asset built from a checked-in HTML template

`assets/og/index.html` is the source; `public/og/index.png` is the 1200×630 render, produced
by headless Chrome and committed. `next/og` would mean an edge runtime, font loading, and a
render on every crawler request — for an image that changes when the second branch opens,
i.e. roughly never.

HTML rather than a flat SVG: the template `<img>`s the real wordmark and icon straight out of
`public/images/`, so a logo change regenerates the card correctly instead of drifting from a
traced copy. A self-contained SVG would either need the logo paths duplicated or the font
embedded as base64 — both are copies that rot. The trade is that rasterising needs Chrome and
a network connection for Montserrat, which is acceptable for an asset regenerated once or
twice a year.

Design follows the site's own visual language rather than a generic card: the overhead court
from the hero frames (tan surround, green service zones, cream kitchen, white lines, net down
the middle), the horizontal wordmark, and one line of local intent — _Premium indoor
pickleball · Talisay, Cebu · Open 24/7_. Text is confined to the safe zone so nothing is
clipped by Twitter's or iMessage's aspect-ratio crops.

### 5. Keyword coverage is added without touching the hero design

The `<h1>` stays "Your court. Anytime." An `sr-only` span inside the same `<h1>` carries the
searchable phrasing. This is legitimate — the text describes the page's actual subject and is
served identically to users and crawlers — and it is the same mechanism `VariableWeightText`
already uses at [variable-weight-text.tsx:189](../../../src/components/ui/variable-weight-text.tsx:189),
so it is consistent with the codebase rather than a bolt-on.

Note the existing consequence: `VariableWeightText` renders its text twice in the DOM (an
`sr-only` copy plus `aria-hidden` per-character spans). Harmless for ranking, but it means
the rendered-text extraction a crawler sees contains duplicates. Worth knowing when reading
Search Console's rendered HTML.

## Risks / Trade-offs

- **The canvas hero is probably a bad LCP, and this change does not fix it** → Measure with
  PageSpeed Insights on the production URL immediately after launch and open a separate
  performance change. Metadata cannot compensate for a slow render; do not let good schema
  create the impression the SEO work is finished.
- **Structured data ships incomplete, so rich results may not trigger** → Accepted
  deliberately. `SportsActivityLocation` without a phone still validates and still feeds the
  Knowledge Graph. The alternative — placeholder NAP data — is worse than incomplete data.
- **A Plus Code is not a verified Google listing** → The derived lat/long is accurate for the
  map pin, but organic local ranking depends far more on a claimed Google Business Profile
  than on JSON-LD. Flagged as the top operational follow-up; the schema is necessary but not
  sufficient.
- **Moving FAQ copy out of `faq.tsx` bends the project's inline-content rule** → Confined to
  that one array, kept in `src/app/_sections/faq.data.ts` next to its section rather than in a
  global constants file, so the content still lives beside what renders it.
- **Hardcoding the production host in the indexability check** → If the domain changes, the
  site silently goes `noindex`. Mitigated by putting the host in `app.config.ts` beside the
  other business facts, where a domain change is already an obvious edit.
- **The `sr-only` line could be read as keyword stuffing if it grows** → Keep it to one
  descriptive clause about what the venue actually is. It describes the page; it does not
  list terms.
- **The OG card's split layout loses its text under a centred square crop** → Verified: the
  native 1.91:1 and X's 2:1 crops are clean, but a client that centre-crops to 1:1 (WhatsApp's
  small preview does) shows court and no wordmark. Accepted — every split-layout card has
  this, and the surfaces that matter here (X, Facebook, LinkedIn, Slack, iMessage, Discord)
  all render the full ratio. Revisit only if WhatsApp becomes the main share channel.

## Migration Plan

1. Land config + generators + `robots.ts` / `sitemap.ts` behind the env gate. Nothing is
   indexable yet because preview deploys resolve to a non-production host — safe to merge.
2. Add JSON-LD and the OG image; verify with the Rich Results Test and the Facebook / X card
   validators against the preview URL (validators fetch regardless of `noindex`).
3. Add icons and manifest.
4. On launch, set `NEXT_PUBLIC_BASE_URL=https://paddlepowercebu.com` in Vercel production.
   Indexing turns on as a consequence.
5. Submit the sitemap in Search Console and confirm the Talisay Google Business Profile.

**Rollback:** unset or change `NEXT_PUBLIC_BASE_URL` and the entire surface reverts to
`noindex` on the next deploy. No data migration, no schema state.

## Open Questions

- Does a claimed Google Business Profile exist for the Talisay venue? It outranks everything
  in this change for local visibility. Client question, not a code question.
- Is `paddlepowercebu.com` staying on Squarespace, or does DNS move to Vercel at launch? The
  indexability gate assumes the latter.
- Should the second branch appear in schema before it opens? Recommendation: no — an
  unopened location with no address is not a `Place`. Add it when it has one.
- Ondafit booking URLs would unlock a `ReserveAction` `potentialAction`, which is what makes
  a "Book" affordance possible in search results. Worth chasing for that reason alone.
