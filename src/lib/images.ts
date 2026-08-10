/**
 * Nano Banana CDN image helpers
 *
 * IMPORTANT: Replace "assets.nanobanana.io" with the actual CDN hostname once
 * confirmed, then update the `hostname` entry in `next.config.ts` to match.
 *
 * @see docs/image-handling.md
 * @see next.config.ts — remotePatterns
 */

const NANO_BANANA_BASE = "https://assets.nanobanana.io"

/**
 * Build a fully-qualified nano banana CDN URL.
 *
 * @param path   - Path relative to CDN root, e.g. "/global/hero.jpg"
 * @param params - Optional query params (width, quality, format transforms, etc.)
 *
 * @example
 * nbImg("/global/team-photo.jpg", { w: "1200", q: "80" })
 * // → "https://assets.nanobanana.io/global/team-photo.jpg?w=1200&q=80"
 */
export function nbImg(path: string, params?: Record<string, string>): string {
  const url = new URL(path, NANO_BANANA_BASE)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return url.toString()
}

/**
 * Shorthand for per-client asset directories on the CDN.
 *
 * @param clientSlug - Kebab-case client identifier, e.g. "acme-corp"
 * @param filename   - File name including extension, e.g. "hero.jpg"
 *
 * @example
 * nbClientImg("acme-corp", "hero.jpg")
 * // → "https://assets.nanobanana.io/clients/acme-corp/hero.jpg"
 */
export function nbClientImg(clientSlug: string, filename: string): string {
  return nbImg(`/clients/${clientSlug}/${filename}`)
}

/**
 * Local image for this demo, stored flat in `public/images/` — no subfolders.
 *
 * Drop all externally sourced images directly into `public/images/`.
 * Next.js serves `public/` at the root, so no CDN or remotePatterns config needed.
 *
 * @param clientSlug - Kebab-case client identifier (kept for documentation, unused in path)
 * @param filename   - File name including extension, e.g. "hero.jpg"
 *
 * @example
 * localClientImg("acme-corp", "hero.jpg")
 * // → "/images/hero.jpg"
 */
export function localClientImg(clientSlug: string, filename: string): string {
  return `/images/${filename}`
}

/**
 * Unsplash placeholder image for development.
 *
 * Uses a specific Unsplash photo ID so the URL is stable and works with
 * next/image's `remotePatterns` config.
 *
 * ⚠️  Remove all calls to this function before shipping to a real client.
 *     Replace with `localClientImg(slug, filename)` pointing to real assets.
 *
 * @param photoId - Unsplash photo ID (the 11-char string in the photo URL)
 * @param width   - Desired image width in pixels
 * @param height  - Desired image height in pixels
 *
 * @example
 * placeholderImg("3Mhgvrk4tjM", 1600, 600)
 * // → "https://images.unsplash.com/photo-3Mhgvrk4tjM?w=1600&h=600&fit=crop&auto=format"
 */
export function placeholderImg(
  photoId: string,
  width: number,
  height: number
): string {
  return `https://images.unsplash.com/photo-${photoId}?w=${width}&h=${height}&fit=crop&auto=format`
}
