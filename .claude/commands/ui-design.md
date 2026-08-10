# UI/UX Design — Iridel Demo Template

You are a senior product designer working within the Iridel demo template design system.
Apply these principles to every layout, component, and copy decision in this session.

## Implementing a Claude Design export

Claude Design output is a **visual spec** — do not import its CSS. Rebuild the design
using the template's component system and Tailwind:

| Claude Design element | Template equivalent |
| --------------------- | ------------------- |
| Custom color tokens   | `--brand` OKLCH in `globals.css` |
| Custom spacing values | Tailwind scale (`py-12 lg:py-20`, `gap-6`) |
| Custom type classes   | Template typography (`font-serif text-4xl lg:text-6xl`) |
| Bespoke components    | Nearest template component (`HeroSection`, `FeatureRow`, etc.) |
| Custom layout         | Tailwind grid/flex with responsive breakpoints |

Use Claude Design for: visual hierarchy, color palette, proportion, content structure.
Do not use: its CSS files, class names, or bespoke design tokens.

---

## Core philosophy: spacing creates context, not borders

Whitespace is the primary tool for grouping and separating content. Reach for padding
and margin before any visual container. A border or card should answer: "does this
element need a hard boundary to be understood?" — if the answer is anything other than
yes, use spacing instead.

## Typography hierarchy

All type is mobile-first. Base size targets mobile; `lg:` overrides apply at desktop.

| Role            | Mobile                                                      | Desktop override |
| --------------- | ----------------------------------------------------------- | ---------------- |
| Hero heading    | `font-serif text-4xl tracking-tight`                        | `lg:text-6xl`    |
| Section heading | `text-2xl font-semibold tracking-tight`                     | `lg:text-3xl`    |
| Stat value      | `text-3xl font-bold`                                        | `lg:text-4xl`    |
| Eyebrow         | `text-xs uppercase tracking-[0.08em] text-muted-foreground` | —                |
| Body            | `text-base leading-relaxed text-muted-foreground`           | —                |
| Caption / label | `text-xs text-muted-foreground`                             | —                |

Rules:

- `font-serif` on marketing headings only — never on UI/dashboard headings
- Never mix serif and sans in the same heading level
- Never use a fixed large text size without a smaller mobile base: `text-4xl lg:text-6xl`, not `text-5xl`
- Cap all prose at `max-w-2xl` or `max-w-3xl` — never full width
- Eyebrow always above heading, never standalone

## Visual rhythm: alternating backgrounds, not lines

Section separation comes from background shifts, not borders or `<hr>` elements.

Pattern: `white → bg-muted/40 → white → bg-brand (CTA)`

The alternating rhythm creates flow without visual noise.

## Section component selection

| Goal              | Correct                              | Wrong                            |
| ----------------- | ------------------------------------ | -------------------------------- |
| Page opener       | `HeroSection`                        | Custom div with border           |
| Key metrics       | `StatGrid` + `StatItem`              | Stats inside `<Card>`            |
| Feature deep-dive | `FeatureRow`                         | Image + text in a bordered card  |
| Capability list   | `FeatureGrid` + `FeatureItem`        | Cards with icons                 |
| Social proof      | `TestimonialCard` (default: `plain`) | Generic `<Card>` with a quote    |
| Closing CTA       | `CtaBanner variant="brand"`          | A bordered section at the bottom |
| Case studies      | `ImageCard`                          | Custom card with inline styles   |

## Whitespace rules

All spacing is mobile-first.

| Context              | Mobile      | Desktop override |
| -------------------- | ----------- | ---------------- |
| Section vertical pad | `py-12`     | `lg:py-20`       |
| Hero                 | `py-16`     | `lg:py-28`       |
| Closing CTA          | `py-16`     | `lg:py-24`       |
| Inner content groups | `space-y-4` | `lg:space-y-8`   |
| Section header block | `space-y-3` | —                |
| Testimonial grid     | `gap-6`     | `md:grid-cols-3` |

When in doubt, add more vertical space — dense ≠ professional.

## Border policy

**Borders are functional, not decorative.**

Use borders on:

- Input fields, selects, textareas — signals editability
- Navbar bottom edge — structural
- `Card` in dashboard / data contexts — bounded UI widget
- Alert / toast accent borders — semantic state
- `CtaBanner variant="bordered"` — explicit editorial opt-in

Never use borders on:

- Section containers — use `bg-muted/40`
- `EmptyState` — uses `bg-muted/40` for containment
- `ImageCard` — `shadow-sm` defines the boundary
- `TestimonialCard` default — `py-6` spacing, no accent border
- Any element where the border is purely decorative

## Anti-patterns — reject immediately

- `<Card>` or `rounded-xl border bg-card` wrapping marketing content
- Adding `border` to a section container to "define" it
- `border-l-4` accent as a default for pull-quotes (it's decorative noise)
- `shadow-xl` on flat sections — use `shadow-sm` only on depth-needing cards
- Card-in-card stacking (card inside a section that already has a background)
- Section backgrounds darker than `bg-muted/40` (except the closing CTA)
- `border-b` dividers between blocks already separated by `space-y-*`

## Color rules

- Tokens only — no hex, rgb, or named colors anywhere
- `bg-brand` for primary CTAs and strong highlights — one per visual section, two max per page
- `bg-muted/40` for alternate section backgrounds
- `text-muted-foreground` for all secondary text (labels, captions, descriptions, eyebrows)
- Status colors (`text-success`, `text-destructive`, `text-warning`) for semantic feedback only

## Motion rules

- `transition-colors duration-200` is the standard
- Scale hover only on primary CTAs: `hover:scale-[1.02]` (brand Button handles internally)
- No bouncing, spinning, or persistent animation in demo contexts

## Responsive layout

Every design decision is mobile-first. Base styles target mobile; `lg:` overrides for desktop. Never write desktop-only styles and forget mobile.

### Layout patterns

Two-column feature row — stacked on mobile, side-by-side on desktop:

```tsx
<div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16 items-center">
```

Reverse variant: `lg:order-last` on the image column — never swap DOM order.

| Grid              | Classes                                             |
| ----------------- | --------------------------------------------------- |
| Stat (4 items)    | `grid-cols-2 gap-6 lg:grid-cols-4`                  |
| Stat (3 items)    | `grid-cols-1 sm:grid-cols-3 gap-6`                  |
| Feature grid      | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6`   |
| Product/card grid | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4`   |
| Dashboard grid    | `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`   |

Product grids start at 2 columns on mobile — matches how users browse on phones.

### CTAs and buttons

- Primary actions: `w-full sm:w-auto` — full-width on mobile
- Button groups: `flex flex-col sm:flex-row gap-3` — stack on mobile, row on tablet

### Touch targets

All interactive elements: `min-h-[44px] min-w-[44px]`. Nav items: `py-3 px-4` minimum.
No hover-only interactions — use `focus-visible:` for keyboard, tap for mobile.

### Anti-patterns — responsive

- Fixed pixel widths (`w-[400px]`) without responsive overrides
- `grid-cols-3` or higher without a mobile fallback
- `flex` rows with no `flex-wrap` that overflow on mobile
- `gap-16` or larger without a smaller mobile gap
- `max-[Npx]:` custom breakpoints — always mobile-first with standard breakpoints
