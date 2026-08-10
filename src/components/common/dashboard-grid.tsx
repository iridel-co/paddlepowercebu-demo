import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * DashboardGrid Component
 * @see DESIGN_SYSTEM.md#Layout & Structure
 *
 * UDS specs:
 * - Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
 * - Mobile-first responsive columns
 * - Default gap: 24px (gap-6)
 */

export interface DashboardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Responsive column configuration */
  cols?: {
    base?: 1 | 2 | 3 | 4
    md?: 1 | 2 | 3 | 4
    lg?: 1 | 2 | 3 | 4
  }
}

const colsMap = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
} as const

const DashboardGrid = React.forwardRef<HTMLDivElement, DashboardGridProps>(
  ({ className, cols = { base: 1, md: 2, lg: 3 }, ...props }, ref) => {
    const base = cols.base ?? 1
    const md = cols.md ?? base
    const lg = cols.lg ?? md

    return (
      <div
        ref={ref}
        data-slot="dashboard-grid"
        className={cn(
          "grid gap-6",
          colsMap[base],
          `md:${colsMap[md]}`,
          `lg:${colsMap[lg]}`,
          className
        )}
        {...props}
      />
    )
  }
)
DashboardGrid.displayName = "DashboardGrid"

export { DashboardGrid }
