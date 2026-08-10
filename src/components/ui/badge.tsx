import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge/Chip Component
 * @see DESIGN_SYSTEM.md#Badges/Chips
 *
 * UDS specs:
 * - Base: rounded-full px-3 h-7 text-xs font-medium
 * - Variants: default (muted), success, warning, destructive, brand
 */
const badgeVariants = cva(
  "inline-flex h-7 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        info: "bg-info text-info-foreground",
        brand: "bg-brand text-brand-foreground",
        outline: "border-input bg-background text-foreground border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <span
        ref={ref}
        data-slot="badge"
        className={cn(badgeVariants({ variant, className }))}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
