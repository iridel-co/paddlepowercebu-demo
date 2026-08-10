import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * PageContainer Component
 * @see DESIGN_SYSTEM.md#Layout & Structure
 *
 * UDS specs:
 * - Container: max-w-7xl mx-auto
 * - Gutters: px-4
 * - Vertical rhythm: py-8 space-y-8
 */

const PageContainer = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <main
    ref={ref}
    data-slot="page-container"
    className={cn("container mx-auto max-w-7xl space-y-8 px-4 py-8", className)}
    {...props}
  />
))
PageContainer.displayName = "PageContainer"

/**
 * PageHeader Component
 * @see DESIGN_SYSTEM.md#Layout & Structure
 *
 * UDS specs:
 * - Eyebrow: text-xs uppercase tracking-[0.08em] text-muted-foreground
 * - Title: text-3xl font-semibold tracking-tight
 * - Description: text-sm text-muted-foreground max-w-2xl
 * - Spacing: space-y-2
 */
export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Small label above the title */
  eyebrow?: string
  /** Main page title */
  title?: string
  /** Optional description text */
  description?: string
}

const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  ({ eyebrow, title, description, className, children, ...props }, ref) => (
    <header ref={ref} className={cn("space-y-2", className)} {...props}>
      {eyebrow && (
        <p className="text-muted-foreground text-xs tracking-[0.08em] uppercase">
          {eyebrow}
        </p>
      )}
      {title && (
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          {title}
        </h1>
      )}
      {description && (
        <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
      )}
      {children}
    </header>
  )
)
PageHeader.displayName = "PageHeader"

/**
 * PageSection Component
 * @see DESIGN_SYSTEM.md#Layout & Structure
 *
 * UDS specs:
 * - Spacing: space-y-4
 */
const PageSection = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <section
    ref={ref}
    data-slot="page-section"
    className={cn("space-y-4", className)}
    {...props}
  />
))
PageSection.displayName = "PageSection"

export { PageContainer, PageHeader, PageSection }
