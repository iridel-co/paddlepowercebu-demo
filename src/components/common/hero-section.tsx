import * as React from "react"
import Image from "next/image"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * HeroSection Component
 * @see DESIGN_SYSTEM.md#Layout & Structure — Section Patterns
 *
 * Full-width hero with optional background image, eyebrow label, display
 * heading, subtext, and a CTA actions slot.
 *
 * UDS specs:
 * - No max-width on the outer section; inner content constrained to max-w-7xl
 * - variant="image" renders a Next.js Image fill behind a surface-overlay div
 * - Heading uses font-serif for display typography weight
 * - Always pass `priority` on the image (above the fold)
 */

const heroSectionVariants = cva("relative w-full overflow-hidden", {
  variants: {
    variant: {
      default: "bg-background py-24 lg:py-32",
      image: "py-24 lg:py-32",
      brand: "bg-brand py-24 lg:py-32",
      muted: "bg-muted py-24 lg:py-32",
    },
    align: {
      left: "",
      center: "text-center [&_.hero-actions]:justify-center",
    },
  },
  defaultVariants: {
    variant: "default",
    align: "left",
  },
})

export interface HeroSectionProps
  extends
    React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof heroSectionVariants> {
  /** Small uppercase label above the heading */
  eyebrow?: string
  /** Main display heading — required */
  heading: string
  /** Supporting paragraph below the heading */
  subtext?: string
  /** CTA buttons or other actions rendered below subtext */
  actions?: React.ReactNode
  /**
   * Background image src — only rendered when variant="image".
   * Use `placeholderImg()` in dev; swap to `nbClientImg()` for delivery.
   */
  imageSrc?: string
  /** Alt text for the background image */
  imageAlt?: string
}

const HeroSection = React.forwardRef<HTMLElement, HeroSectionProps>(
  (
    {
      variant,
      align,
      eyebrow,
      heading,
      subtext,
      actions,
      imageSrc,
      imageAlt = "",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const showImage = variant === "image" && imageSrc

    const eyebrowColor =
      variant === "brand" ? "text-brand-foreground/70" : "text-muted-foreground"

    const subtextColor =
      variant === "brand" ? "text-brand-foreground/80" : "text-muted-foreground"

    return (
      <section
        ref={ref}
        data-slot="hero-section"
        className={cn(heroSectionVariants({ variant, align }), className)}
        {...props}
      >
        {/* Background image layer */}
        {showImage && (
          <>
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            <div className="bg-surface-overlay absolute inset-0" />
          </>
        )}

        {/* Content */}
        <div className="relative container mx-auto max-w-7xl px-4">
          <div className="max-w-3xl space-y-6">
            {eyebrow && (
              <p
                className={cn(
                  "text-xs tracking-[0.08em] uppercase",
                  eyebrowColor
                )}
              >
                {eyebrow}
              </p>
            )}

            <h1
              className={cn(
                "font-serif text-5xl font-bold tracking-tight lg:text-6xl",
                variant === "brand" && "text-brand-foreground"
              )}
            >
              {heading}
            </h1>

            {subtext && (
              <p
                className={cn(
                  "max-w-2xl text-lg leading-relaxed",
                  subtextColor
                )}
              >
                {subtext}
              </p>
            )}

            {actions && (
              <div className="hero-actions flex flex-wrap gap-3 pt-2">
                {actions}
              </div>
            )}

            {children}
          </div>
        </div>
      </section>
    )
  }
)
HeroSection.displayName = "HeroSection"

export { HeroSection, heroSectionVariants }
