"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Toast Component
 * @see DESIGN_SYSTEM.md#Toasts & Alerts
 *
 * UDS specs:
 * - Base: rounded-lg border bg-card shadow-lg p-4 flex gap-3
 * - Accent bar using status tokens
 * - Close button with aria-label
 */
const toastVariants = cva(
  "group bg-card pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border-border",
        success: "border-l-success border-l-4",
        warning: "border-l-warning border-l-4",
        destructive: "border-l-destructive border-l-4",
        info: "border-l-info border-l-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ToastProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  onClose?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, onClose, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        data-slot="toast"
        className={cn(toastVariants({ variant }), className)}
        {...props}
      >
        <div className="flex-1 space-y-1">{children}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss toast"
            className="focus-visible:ring-ring shrink-0 rounded-md opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
    )
  }
)
Toast.displayName = "Toast"

const ToastTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    data-slot="toast-title"
    className={cn("text-foreground text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = "ToastTitle"

const ToastDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="toast-description"
    className={cn("text-muted-foreground text-sm", className)}
    {...props}
  />
))
ToastDescription.displayName = "ToastDescription"

/**
 * ToastContainer - a simple container for positioning toasts
 */
const ToastContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left"
  }
>(({ className, position = "bottom-right", ...props }, ref) => {
  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  }

  return (
    <div
      ref={ref}
      data-slot="toast-container"
      className={cn(
        "fixed z-50 flex w-full max-w-sm flex-col gap-2",
        positionClasses[position],
        className
      )}
      {...props}
    />
  )
})
ToastContainer.displayName = "ToastContainer"

export { Toast, ToastTitle, ToastDescription, ToastContainer, toastVariants }
