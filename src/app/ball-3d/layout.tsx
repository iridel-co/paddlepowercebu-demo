import type { Metadata } from "next"

/**
 * The page itself is a client component, which can't export metadata, so the
 * noindex lives in this layout instead.
 *
 * Kept out of search on every environment, production included: this is the
 * review harness `tools/export-renders.mjs` drives to capture the ball
 * renders, not something a visitor should ever land on from Google.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function BallReviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
