/**
 * Title and description per route.
 *
 * One entry today because the site is one page. It exists so adding a route
 * later is a matter of adding an entry and calling `generatePageMetadata`,
 * rather than hand-writing another metadata object.
 */
export const PAGE_METADATA_CONFIG = {
  home: {
    title: "Paddle Power Cebu: Book a Court, 24/7",
    description:
      "Premium indoor pickleball courts in Talisay, Cebu. Open 24/7, rain or shine. Book your court in one tap.",
    pathname: "/",
  },
} as const
