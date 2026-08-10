# Iridel Demo Template — Claude Instructions

> **Precedence:** `/Programming/Iridel/CLAUDE.md` governs process, stack, and core
> directives. This file supplements it — on any conflict, the parent wins.

## Purpose

Iridel's base for all client demos. Ship polished, client-ready demos fast.

At the start of every demo session, read `PRD.md` first. If it isn't filled in, ask for
the missing fields before writing any code.

---

## Skill Commands

| Command               | Use when                                                        |
| --------------------- | --------------------------------------------------------------- |
| `/ui-design`          | Layout, spacing, typography, visual decisions, or mobile design |
| `/frontend`           | Writing or modifying Next.js / React / TypeScript code          |
| `/token-efficiency`   | Starting a new demo or batching multiple changes at once        |
| `/mobile-responsive`  | Auditing or fixing responsiveness on existing components        |

---

## Workflows

### PRD → Claude Code
1. Read `PRD.md` — if fields are missing, ask before writing any code
2. Follow **Starting a New Demo** below

### PRD → Claude Design → Claude Code
1. Read `PRD.md`
2. Use the Claude Design output as a **visual spec** — do not import its CSS
3. Rebuild the design using the template's component system and Tailwind:
   - Custom colors → `--brand` OKLCH token in `globals.css`
   - Custom spacing → Tailwind scale (`py-12 lg:py-20`, `gap-6`)
   - Custom type → template typography classes (`font-serif text-4xl lg:text-6xl`)
   - Custom components → nearest template component (`HeroSection`, `FeatureRow`, etc.)
4. Follow **Starting a New Demo** below

---

## Starting a New Demo

1. Set the client slug (used for metadata and image naming)
2. Check `public/images/` for any photos already dropped in
3. Update `src/app/globals.css` — brand token, radius, background warmth
4. Update `src/app/layout.tsx` — metadata title/description, swap font if needed
5. Create `src/app/_sections/` — one file per section, all content inline per file
6. Wire sections in `src/app/page.tsx` — imports and composition only, no content here
7. Run `npm run validate` before calling it done

---

## Per-Client Customization

Never edit `src/components/`. Only these paths change per client:

| Path | What changes |
| --- | --- |
| `src/app/globals.css` | Brand token, radius, background warmth |
| `src/app/layout.tsx` | Metadata title/description, font |
| `src/app/page.tsx` | Section imports and composition — no content here |
| `src/app/_sections/*.tsx` | One file per section — all content inline in that file |
| `public/images/` | Client assets — flat, no subfolders |

### `src/app/globals.css`

```css
:root {
  --brand: oklch(L C H); /* client's primary color */
  --brand-foreground: oklch(0.985 0 0); /* adjust only if brand is very light */
  --background: oklch(0.985 0.002 H); /* H: ~90 warm, ~0 neutral, ~250 cool */
  --radius: 0.625rem; /* 0.25rem square → 1rem rounded */
}
```

| Color            | OKLCH                  |
| ---------------- | ---------------------- |
| Indigo (default) | `oklch(0.55 0.22 265)` |
| Blue             | `oklch(0.55 0.18 240)` |
| Teal             | `oklch(0.58 0.14 185)` |
| Green            | `oklch(0.55 0.16 155)` |
| Orange           | `oklch(0.62 0.18 55)`  |
| Red              | `oklch(0.55 0.20 25)`  |
| Purple           | `oklch(0.52 0.22 300)` |
| Pink             | `oklch(0.60 0.20 340)` |

Always update both `:root` and `.dark` — dark mode uses ~+0.07 lightness for the same hue.

### `src/app/layout.tsx`

```ts
export const metadata = {
  title: "Client Name — Demo",
  description: "One sentence about what this demo shows.",
}
```

### `src/app/page.tsx`

Section imports and composition only. No strings, stats, or copy here.

```tsx
import { Navbar } from "@/components/common/navbar"
import { DemoHero } from "./_sections/hero"
import { DemoStats } from "./_sections/stats"
import { DemoFeatures } from "./_sections/features"
import { DemoTestimonials } from "./_sections/testimonials"
import { DemoCta } from "./_sections/cta"

export default function Page() {
  return (
    <>
      <Navbar />
      <DemoHero />
      <DemoStats />
      <DemoFeatures />
      <DemoTestimonials />
      <DemoCta />
    </>
  )
}
```

### `src/app/_sections/*.tsx`

One file per section. All content (copy, stats, image paths, labels) lives inline in the file
that renders it — never imported from a separate data or constants file.

```tsx
// src/app/_sections/hero.tsx
import { HeroSection } from "@/components/common/hero-section"
import { localClientImg } from "@/lib/images"
import { Button } from "@/components/ui/button"

export function DemoHero() {
  return (
    <HeroSection
      eyebrow="Healthcare Analytics"
      heading="Cut report time from 2 days to 4 hours"
      subtext="Meridian gives hospital data teams real-time dashboards without the manual exports."
      image={localClientImg("meridian-health", "hero.jpg")}
      imageAlt="Meridian dashboard showing patient flow metrics"
    >
      <Button variant="brand" size="lg">See a live demo</Button>
      <Button variant="outline" size="lg">View pricing</Button>
    </HeroSection>
  )
}
```

