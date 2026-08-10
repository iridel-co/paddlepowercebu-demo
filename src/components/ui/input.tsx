import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Input Component
 * @see DESIGN_SYSTEM.md#Inputs
 *
 * UDS specs:
 * - Base: h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm
 * - Placeholder: placeholder:text-muted-foreground
 * - Focus: focus-visible:ring-1 focus-visible:ring-ring
 * - Disabled: disabled:opacity-50 disabled:cursor-not-allowed
 */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-sm transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
