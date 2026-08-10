import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * CtaBanner Component
 * @see DESIGN_SYSTEM.md#Layout & Structure — Section Patterns
 *
 * High-visual-weight call-to-action section. Use once per page as the final
 * section before the footer.
 *
 * UDS specs:
 * - variant="brand": bg-brand text-brand-foreground (strong close)
 * - variant="muted": bg-muted (soft close)
 * - variant="bordered": bg-background border-y (minimal close)
 * - Inner content centered, max-w-3xl
 * - Heading: text-3xl lg:text-4xl font-bold tracking-tight
 */

const ctaBannerVariants = cva("w-full py-24", {
  variants: {
    variant: {
      brand: "bg-brand",
      muted: "bg-muted",
      bordered: "bg-background border-border border-y",
    },
  },
  defaultVariants: {
    variant: "brand",
  },
})

export interface CtaBannerProps
  extends
    React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof ctaBannerVariants> {
  /** Small uppercase label above the heading */
  eyebrow?: string
  /** Main CTA heading */
  heading: string
  /** Supporting subtext */
  subtext?: string
  /** CTA buttons */
  actions?: React.ReactNode
}

const CtaBanner = React.forwardRef<HTMLElement, CtaBannerProps>(
  (
    { variant, eyebrow, heading, subtext, actions, className, ...props },
    ref
  ) => {
    const isBrand = variant === "brand"

    return (
      <section
        ref={ref}
        data-slot="cta-banner"
        className={cn(ctaBannerVariants({ variant }), className)}
        {...props}
      >
        <div className="container mx-auto max-w-7xl px-4">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            {eyebrow && (
              <p
                className={cn(
                  "text-xs tracking-[0.08em] uppercase",
                  isBrand ? "text-brand-foreground/70" : "text-muted-foreground"
                )}
              >
                {eyebrow}
              </p>
            )}

            <h2
              className={cn(
                "text-3xl font-bold tracking-tight lg:text-4xl",
                isBrand ? "text-brand-foreground" : "text-foreground"
              )}
            >
              {heading}
            </h2>

            {subtext && (
              <p
                className={cn(
                  "text-lg leading-relaxed",
                  isBrand ? "text-brand-foreground/80" : "text-muted-foreground"
                )}
              >
                {subtext}
              </p>
            )}

            {actions && (
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {actions}
              </div>
            )}
          </div>
        </div>
      </section>
    )
  }
)
CtaBanner.displayName = "CtaBanner"

export { CtaBanner, ctaBannerVariants }
