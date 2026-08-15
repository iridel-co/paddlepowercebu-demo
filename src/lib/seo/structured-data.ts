import { FAQS } from "@/app/_sections/faq.data"
import { APP_CONFIG } from "@/config/app.config"

/**
 * JSON-LD for the venue and the FAQ.
 *
 * The rule that matters here: a field the client hasn't confirmed is left out
 * of the object entirely, never filled with something plausible. Google treats
 * a name, address, and phone number as the business's identity and checks them
 * against everything else it knows. Missing details are neutral. Invented ones
 * contradict the real listing and are worked out of a ranking slowly, if at
 * all.
 */

type JsonLdValue =
  | string
  | number
  | boolean
  | JsonLdObject
  | readonly JsonLdValue[]
type JsonLdObject = { [key: string]: JsonLdValue | undefined }

/**
 * Drops keys whose value is `undefined`, so an unconfirmed fact simply never
 * appears in the emitted JSON rather than showing up as null or "".
 */
function compact(input: JsonLdObject): JsonLdObject {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as JsonLdObject
}

/**
 * `SportsActivityLocation` rather than a plain `LocalBusiness` — it is the
 * type schema.org defines for a place people go to play a sport, which is
 * what this is.
 */
export function buildVenueJsonLd(): JsonLdObject {
  const { branch } = APP_CONFIG

  return compact({
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: APP_CONFIG.shortName,
    description: APP_CONFIG.description,
    url: APP_CONFIG.url,
    image: new URL(APP_CONFIG.ogImage, APP_CONFIG.url).toString(),
    address: {
      "@type": "PostalAddress",
      streetAddress: branch.streetAddress,
      addressLocality: branch.addressLocality,
      addressRegion: branch.addressRegion,
      postalCode: branch.postalCode,
      addressCountry: branch.addressCountry,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: branch.latitude,
      longitude: branch.longitude,
    },
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      branch.plusCode
    )}`,
    /* Open every day, all day. */
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: APP_CONFIG.opensAt,
        closes: APP_CONFIG.closesAt,
      },
    ],
    sameAs: [APP_CONFIG.socials.instagram],
    /*
     * Absent on purpose until the client confirms them — see the TODOs in
     * `app.config.ts`. `telephone`, `email`, and a `potentialAction` booking
     * link all belong here once they exist.
     */
  })
}

export function buildFaqJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  }
}
