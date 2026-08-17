import { ENV_CLIENT } from "@/config/env.client"
import { BOOKING_URL } from "@/config/links.config"

/**
 * Every fact this site publishes about the business, in one place.
 *
 * Metadata, the sitemap, the JSON-LD, and the Visit section all read from
 * here rather than restating an address or a set of hours, because the same
 * details showing up differently in two places is exactly how a local listing
 * loses trust.
 *
 * Anything the client hasn't confirmed is left out entirely instead of being
 * filled with a stand-in. A missing phone number costs nothing; a wrong one
 * gets held against the listing.
 */

const PRODUCTION_HOST = "paddlepowercebu.com"

/**
 * Talisay is the only branch open today. The second one is under
 * construction and gets added here when it has an address of its own.
 *
 * The coordinates are the decoded centre of Plus Code 7R59+W5 (full code
 * 7Q257R59+W5), which is the same point the Visit section's map embed uses.
 * The code was picked over a business-name search because it resolves to
 * exactly one pin — see the note in `_sections/visit.tsx`.
 */
const TALISAY = {
  name: "Talisay",
  streetAddress: "Maghaway Rd",
  addressLocality: "Talisay City",
  addressRegion: "Cebu",
  postalCode: "6045",
  addressCountry: "PH",
  plusCode: "7R59+W5 Talisay, Cebu",
  latitude: 10.259813,
  longitude: 123.817937,
} as const

export const APP_CONFIG = {
  url: ENV_CLIENT.NEXT_PUBLIC_BASE_URL,
  productionHost: PRODUCTION_HOST,

  shortName: "Paddle Power Cebu",
  longName: "Paddle Power Cebu: Book a Court",
  description:
    "Premium indoor pickleball in Talisay, Cebu. Book your court in one tap.",
  bookingUrl: BOOKING_URL,

  branch: TALISAY,

  /*
   * Only profiles we can point at with confidence. The Facebook page URL is
   * still a guess in the section files, so it is deliberately not published
   * as an authoritative `sameAs` here.
   * TODO: add the Facebook page URL once the client confirms it.
   */
  socials: {
    instagram: "https://instagram.com/paddlepowercebu",
  },

  ogImage: "/og/index.png",

  /*
   * Still waiting on the client, and left absent rather than stubbed:
   * TODO: telephone
   * TODO: email
   * TODO: court count
   */
} as const

/**
 * The site is only crawlable when it is actually being served from the real
 * domain. Preview deploys resolve to some other host, so they turn themselves
 * off without anyone configuring anything.
 *
 * A malformed URL counts as not-production: failing closed here means the
 * worst case is a live site that needs its env var fixed, rather than a
 * half-built demo quietly landing in search results.
 */
function resolveIsIndexable(): boolean {
  try {
    return new URL(APP_CONFIG.url).host === APP_CONFIG.productionHost
  } catch {
    return false
  }
}

export const IS_INDEXABLE = resolveIsIndexable()
