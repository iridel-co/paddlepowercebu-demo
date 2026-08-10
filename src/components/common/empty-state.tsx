import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * EmptyState Component
 * @see DESIGN_SYSTEM.md#Tables/Data Lists
 *
 * UDS specs:
 * - Container: rounded-xl bg-muted/40 p-8 (no border — bg-muted/40 provides visual containment)
 * - Icon: size-10, text-muted-foreground
 * - Title: text-sm font-semibold
 * - Description: text-sm text-muted-foreground
 * - Primary action button
 */

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon element to display (use Lucide icons at size-10) */
  icon?: React.ReactNode
  /** Title text */
  title: string
  /** Optional description text */
  description?: string
  /** Optional action element (typically a Button) */
  action?: React.ReactNode
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="empty-state"
      className={cn(
        "bg-muted/40 flex flex-col items-center justify-center rounded-xl p-8 text-center",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="text-muted-foreground mb-4 [&_svg]:size-10">{icon}</div>
      )}
      <h3 className="text-foreground text-sm font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
)
EmptyState.displayName = "EmptyState"

export { EmptyState }
