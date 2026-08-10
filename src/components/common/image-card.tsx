import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * ImageCard Component
 * @see DESIGN_SYSTEM.md#Cards
 *
 * Card with a top image area followed by text content below.
 * Distinct from the bare Card primitive — use when visual imagery is central.
 *
 * UDS specs:
 * - Full card: rounded-xl overflow-hidden shadow-sm (no border — shadow-sm provides depth)
 * - Image area: aspect-[16/9] with Next.js Image fill + object-cover
 * - Content: bg-card p-5 space-y-2
 * - Eyebrow: text-xs uppercase tracking-[0.06em] text-muted-foreground
 * - Title: text-base font-semibold
 * - Description: text-sm text-muted-foreground
 */

export interface ImageCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Image src — use nbClientImg() or placeholderImg() */
  imageSrc: string
  /** Alt text for the image */
  imageAlt: string
  /** Small uppercase label above the title */
  eyebrow?: string
  /** Card title */
  title: string
  /** Short description */
  description?: string
  /** Optional CTA button or link */
  action?: React.ReactNode
}

const ImageCard = React.forwardRef<HTMLDivElement, ImageCardProps>(
  (
    {
      imageSrc,
      imageAlt,
      eyebrow,
      title,
      description,
      action,
      className,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      data-slot="image-card"
      className={cn("bg-card overflow-hidden rounded-xl shadow-sm", className)}
      {...props}
    >
      {/* Image area */}
      <div className="relative aspect-[16/9] overflow-hidden">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          className="object-cover transition-transform duration-300 hover:scale-[1.02]"
          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
        />
      </div>

      {/* Content */}
      <div className="space-y-2 p-5">
        {eyebrow && (
          <p className="text-muted-foreground text-xs tracking-[0.06em] uppercase">
            {eyebrow}
          </p>
        )}
        <h3 className="text-foreground text-base font-semibold">{title}</h3>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  )
)
ImageCard.displayName = "ImageCard"

export { ImageCard }
