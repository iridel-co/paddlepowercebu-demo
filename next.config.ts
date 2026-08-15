import type { NextConfig } from "next"

const isProd = process.env.NODE_ENV === "production"

/**
 * Next serves everything under `public/` with `Cache-Control: public, max-age=0`,
 * so the browser must revalidate every file on each load. This page ships 55 hero
 * frames plus ~19 images, which turns a plain refresh into ~74 conditional
 * requests that all come back 304 Not Modified: no bytes, but a full round-trip
 * each, six at a time. On a real connection that is seconds of stalling before
 * the hero can paint.
 *
 * These assets are content-stable, so cache them hard in production. In dev the
 * window is short, so swapping a frame or a render still shows up on the next
 * refresh instead of needing a cache-busting reload.
 */
const STATIC_ASSET_CACHE = isProd
  ? "public, max-age=31536000, immutable"
  : "public, max-age=300"

const nextConfig: NextConfig = {
  /**
   * Barrel-file imports get rewritten to the individual modules behind them, so
   * a page pulling eight icons out of `lucide-react` doesn't drag the other
   * ~1,500 through the compiler. Next applies this to a default list already;
   * these are the ones this demo leans on that aren't on it.
   */
  experimental: {
    optimizePackageImports: ["motion", "gsap", "@gsap/react"],
  },
  async headers() {
    return [
      {
        source: "/frames/:path*",
        headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE }],
      },
      {
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: STATIC_ASSET_CACHE }],
      },
      /**
       * Baseline security headers. HSTS is not repeated here — Vercel already
       * sends it. A full Content-Security-Policy is deliberately absent: Next
       * boots from inline scripts, so a real CSP needs per-request nonces via
       * middleware, and a half-strict one would break hydration for zero
       * practical gain on a static demo.
       */
      {
        source: "/:path*",
        headers: [
          /* Nothing here should ever be sniffed into a different type. */
          { key: "X-Content-Type-Options", value: "nosniff" },
          /* Full URL to our own pages, origin only to Google Maps etc. */
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          /* Nobody else has a reason to iframe the site. */
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          /* No popups need a handle on our window, so isolate outright. */
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ]
  },
  /**
   * Next 16.3 appends a "nextjs-agent-rules" block to CLAUDE.md on every
   * `next dev`. Our CLAUDE.md is hand-authored and checked in, so the
   * re-injection shows up as a dirty tree in every demo. Keep it off.
   */
  agentRules: false,
  images: {
    remotePatterns: [
      /**
       * Nano Banana CDN
       * Replace "assets.nanobanana.io" with the actual domain once confirmed.
       * Update NANO_BANANA_BASE in src/lib/images.ts to match.
       * @see docs/image-handling.md
       */
      {
        protocol: "https",
        hostname: "assets.nanobanana.io",
        pathname: "/**",
      },
      /**
       * Unsplash — dev placeholder imagery only.
       * Remove this entry before shipping to a real client.
       */
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
}

export default nextConfig
