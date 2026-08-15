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
function resolveBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL
  if (explicit) return explicit

  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return "https://paddlepowercebu.com"
}

export const ENV_CLIENT = {
  NEXT_PUBLIC_BASE_URL: resolveBaseUrl(),
} as const

export type EnvClient = typeof ENV_CLIENT