For multi-page demos, each route gets its own `_sections/` folder:

```
src/app/
  page.tsx
  _sections/
    hero.tsx · stats.tsx · features.tsx · testimonials.tsx · cta.tsx
  dashboard/
    page.tsx
    _sections/
      overview.tsx · metrics.tsx · ...
```

---

## Section Layout

Default landing page order:

```
Navbar → HeroSection → StatGrid → FeatureRow → FeatureRow →
[bg-muted/40] FeatureGrid → TestimonialCard ×3 → CtaBanner
```

Drop sections that don't serve the story. Alternate `reverse` on consecutive FeatureRows.

**Card rule:** `Card` is for dashboard widgets, data tables, and forms only. Never use
`Card`, `bg-card`, or `rounded-xl border` for marketing content. Use the section
components below instead. If you need visual separation, use `bg-muted/40` — not a border.

**Multi-page:** Don't limit demos to one page. Add pages when a feature deserves its own
walkthrough, the client has a distinct app UI, or a CTA naturally links somewhere.
Inner pages use `PageContainer` + `PageHeader`. Link from `Navbar` or CTA buttons.

---

## Images

All externally sourced images go flat in `public/images/` — no subfolders.

```ts
import { localClientImg, placeholderImg } from "@/lib/images"

localClientImg("client-slug", "hero.jpg") // → /images/hero.jpg
placeholderImg("unsplash-id", 1600, 700)  // dev only — remove before delivery
```

Check `public/images/` before using placeholders.

---

## Available Components

### Marketing / landing

| Component                     | Import                                    | Use for                       |
| ----------------------------- | ----------------------------------------- | ----------------------------- |
| `HeroSection`                 | `@/components/common/hero-section`        | Page opener, brand statement  |
| `FeatureRow`                  | `@/components/common/feature-row`         | Feature deep-dives with image |
| `StatGrid` + `StatItem`       | `@/components/common/stat-grid`           | Key metrics, social proof     |
| `FeatureGrid` + `FeatureItem` | `@/components/common/feature-grid`        | Capability lists              |
| `TestimonialCard`             | `@/components/common/testimonial-section` | Quotes, social proof          |
| `CtaBanner`                   | `@/components/common/cta-banner`          | Page closer, conversion       |
| `ImageCard`                   | `@/components/common/image-card`          | Case studies, resources       |

### App / dashboard

| Component                      | Import                               | Use for            |
| ------------------------------ | ------------------------------------ | ------------------ |
| `Navbar`                       | `@/components/common/navbar`         | Top navigation     |
| `PageContainer` + `PageHeader` | `@/components/common/page-container` | Inner pages        |
| `DashboardGrid`                | `@/components/common/dashboard-grid` | Card/widget grids  |
| `EmptyState`                   | `@/components/common/empty-state`    | Empty lists/tables |

**Navbar is self-contained.** All logo, links, and CTA live inside the component — accept no layout props. Every page renders `<Navbar />` with no props. The component requires `"use client"` because it uses `Sheet` for the mobile drawer. Wrap the logo `<Link>` in `<SheetTitle asChild>` to satisfy the Sheet's required title element without rendering visible text.

### UI primitives — `@/components/ui`

`Button` · `Badge` · `Card` · `Avatar` · `Input` · `Textarea` · `Label` · `Select` ·
`Tabs` · `Dialog` · `Sheet` · `Popover` · `Tooltip` · `Alert` · `Table` · `Skeleton` ·
`Separator` · `Toast` · `Form`

Button variants: `default`, `secondary`, `outline`, `ghost`, `link`, `destructive`, `brand`

`brand` variant: primary CTAs only — one per visual section, two max per page.

---

## Tone and Copy

- **Enterprise / B2B SaaS** — specific, outcome-focused. "Cut report time from 2 days to 4 hours." not "Work smarter."
- **Professional services** — warm, expert. Avoid jargon.
- **Consumer / SMB** — friendly, benefit-led.

Flag placeholder stats in comments:

```tsx
{
  /* TODO: replace with real client metric */
}
;<StatItem value="94%" label="Customer retention" />
```

---

## Quality Checklist

```bash
npm run validate
grep -r "placeholderImg" src/ # must be empty before delivery
grep -r "<img" src/           # must be empty
grep -r "TODO" src/           # review all
```

- [ ] Each section has its own file in `src/app/_sections/`
- [ ] `page.tsx` has no content — imports only
- [ ] All section content is inline in its `_sections/*.tsx` file
- [ ] `public/images/` is flat — no subfolders
- [ ] Brand color correct in light and dark mode
- [ ] At least 3 distinct section types
- [ ] All images have meaningful alt text
- [ ] At least one real photo from `public/images/`
- [ ] No cramped sections — whitespace is generous
- [ ] CTA banner is last section
- [ ] Navbar has the client name or logo
