## ADDED Requirements

### Requirement: Indexability derives from the resolved host

The system SHALL treat the site as indexable only when the resolved base URL's host matches
the production hostname in configuration. Robots directives, the `robots.txt` body, and the
sitemap contents SHALL all derive from that single condition, with no independent toggle.

#### Scenario: Deployed to production

- **WHEN** the resolved base URL host is the production hostname
- **THEN** the page emits `index, follow`
- **AND** `robots.txt` allows `/`
- **AND** the sitemap lists the site's real routes

#### Scenario: Deployed to a Vercel preview

- **WHEN** the resolved base URL host is a preview or any non-production host
- **THEN** the page emits `noindex, nofollow`
- **AND** `robots.txt` still allows crawling, so the `noindex` can be read
- **AND** `robots.txt` advertises no sitemap
- **AND** the sitemap is empty

#### Scenario: Nobody configured anything

- **WHEN** a preview deploy is created with no SEO-specific configuration
- **THEN** it is non-indexable by default without any manual step

### Requirement: Crawlers are never blocked from fetching

`robots.txt` SHALL NOT disallow the site itself or Next.js build output, in any environment.
Only server API paths may be disallowed. Excluding a page from search SHALL be done with a
`noindex` directive in its head, never by blocking the fetch.

#### Scenario: A non-indexable build is crawled

- **WHEN** a crawler requests a page on a non-production host
- **THEN** `robots.txt` permits the request
- **AND** the crawler receives the page and its `noindex` directive

#### Scenario: A link preview is generated while under review

- **WHEN** a social or chat client fetches a non-production deploy to build a card
- **THEN** it is not blocked, and reads the Open Graph tags

#### Scenario: Googlebot renders the page

- **WHEN** Googlebot fetches JavaScript and CSS from `/_next/static` to render the canvas hero
- **THEN** `robots.txt` permits those requests

#### Scenario: API paths are crawled

- **WHEN** a crawler attempts to fetch a path under `/api/`
- **THEN** `robots.txt` disallows it

### Requirement: Google crawler preview limits are maximised

The system SHALL grant Googlebot unrestricted snippet, image preview, and video preview
lengths.

#### Scenario: Search result is generated

- **WHEN** Google builds a result for the page
- **THEN** `max-snippet:-1`, `max-image-preview:large`, and `max-video-preview:-1` apply

### Requirement: Sitemap advertises real routes only

The sitemap SHALL list the routes intended for visitors, each with a last-modified date and a
change frequency, and SHALL exclude development and review routes.

#### Scenario: Sitemap is fetched

- **WHEN** a crawler requests `/sitemap.xml` on production
- **THEN** the homepage is listed with priority 1
- **AND** neither `/ball-3d` nor `/paddle-3d` appears

#### Scenario: robots.txt points at the sitemap

- **WHEN** a crawler reads `/robots.txt`
- **THEN** it contains an absolute `Sitemap:` URL on the resolved base URL

### Requirement: Review harness routes are excluded from search

The three.js review routes SHALL declare `noindex` metadata regardless of environment. They
SHALL remain routable because the render export tooling drives them.

#### Scenario: A harness route is crawled

- **WHEN** a crawler reaches `/paddle-3d` or `/ball-3d` on production
- **THEN** the response head contains `noindex`

#### Scenario: Render tooling runs

- **WHEN** `tools/export-renders.mjs` loads `/paddle-3d` and `/ball-3d` against a dev server
- **THEN** both routes render and export as before
