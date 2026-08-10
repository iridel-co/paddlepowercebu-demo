import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * FeatureGrid + FeatureItem Components
 * @see DESIGN_SYSTEM.md#Layout & Structure — Section Patterns
 *
 * Icon + heading + description grid. Intentionally NO card containers —
 * the icon badge and typography carry the visual weight.
 *
 * UDS specs:
 * - Grid: 1 col → 2 col md → 3 col lg; gap-8
 * - Icon wrapper: inline-flex rounded-lg p-2.5 with semantic bg/text token pair
 * - Heading: text-base font-semibold
 * - Description: text-sm text-muted-foreground leading-relaxed
 * - Works best with 3, 6, or 9 items (fills the 3-col grid cleanly)
 */

const iconVariantMap = {
  brand: "bg-brand/10 text-brand",
  muted: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
} as const

export interface FeatureItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lucide icon element, e.g. `<ZapIcon />` */
  icon: React.ReactNode
  /** Short feature name */
  heading: string
  /** 1–2 sentence description */
  description: string
  /** Color theme for the icon badge */
  iconVariant?: keyof typeof iconVariantMap
}

const FeatureItem = React.forwardRef<HTMLDivElement, FeatureItemProps>(
  (
    { icon, heading, description, iconVariant = "brand", className, ...props },
    ref
  ) => (
    <div
      ref={ref}
      data-slot="feature-item"
      className={cn("space-y-3", className)}
      {...props}
    >
      <div
        className={cn(
          "inline-flex rounded-lg p-2.5 [&_svg]:size-5",
          iconVariantMap[iconVariant]
        )}
      >
        {icon}
      </div>
      <h3 className="text-foreground text-base font-semibold">{heading}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </div>
  )
)
FeatureItem.displayName = "FeatureItem"

export interface FeatureGridProps extends React.HTMLAttributes<HTMLDivElement> {}

const FeatureGrid = React.forwardRef<HTMLDivElement, FeatureGridProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="feature-grid"
      className={cn(
        "grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
FeatureGrid.displayName = "FeatureGrid"

export { FeatureGrid, FeatureItem }
