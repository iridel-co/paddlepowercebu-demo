import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * FeatureRow Component
 * @see DESIGN_SYSTEM.md#Layout & Structure — Section Patterns
 *
 * Image + text side-by-side layout. Alternate `reverse` on consecutive rows
 * for visual balance — never use two non-reversed FeatureRows back to back.
 *
 * UDS specs:
 * - Two-column lg:grid-cols-2 grid; single column on mobile (stacked)
 * - Image uses aspect-[4/3] container with Next.js Image fill + object-cover
 * - Lazy loading on image (not above the fold — no priority prop)
 * - Content column: eyebrow, h2 text-3xl font-semibold, body text-muted-foreground
 */

export interface FeatureRowProps extends React.HTMLAttributes<HTMLElement> {
  /** Small uppercase label above the heading */
  eyebrow?: string
  /** Section heading */
  heading: string
  /** Body paragraph */
  body: string
  /** Optional CTA button or link */
  action?: React.ReactNode
  /** Image source URL — use nbClientImg() or placeholderImg() */
  imageSrc: string
  /** Alt text for the image */
  imageAlt: string
  /** When true, image appears on the right and content on the left */
  reverse?: boolean
}

const FeatureRow = React.forwardRef<HTMLElement, FeatureRowProps>(
  (
    {
      eyebrow,
      heading,
      body,
      action,
      imageSrc,
      imageAlt,
      reverse = false,
      className,
      ...props
    },
    ref
  ) => (
    <section
      ref={ref}
      data-slot="feature-row"
      className={cn("container mx-auto max-w-7xl px-4 py-16", className)}
      {...props}
    >
      <div
        className={cn(
          "grid grid-cols-1 items-center gap-12 lg:grid-cols-2",
          reverse && "lg:[&>*:first-child]:order-last"
        )}
      >
        {/* Image column */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        </div>

        {/* Content column */}
        <div className="space-y-5">
          {eyebrow && (
            <p className="text-muted-foreground text-xs tracking-[0.08em] uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="text-foreground text-3xl font-semibold tracking-tight">
            {heading}
          </h2>
          <p className="text-muted-foreground leading-relaxed">{body}</p>
          {action && <div className="pt-2">{action}</div>}
        </div>
      </div>
    </section>
  )
)
FeatureRow.displayName = "FeatureRow"

export { FeatureRow }
