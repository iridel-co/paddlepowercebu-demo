import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * StatGrid + StatItem Components
 * @see DESIGN_SYSTEM.md#Layout & Structure — Section Patterns
 *
 * Raw typographic metric display — intentionally NO card container.
 * Numbers breathe directly on the page to avoid card overuse.
 *
 * UDS specs:
 * - Value: text-5xl font-bold tracking-tight (font-serif optional)
 * - Trend: small inline text using status tokens (success/destructive/muted)
 * - Label: text-xs uppercase tracking-[0.06em] text-muted-foreground
 * - Grid: 2 cols mobile → 4 cols desktop
 * - divided: adds vertical dividers between items (use only when count = 4)
 */

export interface StatItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The primary metric value, e.g. "2,400+" or "$1.2B" */
  value: string
  /** Descriptive label below the value */
  label: string
  /** Short trend text, e.g. "+18% YoY" */
  trend?: string
  /** Controls the color of the trend text */
  trendDirection?: "up" | "down" | "neutral"
  /** Use font-serif for the value — good for financial / premium contexts */
  serif?: boolean
}

const trendColorMap: Record<
  NonNullable<StatItemProps["trendDirection"]>,
  string
> = {
  up: "text-success",
  down: "text-destructive",
  neutral: "text-muted-foreground",
}

const StatItem = React.forwardRef<HTMLDivElement, StatItemProps>(
  (
    {
      value,
      label,
      trend,
      trendDirection = "neutral",
      serif = false,
      className,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      data-slot="stat-item"
      className={cn("space-y-1", className)}
      {...props}
    >
      <div className="flex items-baseline gap-2">
        <p
          className={cn(
            "text-foreground text-5xl font-bold tracking-tight",
            serif && "font-serif"
          )}
        >
          {value}
        </p>
        {trend && (
          <span
            className={cn("text-sm font-medium", trendColorMap[trendDirection])}
          >
            {trend}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-xs tracking-[0.06em] uppercase">
        {label}
      </p>
    </div>
  )
)
StatItem.displayName = "StatItem"

export interface StatGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Adds vertical dividers between stat items.
   * Best used when there are exactly 4 stats (fills the lg:grid-cols-4 grid).
   */
  divided?: boolean
}

const StatGrid = React.forwardRef<HTMLDivElement, StatGridProps>(
  ({ divided = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="stat-grid"
      className={cn(
        "grid grid-cols-2 gap-8 lg:grid-cols-4",
        divided &&
          "lg:divide-border lg:divide-x [&>*:not(:first-child)]:lg:pl-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
StatGrid.displayName = "StatGrid"

export { StatGrid, StatItem }
