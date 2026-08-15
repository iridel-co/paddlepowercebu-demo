import type { Metadata } from "next"

import { APP_CONFIG } from "@/config/app.config"

type PageMetadataInput = {
  title: string
  description: string
  /** Route path, leading slash included, e.g. "/" or "/memberships". */
  pathname: string
  /** Falls back to the shared card when a route has no image of its own. */
  ogImageUrl?: string
}

/**
 * Per-route metadata: the canonical URL plus the title, description, and
 * social card overrides for one page.
 *
 * Robots directives are not repeated here — those are set once in the root
 * layout and inherited, so indexing stays a single decision.
 */
export function generatePageMetadata({
  title,
  description,
  pathname,
  ogImageUrl = APP_CONFIG.ogImage,
}: PageMetadataInput): Metadata {
  const url = new URL(pathname, APP_CONFIG.url).toString()

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      url,
      siteName: APP_CONFIG.shortName,
      title,
      description,
      locale: "en_PH",
      images: [
        {
          url: ogImageUrl,
          type: "image/png",
          width: 1200,
          height: 630,
          alt: `${APP_CONFIG.shortName} — premium indoor pickleball courts in Talisay, Cebu`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  }
}
