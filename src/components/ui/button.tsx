import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button Component
 * @see DESIGN_SYSTEM.md#Buttons
 *
 * UDS specs:
 * - Base: rounded-md (8px), text-sm, font-medium, transition-all
 * - Focus: focus-visible:ring-1 focus-visible:ring-ring
 * - Variants: default, secondary, outline, ghost, link, destructive, brand
 * - Sizes: sm (h-8), default (h-9), lg (h-10), icon (h-9 w-9), icon-sm, icon-lg
 */
const buttonVariants = cva(
  "focus-visible:ring-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 ease-out focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border-input bg-background hover:bg-accent hover:text-foreground border",
        ghost: "hover:bg-accent hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30 shadow-sm",
        brand:
          "bg-brand text-brand-foreground shadow-brand/30 hover:bg-brand/90 rounded-full shadow-lg hover:scale-[1.02]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
