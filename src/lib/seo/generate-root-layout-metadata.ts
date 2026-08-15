import type { Metadata } from "next"

import { APP_CONFIG, IS_INDEXABLE } from "@/config/app.config"

/**
 * Head metadata shared by every route.
 *
 * Deliberately does not set a canonical URL. A canonical declared here is
 * inherited by any route that forgets to declare its own, which quietly points
 * that route at the homepage and drops it from search. Each route sets its own
 * through `generatePageMetadata` instead — a missing canonical is harmless, a
 * wrong one is not.
 */
export function generateRootLayoutMetadata(): Metadata {
  return {
    metadataBase: new URL(APP_CONFIG.url),
    title: {
      default: APP_CONFIG.longName,
      template: `%s | ${APP_CONFIG.shortName}`,
    },
    description: APP_CONFIG.description,
    applicationName: APP_CONFIG.shortName,
    icons: {
      icon: ["/favicon.ico", "/favicon.svg"],
      apple: "/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: APP_CONFIG.shortName,
    },
    /* Phone numbers aren't published yet, so let Safari stop guessing at
       which numbers on the page are dialable. */
    formatDetection: {
      telephone: false,
    },
    /* Preview deploys turn this off wholesale — see `IS_INDEXABLE`. */
    robots: {
      index: IS_INDEXABLE,
      follow: IS_INDEXABLE,
      googleBot: {
        index: IS_INDEXABLE,
        follow: IS_INDEXABLE,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      url: APP_CONFIG.url,
      siteName: APP_CONFIG.shortName,
      title: {
        default: APP_CONFIG.longName,
        template: `%s | ${APP_CONFIG.shortName}`,
      },
      description: APP_CONFIG.description,
      locale: "en_PH",
      images: [
        {
          url: APP_CONFIG.ogImage,
          type: "image/png",
          width: 1200,
          height: 630,
          alt: `${APP_CONFIG.shortName} — premium indoor pickleball courts in Talisay, Cebu`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: {
        default: APP_CONFIG.longName,
        template: `%s | ${APP_CONFIG.shortName}`,
      },
      description: APP_CONFIG.description,
      images: [APP_CONFIG.ogImage],
    },
  }
}
