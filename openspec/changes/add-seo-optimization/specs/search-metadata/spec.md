## ADDED Requirements

### Requirement: Single source of business facts

The system SHALL hold every externally-published business fact — legal name, short name,
description, street address, geo coordinates, opening hours, social profile URLs, and the
production hostname — in one configuration module, and every metadata, sitemap, and
structured-data consumer SHALL read from it rather than restating the value.

#### Scenario: Address appears in more than one output

- **WHEN** the venue address is rendered into both the JSON-LD block and the Visit section
- **THEN** both values originate from the same configuration entry
- **AND** changing that entry updates every output without further edits

#### Scenario: A fact is not yet known

- **WHEN** a field such as telephone or booking URL has no confirmed value
- **THEN** the configuration marks it with a `TODO` comment
- **AND** the field is absent from the config object rather than holding a placeholder string

### Requirement: Base URL resolves from the environment

The system SHALL resolve the site's base URL from `NEXT_PUBLIC_BASE_URL`, falling back to the
production domain when the variable is unset.

#### Scenario: Deployed to a preview environment

- **WHEN** `NEXT_PUBLIC_BASE_URL` is set to a Vercel preview URL
- **THEN** all canonical and Open Graph URLs resolve against that preview origin

#### Scenario: Variable is unset

- **WHEN** `NEXT_PUBLIC_BASE_URL` is not defined
- **THEN** the base URL resolves to the production domain
- **AND** the build does not fail

### Requirement: Root layout emits complete head metadata

The root layout SHALL emit `metadataBase`, a title with a `%s | Paddle Power Cebu` template,
a description, Open Graph tags, and a Twitter `summary_large_image` card.

#### Scenario: Homepage is requested

- **WHEN** a crawler fetches `/`
- **THEN** the response head contains `og:title`, `og:description`, `og:image`, `og:url`,
  `og:type=website`, `og:locale=en_PH`, and `og:site_name`
- **AND** contains `twitter:card=summary_large_image` with a matching image

#### Scenario: A future route sets its own title

- **WHEN** a route exports a title of "Memberships"
- **THEN** the rendered `<title>` reads "Memberships | Paddle Power Cebu"

### Requirement: Canonical URLs are declared per route

Each route SHALL declare its own canonical URL. The root layout SHALL NOT declare a canonical
that other routes inherit.

#### Scenario: Homepage canonical

- **WHEN** `/` is rendered
- **THEN** `<link rel="canonical">` points at the site root on the resolved base URL

#### Scenario: A route omits its own metadata

- **WHEN** a route provides no canonical of its own
- **THEN** no canonical tag is emitted for it
- **AND** no inherited canonical incorrectly points that route at the homepage

### Requirement: Social preview image

The system SHALL serve a 1200×630 PNG Open Graph image referenced by both the Open Graph and
Twitter card tags, and SHALL keep a reproducible source template for it in the repository.

#### Scenario: Link is shared in a chat client

- **WHEN** the site URL is pasted into a client that renders Open Graph previews
- **THEN** a 1200×630 branded image renders with the wordmark and location legible

#### Scenario: Preview is cropped to a narrower aspect ratio

- **WHEN** a client crops the image to 2:1
- **THEN** all text, the wordmark, and the strapline remain fully visible

#### Scenario: Image needs regeneration

- **WHEN** business details or the logo change
- **THEN** the committed source template is edited and re-rasterised to the same dimensions
- **AND** the template reads the logo from `public/images/` rather than an embedded copy

### Requirement: Complete icon set

The system SHALL provide an SVG favicon, an Apple touch icon, 192px and 512px PNG icons, and
a web manifest.

#### Scenario: Site is saved to an iOS home screen

- **WHEN** a visitor adds the site to their home screen
- **THEN** the Apple touch icon is used rather than a page screenshot

#### Scenario: Browser requests the manifest

- **WHEN** a browser fetches the web manifest
- **THEN** it receives the site name, theme colour, and both PNG icon sizes
