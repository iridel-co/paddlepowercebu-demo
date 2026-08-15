import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Paddle Power pill CTA.
 *
 * The design's calls-to-action are fully round anchors. This is per-client UI
 * (`src/app/_ui/`), deliberately kept out of the shared `src/components/`
 * library.
 *
 * Variants map to the three fills in `Paddle Power Cebu.dc.html`:
 * - `lime`    — primary booking CTA. Inverts to ink on hover.
 * - `lime-light` — hero variant of the above, matched to the headline accent.
 * - `ink`     — the header's "Book a Court". Inverts to lime on hover.
 * - `outline` — the secondary branch CTA. Fills to ink on hover.
 */
const VARIANTS = {
  lime: "bg-pp-lime text-pp-ink hover:bg-pp-ink hover:text-pp-cream",
  /** Hero-only: the lifted lime that matches the headline accent. */
  "lime-light": "bg-pp-lime-light text-pp-ink hover:bg-white",
  ink: "bg-pp-ink text-pp-cream hover:bg-pp-lime hover:text-pp-ink",
  outline:
    "border-pp-ink text-pp-ink hover:bg-pp-ink hover:text-pp-cream border-[1.5px]",
  cream:
    "bg-pp-cream/90 text-pp-ink hover:bg-pp-lime border border-pp-ink/10 hover:border-pp-lime",
  /** Outline over imagery/glass — white until it fills. */
  white:
    "border-white/60 text-white hover:bg-white hover:text-pp-ink border-[1.5px] hover:border-white",
} as const

const SIZES = {
  sm: "px-[26px] py-[13px] text-[14px]",
  lg: "px-8 py-4 text-[15px] sm:px-[34px] sm:py-[17px]",
} as const

export interface PillLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
}

export function PillLink({
  variant = "lime",
  size = "sm",
  className,
  ...props
}: PillLinkProps) {
  return (
    <a
      data-slot="pill-link"
      className={cn(
        "focus-visible:ring-pp-olive inline-flex items-center justify-center gap-2 rounded-full font-bold tracking-[0.01em] whitespace-nowrap transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    />
  )
}
