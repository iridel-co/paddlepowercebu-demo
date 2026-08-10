# Token Efficiency — Demo Template

## What Claude already knows in this template — don't re-explain

- All section component props and import paths
- Per-client structure: globals.css, layout.tsx, page.tsx (composition), `_sections/*.tsx` (content)
- Image helpers: `localClientImg` → `/images/{filename}` (flat, no slug subfolder), `placeholderImg`
- Section order: Navbar → Hero → StatGrid → FeatureRow → FeatureGrid → Testimonials → CtaBanner
- `TestimonialCard` defaults to `variant="plain"`
- `EmptyState` uses `bg-muted/40`, `ImageCard` uses `shadow-sm` — no borders on either
- `npm run validate` and the three delivery grep checks
- Claude Design output is rebuilt in Tailwind — not imported as CSS

## Minimum viable demo prompt

```
New demo: [Client Name], slug [client-slug].
Brand: [color in plain English or OKLCH].
About: [1–2 sentences on what they do].
Story: [what the demo needs to show — outcome, not feature list].
Assets: [yes — list filenames | no — use placeholders].
```

Example:

```
New demo: Meridian Health, slug meridian-health.
Brand: teal — oklch(0.58 0.14 185).
About: Healthcare analytics platform for hospital systems.
Story: Show how their reporting cuts manual work for data teams by 80%.
Assets: yes — hero.jpg, team.jpg, dashboard.png in public/images/
```

## Component shorthand

| Short form                                 | Means                                    |
| ------------------------------------------ | ---------------------------------------- |
| `3 stats: [v/l], [v/l], [v/l]`             | `StatGrid` with 3 `StatItem`s            |
| `feature row: [topic], image [left/right]` | `FeatureRow` with correct `reverse` prop |
| `6-grid: [theme]`                          | `FeatureGrid` with 6 `FeatureItem`s      |
| `3 testimonials`                           | `TestimonialCard` grid, `plain` variant  |
| `CTA: [headline]`                          | `CtaBanner variant="brand"`              |

## Context you must always provide

- Client slug — controls all image paths
- Brand color — cannot be guessed
- Real stat values, or explicit instruction to use placeholders
- Whether to use `localClientImg` or `placeholderImg` per image slot

## Skill routing (demo work)

| Task                                        | Start with           |
| ------------------------------------------- | -------------------- |
| New demo from scratch                       | `/token-efficiency`  |
| Layout, visual, copy, or responsive design  | `/ui-design`         |
| React / Next.js code changes                | `/frontend`          |
| Image handling or Next.js config            | `/frontend`          |
| Navbar or multi-page wiring                 | `/frontend`          |
| Auditing responsiveness on existing code    | `/mobile-responsive` |
| Batching multiple page changes              | `/token-efficiency`  |
