import type { MetadataRoute } from "next"

import { APP_CONFIG, IS_INDEXABLE } from "@/config/app.config"

/**
 * Two things this file deliberately never blocks.
 *
 * `/_next/*`: Google fetches the JavaScript and CSS behind that path to render
 * the page before it judges it. This site's hero is a canvas driven by scroll
 * and a three.js scene, so a crawler that can't run the bundle sees an empty
 * stage.
 *
 * The site itself, even when it isn't meant to be indexed. Blocking a crawler
 * from fetching a page also stops it reading the `noindex` in that page's head,
 * so a URL someone links to can still surface as a bare result nobody can
 * suppress. Keeping the door open and saying `noindex` on the way in is what
 * actually gets a page left out. It also means link previews in chat apps keep
 * working while the demo is under review, which is the whole point of the
 * Open Graph card.
 *
 * So: crawlable everywhere, indexable only on the production host.
 */
export default function robots(): MetadataRoute.Robots {
  const rules = [
    {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
  ]

  /* Off-production builds are noindex via the page head, and advertise no
     sitemap — there is nothing here we want discovered yet. */
  if (!IS_INDEXABLE) return { rules }

  return {
    rules,
    sitemap: new URL("/sitemap.xml", APP_CONFIG.url).toString(),
    host: APP_CONFIG.url,
  }
}
