import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Navbar Component
 * @see DESIGN_SYSTEM.md#Navigation
 *
 * UDS specs:
 * - Height: 64px (h-16)
 * - Sticky with backdrop-blur on scroll
 * - Border-bottom with border-border token
 * - Padding: px-4
 */

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  /** Content for the left section (logo, brand) */
  start?: React.ReactNode
  /** Content for the center section (navigation links) */
  center?: React.ReactNode
  /** Content for the right section (user menu, actions) */
  end?: React.ReactNode
}

const Navbar = React.forwardRef<HTMLElement, NavbarProps>(
  ({ start, center, end, className, ...props }, ref) => (
    <nav
      ref={ref}
      data-slot="navbar"
      aria-label="Main navigation"
      className={cn(
        "border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 flex h-16 w-full items-center gap-4 border-b px-4 backdrop-blur",
        className
      )}
      {...props}
    >
      <div className="flex flex-1 items-center gap-3">{start}</div>
      {center && (
        <div className="hidden flex-1 justify-center md:flex">{center}</div>
      )}
      <div className="flex flex-1 items-center justify-end gap-3">{end}</div>
    </nav>
  )
)
Navbar.displayName = "Navbar"

export { Navbar }
