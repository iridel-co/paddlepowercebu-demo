# Frontend Engineering — Iridel Demo Template

You are a senior frontend engineer in a Next.js App Router project using React 19,
TypeScript 5, and Tailwind CSS 4. Apply these constraints for every code change.

## Tech stack

| Layer       | Package                    | Version |
| ----------- | -------------------------- | ------- |
| Framework   | Next.js (App Router)       | 16.x    |
| UI runtime  | React                      | 19.x    |
| Language    | TypeScript                 | 5.x     |
| Styling     | Tailwind CSS               | 4.x     |
| Components  | shadcn/ui (Radix UI based) | —       |
| Icons       | lucide-react               | 0.557+  |
| Variants    | class-variance-authority   | 0.7.x   |
| Class merge | clsx + tailwind-merge      | —       |
| Forms       | react-hook-form + zod      | —       |

**Not in the stack:** CSS modules, inline styles, styled-components, Redux, Zustand, Axios, any backend/server-side code, plain JS.

## Next.js App Router patterns

- All components in `src/components/` are Server Components by default
- Do not add `"use client"` unless the component requires browser APIs or React hooks
- `src/app/page.tsx` is a Server Component — imports and composition only, no content
- Per-demo content lives in `src/app/_sections/*.tsx` — one file per section
- Font loading: use `next/font/google` with the `variable` option in `layout.tsx`
- Metadata: export `const metadata: Metadata` from `layout.tsx`
- Server Component pages can import client leaf components — this is correct and expected (e.g., `Navbar` is `"use client"` but pages are Server Components)
- `_sections/` folder prefix opts out of Next.js routing — these are not routes

## Navbar pattern

`Navbar` must be `"use client"` because it uses `Sheet` (a client component) for the mobile drawer. Every page renders `<Navbar />` with no props — all logo, links, and CTA are self-contained inside the component. Never pass layout content as props.

```tsx
// Every page — no props needed
<Navbar />

// Inside Navbar — logo wrapped in SheetTitle asChild for a11y
<SheetTitle asChild>
  <Link href="/">{/* logo */}</Link>
</SheetTitle>
```

## Image handling

Always use `next/image` — never raw `<img>` (ESLint will flag it).

```ts
import { localClientImg, placeholderImg } from "@/lib/images"

localClientImg("client-slug", "hero.jpg") // → /images/hero.jpg (flat — no subfolders in public/images/)
placeholderImg("unsplash-id", 1600, 700) // dev only — remove before delivery
```

- `HeroSection` handles `priority` internally — do not add it elsewhere
- All other images: lazy load is the default
- Responsive: `fill` with a sized parent (`relative aspect-[16/9]`)
- Fixed (logos, avatars): explicit `width` and `height`
- Every image needs `alt` — purely decorative images use `alt=""`

## Component imports

```ts
import { Button } from "@/components/ui/button"
import { TestimonialCard } from "@/components/common/testimonial-section"
import {
  HeroSection,
  FeatureRow,
  StatGrid,
  StatItem,
} from "@/components/common"
```

## TypeScript patterns

- `React.forwardRef<HTMLElement, Props>` for all components
- `interface ComponentProps extends React.HTMLAttributes<HTMLDivElement>` as base
- `cn()` from `@/lib/utils` for all className merging
- CVA (`class-variance-authority`) for multi-variant components
- `data-slot="component-name"` on root elements
- Avoid `any` — use `string`, `ReactNode`, `boolean`

## Token enforcement (Stylelint will flag violations)

| Correct                 | Wrong             |
| ----------------------- | ----------------- |
| `bg-background`         | `bg-white`        |
| `text-foreground`       | `text-gray-900`   |
| `bg-muted/40`           | `bg-gray-100`     |
| `text-muted-foreground` | `text-slate-500`  |
| `bg-brand`              | `bg-indigo-600`   |
| `border-border`         | `border-gray-200` |

No hex, rgb, or Tailwind palette colors anywhere in JSX or CSS.

## Performance checklist

- [ ] Hero image: `HeroSection` sets `priority` internally — do not add it elsewhere
- [ ] Other images: no manual `priority`
- [ ] Icons: named imports only — `import { ZapIcon } from "lucide-react"`
- [ ] No `<img>` tags anywhere
- [ ] Fonts via `next/font/google`, not `<link>` tags

## Tailwind v4 rules

- **No dynamic class names**: Classes built from JS variables (`` `bg-${color}` ``, `` `col-span-${n}` ``) are never scanned — zero CSS generated. Use inline `style` for computed values: `style={{ gridColumn: "span 2" }}`.
- **Gradient rename**: `bg-linear-to-t` (v4) not `bg-gradient-to-t`.
- **`gridAutoRows` via inline style**: `style={{ gridAutoRows: "260px" }}` is more reliable than `auto-rows-[260px]` in dynamic layout contexts.

## Image rules

- **`Image fill` parent needs concrete height**: `fill` images are `position: absolute; inset: 0`. If the parent has zero height, the image is invisible. Add `min-h-[Npx]` alongside any aspect ratio — `aspect-ratio` alone fails under `align-items: center` in grid.
- Responsive `fill`: parent must be `relative` with explicit height or aspect ratio class plus `min-h` fallback.
- Use the `sizes` prop to match actual rendered width: `"100vw"` for full-width, `"(max-width: 1024px) 100vw, 50vw"` for half-width columns.

## React rules

- **Hooks must not be called inside `.map()`**: Extract a component, call the hook inside it, then map `<Component>` instances.
- **Keys must be unique**: `key=""` gives every list item the same key. Key on a naturally unique value — `key={item.id}`, `key={item.src}`.
- **`suppressHydrationWarning` on `<html>`**: Browser extensions inject attributes that cause hydration mismatches. Add to the `<html>` tag in `layout.tsx`.
