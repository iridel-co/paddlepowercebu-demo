"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Table Component
 * @see DESIGN_SYSTEM.md#Tables/Data Lists
 *
 * UDS specs:
 * - Header cells: text-xs uppercase tracking-[0.06em] text-muted-foreground
 * - Cell padding: px-3 py-2
 * - Row hover: hover:bg-muted/40
 * - Zebra striping: even:bg-muted/40 (optional via className)
 * - Selection uses ring token
 */

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="bg-card w-full overflow-auto rounded-lg border"
    >
      <table
        data-slot="table"
        className={cn(
          "text-foreground w-full border-collapse text-sm",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("border-border/60 border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("divide-border/60 divide-y", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/40 focus-within:ring-ring transition-colors focus-within:ring-1",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      // UDS: Header cells use text-xs uppercase tracking-[0.06em] text-muted-foreground
      className={cn(
        "text-muted-foreground px-3 py-2 text-left text-xs font-medium tracking-[0.06em] uppercase",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("text-foreground px-3 py-2 align-middle", className)}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-2 text-left text-xs", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
