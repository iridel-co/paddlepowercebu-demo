import * as React from "react"
import { QuoteIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/**
 * TestimonialCard Component
 * @see DESIGN_SYSTEM.md#Layout & Structure — Section Patterns
 *
 * Pull-quote / testimonial with semantic HTML (figure/blockquote/figcaption).
 * Use 3 cards minimum for the grid layout to look intentional.
 *
 * UDS specs:
 * - Semantic: <figure> / <blockquote> / <figcaption>
 * - Quote icon: Lucide QuoteIcon at size-8, text-brand/40
 * - Quote text: text-base leading-relaxed
 * - variant="plain": py-6 (default — spacing only, no container)
 * - variant="card": bg-card rounded-xl border p-8 (opt-in for dashboard contexts)
 * - Author: Avatar + name (text-sm font-semibold) + title (text-xs text-muted-foreground)
 */

export interface TestimonialCardProps extends React.HTMLAttributes<HTMLElement> {
  /** The testimonial quote text (without surrounding quotation marks) */
  quote: string
  /** Author's full name */
  authorName: string
  /** Author's job title and/or company */
  authorTitle?: string
  /** Author avatar image src — use nbClientImg() or placeholderImg() */
  authorImageSrc?: string
  /** Initials fallback when no image is provided, e.g. "SC" */
  authorFallback?: string
  /** Visual style of the card */
  variant?: "card" | "plain"
}

const TestimonialCard = React.forwardRef<HTMLElement, TestimonialCardProps>(
  (
    {
      quote,
      authorName,
      authorTitle,
      authorImageSrc,
      authorFallback,
      variant = "plain",
      className,
      ...props
    },
    ref
  ) => (
    <figure
      ref={ref}
      data-slot="testimonial-card"
      className={cn(
        variant === "card" && "bg-card rounded-xl border p-8",
        variant === "plain" && "py-6",
        "space-y-6",
        className
      )}
      {...props}
    >
      <QuoteIcon className="text-brand/40 size-8" aria-hidden="true" />

      <blockquote className="text-foreground text-base leading-relaxed">
        {quote}
      </blockquote>

      <figcaption className="flex items-center gap-3">
        <Avatar size="md">
          {authorImageSrc && (
            <AvatarImage src={authorImageSrc} alt={authorName} />
          )}
          <AvatarFallback>
            {authorFallback ?? authorName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div>
          <p className="text-foreground text-sm font-semibold">{authorName}</p>
          {authorTitle && (
            <p className="text-muted-foreground text-xs">{authorTitle}</p>
          )}
        </div>
      </figcaption>
    </figure>
  )
)
TestimonialCard.displayName = "TestimonialCard"

export { TestimonialCard }
