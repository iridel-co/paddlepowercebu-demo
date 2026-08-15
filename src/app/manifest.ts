import type { MetadataRoute } from "next"

import { APP_CONFIG } from "@/config/app.config"

/**
 * Colours are the brand tokens from `globals.css`: ink for the surface the
 * icon sits on, lime for the browser chrome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_CONFIG.longName,
    short_name: APP_CONFIG.shortName,
    description: APP_CONFIG.description,
    start_url: "/",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#c8dc3a",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
