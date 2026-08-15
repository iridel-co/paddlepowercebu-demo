import type { MetadataRoute } from "next"

import { APP_CONFIG, IS_INDEXABLE } from "@/config/app.config"

/**
 * Note what is *not* blocked here: `/_next/*`.
 *
 * Google fetches the JavaScript and CSS behind that path to render the page
 * before it judges it. This site's hero is a canvas driven by scroll and a
 * three.js scene, so a crawler that can't run the bundle sees an empty stage.
 * Blocking build output is a common habit and it would cost us the whole
 * above-the-fold view.
 */
export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    }
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: new URL("/sitemap.xml", APP_CONFIG.url).toString(),
    host: APP_CONFIG.url,
  }
}
