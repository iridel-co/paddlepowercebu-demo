# Paddle Power Cebu — Demo PRD

> Single-page teaser site. Booking handled externally via Ondafit.

---

## Client

| Field | Value |
| Name | Paddle Power Cebu |
| Slug | paddle-power-cebu |
| Industry | Pickleball facility + café (sports & recreation) |
| Website | paddlepowercebu.com (currently Squarespace "coming soon" placeholder) |

---

## Brand

| Field      | Value                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Primary    | Paddle Power Lime — #A3B500                                                                                                             |
| Secondary  | Warm Cream #E8D8C2, Deep Black #111111, Charcoal #2A2824, White #FFFFFF                                                                 |
| Tone       | Energetic, premium, community-driven                                                                                                    |
| Serif font | None — brand uses Montserrat (sans-serif) exclusively: Black for logo/headlines, Bold subheads, Regular body, Medium for labels/buttons |
| Notes      | Logo icon is a paddle-in-triangle mark, usable standalone. IG handles: @paddlepowercebu, @michaeljhaye                                  |

---

## Context

**What they do:**
Paddle Power Cebu runs premium indoor pickleball courts, solar-powered and open 24/7, across two Cebu branches (AS Fortuna and Talisay), with a café and pro shop planned on-site.

**Why this demo:**
Replace the current Squarespace "coming soon" placeholder with a real teaser site that drives court bookings and previews upcoming services (café, memberships, coaching, events, equipment).

**Audience:**
Cebu-based pickleball players and casual/social groups looking to book a court, plus early community members interested in memberships or events.

---

## Story

**The one thing this demo must communicate:**
"Book a court in one tap — 24/7, solar-powered pickleball, two Cebu locations."

**Section flow:**
Navbar → Hero (court render + direct booking CTAs) → Stats → Locations/Book → Coming Soon grid (Memberships, Coaching, Events, Café, Equipment) → Partnerships (social link-out) → Footer

---

## Content

### Stats (3–4)

| Value  | Label                                                    | Trend |
| ------ | -------------------------------------------------------- | ----- |
| 24/7   | Access, rain or shine                                    | n/a   |
| 100%\* | Solar-powered                                            | n/a   |
| 2      | Cebu locations                                           | n/a   |
| —\*    | Courts (count TBD, AS Fortuna floorplan pending confirm) | n/a   |

> `*` = placeholder, confirm before delivery.

### Feature rows (1–2)

1. **Book Instantly** — Two branches, two direct booking links via Ondafit, zero signup friction. Image: right (court render).
2. **Café — Coming Soon** — A space to recharge between games, opening soon at AS Fortuna. Image: left (teaser only, no floorplan shown).

### Capabilities (FeatureGrid — 6 items)

- Memberships — _Coming soon_
- Coaching Sessions — _Coming soon_
- Events & Bulk Reservations — _Coming soon, birthdays & group bookings_
- Café — _Coming soon_
- Equipment (merch, paddle rental, balls) — _Coming soon_
- Partnerships — Live now, inquiries via Instagram/Facebook

### Testimonials (3)

1. "[Quote]"_ — [Name]_, [Title]_, [Company]_
2. "[Quote]"_ — [Name]_, [Title]_, [Company]_
3. "[Quote]"_ — [Name]_, [Title]_, [Company]_

> All placeholder — no reviews sourced yet.

### CTA

**Heading:** "Your court is waiting."
**Subtext:** Pick your branch and book in one tap.
**Primary button:** Book AS Fortuna → [Ondafit link — AS Fortuna]
**Secondary button:** Book Talisay → [Ondafit link — Talisay]

> Both buttons treated as equal primary CTAs side by side — no location picker step, direct 1-click booking per branch.

---

## Assets

Images in `public/images/paddle-power-cebu/`:

| Filename                                   | Used in                                                                      | Status                |
| ------------------------------------------ | ---------------------------------------------------------------------------- | --------------------- |
| courtrender.png                            | Hero                                                                         | [x] ready             |
| floorplan.png                              | Internal ref only (not displayed — cafe/court section stays text-only tease) | [ ] not used in build |
| brandguidelines.png / brandguidelines2.png | Reference only (logo, colors, type)                                          | [x] ready             |

> Note: No address/location images yet — locations shown as text labels only (AS Fortuna, Talisay), addresses TBD.

---

## Delivery

| Field  | Value                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format | Vercel preview URL                                                                                                                                                                    |
| Notes  | Partnerships + general contact = Instagram/Facebook link-out only, no form (client declined Resend integration). Booking links (Ondafit, per branch) needed from client before build. |

---

## Build Status — 2026-08-11

Implemented from the Claude Design file `Paddle Power Cebu.dc.html`
(project `04812303-2742-4522-a15a-677d4dadd018`), pulled via the design MCP.

**Section flow as built:** `SiteHeader → Hero (scroll scrub) → Stats → Locations →
Coming Soon → Partnerships → Paddle Showcase → Footer` — one file each in
`src/app/_sections/`.

| Area           | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand palette  | Done — `--color-pp-*` tokens in `globals.css` (cream/tan/ink/charcoal/lime/olive/court)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Greens         | Settled 2026-08-13. `pp-lime-light` #C8DC3A is _the_ accent green, light or dark background alike: every display-headline accent word (hero "Anytime.", partnerships "scene.", FAQ "answered."), the `lime-light` pill CTA (`bg-pp-lime-light text-white`), the locations cards, the FAQ open-question pill and its open-item icon. `pp-lime` #A3B500 is the darker brand primary, kept for solid fills that need weight — Coming Soon "Live now", the `lime` pill CTA. `pp-court` #24512D / `pp-court-deep` #0E1E12 are surfaces only (the court and the panels on it), never accents. Olives retired: `pp-olive-deep` unused, `pp-olive` only as focus rings and header link hover. |
| Type           | Done — Montserrat 400/500/700/900, no serif                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Header         | Done — fixed, transparent over hero, cream + blur past 24px, Sheet drawer below `lg`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Hero           | Done — design's overlay over the **existing 55-frame scroll scrub** (the design's still court render was not used, per brief)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Lower sections | Built out for real from this PRD; the design file had them as dashed placeholders                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Locations      | Rebuilt 2026-08-12 from `Court Booking Choice.dc.html` (design project `8e8c176b…`) — the two branches are the two halves of one pickleball court, one tap each. Court runs 44:20 at `lg`, stands on its baseline below it. Branch feature bullets dropped in favour of the court graphic.                                                                                                                                                                                                                                                                                                                                                                                            |
| Mobile         | Verified at true 390px and 768px viewports — no horizontal overflow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

**Blocking on client before delivery** (each marked `TODO` in the source):

- Ondafit booking URLs, per branch — `_sections/hero.tsx`, `_sections/locations.tsx`
- Court count (currently `TBC`) and solar coverage `100%` — `_sections/stats.tsx`
- Street addresses for both branches — `_sections/locations.tsx`
- Facebook page URL — `_sections/partnerships.tsx`
