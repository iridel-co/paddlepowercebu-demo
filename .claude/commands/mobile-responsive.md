# Mobile Responsiveness — Iridel Demo Template

You are enforcing mobile-first responsive design across every component and page in this
Next.js + Tailwind CSS project. Apply these rules uniformly — no component is exempt.

---

## Breakpoint system (Tailwind defaults — never customize these)

| Prefix | Min-width | Target              |
| ------ | --------- | ------------------- |
| (none) | 0px       | Mobile — always the base |
| `sm:`  | 640px     | Large phones / small tablets |
| `md:`  | 768px     | Tablets                |
| `lg:`  | 1024px    | Laptops / small desktops |
| `xl:`  | 1280px    | Large desktops         |

**Mobile-first always.** Write the mobile style first, then override at larger breakpoints.
Never write desktop-only styles and forget mobile.

---

## Typography scaling

| Role            | Mobile                             | Desktop override             |
| --------------- | ---------------------------------- | ---------------------------- |
| Hero heading    | `text-4xl font-serif tracking-tight` | `lg:text-6xl`              |
| Section heading | `text-2xl font-semibold tracking-tight` | `lg:text-3xl`           |
| Eyebrow         | `text-xs uppercase tracking-[0.08em] text-muted-foreground` | (no change) |
| Body            | `text-base leading-relaxed text-muted-foreground` | (no change)    |
| Caption / label | `text-xs text-muted-foreground`    | (no change)                  |
| Stat value      | `text-3xl font-bold`               | `lg:text-4xl`                |

Rules:
- Never use a fixed large text size without a smaller mobile fallback
- `text-5xl` and above always need a smaller base: `text-3xl lg:text-5xl`
- Prose width: `max-w-2xl` is already responsive — no changes needed

---

## Spacing scaling

| Context              | Mobile        | Desktop override         |
| -------------------- | ------------- | ------------------------ |
| Section vertical pad | `py-12`       | `lg:py-20`               |
| Hero vertical pad    | `py-16`       | `lg:py-28`               |
| CTA banner pad       | `py-16`       | `lg:py-24`               |
| Inner content groups | `space-y-4`   | `lg:space-y-8`           |
| Section header block | `space-y-3`   | (no change)              |
| Container horizontal | `px-4`        | `sm:px-6 lg:px-8`        |

---

## Layout patterns

### Page container

```tsx
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
```

### Two-column feature row

```tsx
// Mobile: stacked. Desktop: side-by-side
<div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16 items-center">
```

Reverse variant: use `lg:order-last` on the image column — never swap DOM order.

### Stat grid

```tsx
// Mobile: 1 or 2 col. Desktop: match stat count
<div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
```
For 3 stats: `grid-cols-1 sm:grid-cols-3`

### Feature grid (capability list)

```tsx
// Mobile: 1 col. Tablet: 2 col. Desktop: 3 col
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
```

### Testimonials

```tsx
// Mobile: 1 col. Desktop: 3 col
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
```

### Product / card grids

```tsx
// Mobile: 2 col (not 1 — matches how users browse on phones). Desktop: 3 or 4 col
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
```

### Dashboard / data grids

```tsx
// Mobile: 1 col. Desktop: configurable
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
```

---

## Hero section

- Text block: full width on mobile, `lg:max-w-xl` when beside an image
- Image: `aspect-[4/3]` on mobile (stacked below text), `aspect-[16/9]` on desktop
- Button group: `flex flex-col sm:flex-row gap-3` — stack on mobile, row on tablet+
- Background image if used: `object-cover` with `fill`, parent `relative min-h-[400px] lg:min-h-[560px]`

---

## Image sizes prop

Match `sizes` to actual rendered width — wrong values cause bad requests on DPR change:

```tsx
sizes="100vw"                                               // full-width hero
sizes="(max-width: 1024px) 100vw, 50vw"                    // half-width beside text
sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" // card thumbnail
```

A `col-span-2` tile in a 3-col grid is `66vw`, not `33vw`. Compute from actual CSS layout.

---

## Buttons and CTAs

- Full width on mobile by default for primary actions: `w-full sm:w-auto`
- Icon + label: keep both visible at all sizes — never icon-only CTAs in marketing
- Never use fixed `px-` values that cause overflow on small screens

---

## Tables (data / dashboard)

Tables overflow on mobile. Always wrap:

```tsx
<div className="overflow-x-auto rounded-lg">
  <table className="min-w-full">...</table>
</div>
```

For very small screens, consider switching to a card/list view below `md:`.

---

## Form layouts

```tsx
// Fields: single column on mobile, two-column on desktop
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

Submit button: `w-full sm:w-auto` — full width on mobile.

---

## Touch targets

- Minimum tap target: `min-h-[44px] min-w-[44px]` on interactive elements
- Increase padding on mobile nav items: `py-3 px-4` minimum
- No hover-only interactions — use `focus-visible:` for keyboard, rely on tap for mobile

---

## Anti-patterns — reject immediately

- Fixed pixel widths (`w-[400px]`) without responsive overrides
- `flex` rows with no `flex-wrap` that overflow on mobile
- `grid-cols-3` or higher without a mobile fallback (`grid-cols-1`)
- Text larger than `text-4xl` without a smaller base size
- `overflow-hidden` on the `<body>` or page container (breaks scrolling)
- Absolute positioning that causes content overlap on small screens
- `gap-16` or larger gaps without a smaller mobile gap
- Horizontal padding less than `px-4` on any container
- Invisible content on mobile due to `hidden` without a `sm:block` or `md:block` restore
- `max-[Npx]:` custom breakpoints — always write mobile-first with standard breakpoints
- Large gap/padding set at base with `max-[...]` overrides — write `gap-4 lg:gap-8` instead
- `order-2 max-[Npx]:order-0` for column reversal — use `lg:order-last` on desktop, no order class on mobile
- `position: fixed` inside a `backdrop-filter` element — it creates a new containing block so the fixed child covers only that element, not the viewport. Render overlays as siblings outside any element with `backdrop-filter`

---

## Audit checklist (run before marking responsive work done)

- [ ] Tested at 375px (iPhone SE), 390px (iPhone 14), 768px (iPad), 1280px (desktop)
- [ ] No horizontal scroll at any breakpoint
- [ ] All text readable without zooming at 375px
- [ ] All tap targets ≥ 44px
- [ ] Navbar collapses correctly on mobile
- [ ] Images have correct `sizes` prop
- [ ] No fixed-width elements causing overflow
- [ ] Grids collapse to single column on mobile
- [ ] Buttons stack vertically on mobile where needed
- [ ] Hero image aspect ratio correct on mobile
