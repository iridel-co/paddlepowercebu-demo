/**
 * Where the site is being served from.
 *
 * Everything absolute in the head — canonical, `og:url`, `og:image` — is built
 * on this, and so is the decision about whether the site is crawlable at all.
 *
 * Resolution order:
 *
 *   1. `NEXT_PUBLIC_BASE_URL`, if someone set it. Always wins.
 *   2. On a Vercel *production* deploy, the project's own production domain.
 *      That is `<project>.vercel.app` until a real domain is attached, and the
 *      real domain afterwards — so pointing paddlepowercebu.com at this project
 *      is all it takes to switch the site on.
 *   3. On a Vercel *preview* deploy, that specific deployment's hostname, so a
 *      branch build advertises its own copy of the OG image rather than one on
 *      a domain that may not be serving this site yet.
 *   4. Local development: the production domain.
 *
 * Step 2 checks `VERCEL_ENV` deliberately. `VERCEL_PROJECT_PRODUCTION_URL` is
 * set on preview builds too, so using it unguarded would let every branch
 * deploy claim to be production — and, through `IS_INDEXABLE`, invite Google
 * in.
 *
 * The Vercel variables are read at build time on the server. `APP_CONFIG` is
 * only ever imported by server code (metadata, robots, sitemap, JSON-LD); if
 * that changes, this needs an explicit `NEXT_PUBLIC_BASE_URL` to keep working
 * in the browser.
 */

const PRODUCTION_ORIGIN = "https://paddlepowercebu.com"

/**
 * Turns whatever was configured into a clean origin, or `null` if it can't be
 * one.
 *
 * This exists because the build used to die here. `metadataBase` calls
 * `new URL()` at module scope, so one malformed value took the whole build
 * down with `TypeError: Invalid URL` — and the easiest way to write a
 * malformed one is to paste a bare hostname, which is exactly the shape
 * Vercel's own variables come in. A missing scheme is a typo, not a reason to
 * fail a deploy, so we add it and move on.
 *
 * Returning the origin rather than the input also drops any trailing slash or
 * stray path, so canonical and `og:url` are always built the same way.
 */
function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const { origin, hostname } = new URL(withScheme)
    /* `https://true` parses perfectly well. Insisting on a dotted host (or
       localhost) catches a value that was never a URL, so we fall back to
       somewhere real instead of publishing links nobody can follow. */
    if (!hostname.includes(".") && hostname !== "localhost") return null
    return origin
  } catch {
    return null
  }
}

function resolveBaseUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : undefined,
    process.env.VERCEL_URL,
  ]

  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate)
    if (origin) return origin
  }

  return PRODUCTION_ORIGIN
}

export const ENV_CLIENT = {
  NEXT_PUBLIC_BASE_URL: resolveBaseUrl(),
} as const

export type EnvClient = typeof ENV_CLIENT
