import { Geist_Mono, Montserrat } from "next/font/google"
import "./globals.css"
import { JsonLd } from "@/lib/seo/json-ld"
import { generateRootLayoutMetadata } from "@/lib/seo/generate-root-layout-metadata"
import { buildFaqJsonLd, buildVenueJsonLd } from "@/lib/seo/structured-data"
import { SmoothAnchorScroll } from "./_ui/smooth-anchor-scroll"

/**
 * Paddle Power Cebu uses Montserrat exclusively — Black (900) for the logo and
 * display headings, Bold (700) for subheads and buttons, Medium (500) for
 * labels, Regular (400) for body. No serif anywhere.
 *
 * Loaded as the variable font (no `weight` list) so the `wght` axis can be
 * animated continuously — `VariableWeightText` interpolates 400 → 900 rather
 * than snapping between static cuts.
 */
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata = generateRootLayoutMetadata()

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} ${geistMono.variable} antialiased`}
      >
        <SmoothAnchorScroll />
        {children}
        <JsonLd id="ld-venue" data={buildVenueJsonLd()} />
        <JsonLd id="ld-faq" data={buildFaqJsonLd()} />
      </body>
    </html>
  )
}
