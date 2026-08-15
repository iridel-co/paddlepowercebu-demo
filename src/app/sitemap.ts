import type { MetadataRoute } from "next"

import { APP_CONFIG, IS_INDEXABLE } from "@/config/app.config"

/**
 * The one real route. `/ball-3d` and `/paddle-3d` are review harnesses that
 * exist to feed `tools/export-renders.mjs`, so they stay out of here and carry
 * their own noindex.
 *
 * Empty on preview deploys, matching the blanket disallow in `robots.ts`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!IS_INDEXABLE) return []

  return [
    {
      url: APP_CONFIG.url,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
