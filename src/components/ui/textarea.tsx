import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Textarea Component
 * @see DESIGN_SYSTEM.md#Inputs
 *
 * UDS specs:
 * - Base: rounded-md border border-input bg-background px-3 text-sm shadow-sm
 * - Min height: min-h-[120px]
 * - Padding: py-2 px-3
 * - Focus: focus-visible:ring-1 focus-visible:ring-ring
 * - Placeholder: placeholder:text-muted-foreground
 */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          "border-input bg-background placeholder:text-muted-foreground min-h-[120px] w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors",
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
Textarea.displayName = "Textarea"

export { Textarea }
