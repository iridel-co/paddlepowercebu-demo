import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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
