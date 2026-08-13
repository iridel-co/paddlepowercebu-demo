import type { Metadata } from "next"
import { Geist_Mono, Montserrat } from "next/font/google"
import "./globals.css"
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

export const metadata: Metadata = {
  title: "Paddle Power Cebu: Book a Court, 24/7",
  description:
    "Premium indoor pickleball in Cebu. Solar-powered, open around the clock, two branches. Pick yours and book in one tap.",
}

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
      </body>
    </html>
  )
}
