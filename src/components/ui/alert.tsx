import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  InfoIcon,
  AlertTriangleIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Alert Component
 * @see DESIGN_SYSTEM.md#Toasts & Alerts
 *
 * UDS specs:
 * - Base: rounded-lg border-l-4 p-4 flex gap-3
 * - Variants: default, success, warning, destructive, info
 * - Status-colored left border
 * - Include title + body text
 */
const alertVariants = cva(
  "relative flex gap-3 rounded-lg border-l-4 p-4 [&>svg]:size-5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-l-border bg-muted/40 text-foreground",
        success:
          "border-l-success bg-success/10 text-success [&>svg]:text-success",
        warning:
          "border-l-warning bg-warning/10 text-warning-foreground [&>svg]:text-warning",
        destructive:
          "border-l-destructive bg-destructive/10 text-destructive [&>svg]:text-destructive",
        info: "border-l-info bg-info/10 text-info [&>svg]:text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const alertIcons = {
  default: InfoIcon,
  success: CheckCircle2Icon,
  warning: AlertTriangleIcon,
  destructive: AlertCircleIcon,
  info: InfoIcon,
} as const

export interface AlertProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  showIcon?: boolean
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    { className, variant = "default", showIcon = true, children, ...props },
    ref
  ) => {
    const Icon = alertIcons[variant ?? "default"]

    return (
      <div
        ref={ref}
        role="alert"
        data-slot="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {showIcon && <Icon className="mt-0.5" />}
        <div className="flex-1 space-y-1">{children}</div>
      </div>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    data-slot="alert-title"
    className={cn("text-sm leading-none font-semibold", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="alert-description"
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription, alertVariants }
