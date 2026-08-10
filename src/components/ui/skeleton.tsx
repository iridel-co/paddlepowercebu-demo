import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Skeleton Component
 *
 * Loading placeholder with pulse animation.
 * Respects prefers-reduced-motion.
 */

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="skeleton"
    className={cn(
      "bg-muted animate-pulse rounded-md motion-reduce:animate-none",
      className
    )}
    {...props}
  />
))
Skeleton.displayName = "Skeleton"

export { Skeleton }
