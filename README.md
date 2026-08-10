# Iridel Demo Template

A warm, minimal, accessibility-first Next.js starter for building client-facing demos fast.

**Stack:** Next.js · React 19 · Tailwind CSS 4 · TypeScript · Radix UI · Lucide React

---

## Workflow

The fastest path from "new client" to "delivered demo":

### 1. Fill in the PRD

Open `PRD.md` and fill in every field — client name, slug, brand color, story, stats,
testimonials, assets. This is the source of truth Claude reads before touching any code.

If you don't have all the details yet, give Claude what you do have and tell it which
fields to treat as placeholders:

```
Client: Meridian Health, slug meridian-health.
Brand: teal.
About: Healthcare analytics for hospital systems.
Story: Cuts manual reporting by 80%.
Stats: placeholder for now.
Assets: none yet — use Unsplash placeholders.
```

Claude will generate a complete filled-in PRD for you to review before building.

### 2. Get your photos

You need at least a hero image before the demo looks real. Two options:

**Option A — Unsplash (fast, dev only)**

Find a photo on [unsplash.com](https://unsplash.com), grab the ID from the URL:

```
https://unsplash.com/photos/3Mhgvrk4tjM
                              ↑ this is the photo ID
```

Use it in `page.tsx` as a placeholder:

```ts
import { placeholderImg } from "@/lib/images"
placeholderImg("3Mhgvrk4tjM", 1600, 700)
```

**Must be replaced before delivery.** Run `grep -r "placeholderImg" src/` — must return nothing.

**Option B — Nano Banana (real assets)**

Download images from nano banana manually, then drop them flat into:

```
public/
  images/
    hero.jpg
    feature-1.jpg
    feature-2.jpg
```

Reference them in your section files:

```ts
import { localClientImg } from "@/lib/images"
localClientImg("client-slug", "hero.jpg")
// → "/images/hero.jpg"
```

### 3. Build the demo

With the PRD filled and assets in place, prompt Claude:

```
PRD is filled. Assets are in public/images/. Build the demo.
```

Claude will update `globals.css` (brand tokens), `layout.tsx` (metadata), create section
files in `src/app/_sections/`, and wire them in `page.tsx`.

### 4. Iterate

Make changes with targeted prompts — describe what changes, not what stays:

```
Change the hero heading to "Cut reporting time by 80%". Keep everything else.
```

```
Replace the FeatureGrid with a second FeatureRow on their AI assistant feature, image right.
```

### 5. Deliver

```bash
npm run validate
grep -r "placeholderImg" src/   # must be empty
grep -r "TODO" src/             # review all flagged placeholders
```

Visual check before sending the preview URL:

- Brand color looks right in light mode
- No cramped sections — whitespace should feel generous
- CTA banner is the last section
- Navbar shows the client name

---

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Per-Client Customization

Never edit `src/components/`. These paths change per client:

### `src/app/globals.css` — brand tokens

```css
:root {
  --brand: oklch(L C H); /* client brand color */
  --brand-foreground: oklch(0.985 0 0);
  --background: oklch(0.985 0.002 H); /* H: ~90 warm, ~0 neutral, ~250 cool */
  --radius: 0.625rem; /* 0.25rem square → 1rem rounded */
}
```

Common brand colors in OKLCH:

| Color  | OKLCH                  | Color  | OKLCH                  |
| ------ | ---------------------- | ------ | ---------------------- |
| Indigo | `oklch(0.55 0.22 265)` | Green  | `oklch(0.55 0.16 155)` |
| Blue   | `oklch(0.55 0.18 240)` | Orange | `oklch(0.62 0.18 55)`  |
| Teal   | `oklch(0.58 0.14 185)` | Purple | `oklch(0.52 0.22 300)` |
| Red    | `oklch(0.55 0.20 25)`  | Pink   | `oklch(0.60 0.20 340)` |

Update both `:root` and `.dark` — dark mode uses ~+0.07 lightness for the same hue.

### `src/app/layout.tsx` — metadata and fonts

```ts
export const metadata = {
  title: "Client Name — Demo",
  description: "One sentence about what this demo shows.",
}
```

Swap `Libre_Baskerville` for the client's serif if their brand specifies one.

### `src/app/_sections/*.tsx` — one file per section

All content (copy, stats, image paths, labels) lives inline in the section file that renders it.
Create one file per section: `hero.tsx`, `stats.tsx`, `features.tsx`, `testimonials.tsx`, `cta.tsx`.

### `src/app/page.tsx` — composition only

Imports and renders the section components. No strings or data here.

---

## Section Components — `src/components/common/`

| Component                      | Use for                                     |
| ------------------------------ | ------------------------------------------- |
| `HeroSection`                  | Page opener — always first after Navbar     |
| `FeatureRow`                   | Image + text deep-dive, alternate `reverse` |
| `StatGrid` / `StatItem`        | Key metrics — no card container             |
| `FeatureGrid` / `FeatureItem`  | Icon + heading + description grid           |
| `TestimonialCard`              | Pull-quotes with author attribution         |
| `CtaBanner`                    | Closing CTA — always last section           |
| `ImageCard`                    | Case studies, resources (16:9 image top)    |
| `Navbar`                       | Sticky top nav, start / center / end slots  |
| `DashboardGrid`                | Responsive widget/card grid                 |
| `EmptyState`                   | Empty list or table placeholder             |
| `PageContainer` / `PageHeader` | Inner-page shell and title block            |

UI primitives (`Button`, `Card`, `Input`, `Badge`, etc.) live in `src/components/ui/`.

---

## Scripts

```bash
npm run dev           # dev server
npm run build         # production build
npm run validate      # typecheck + lint + format check (run before delivery)
npm run lint          # ESLint
npm run format        # Prettier (write)
npm run typecheck     # TypeScript
```
