import type { Metadata } from "next"
import { Geist, Geist_Mono, Libre_Baskerville } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const libreBaskerville = Libre_Baskerville({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
})

export const metadata: Metadata = {
  title: "Iridel Demo Template",
  description:
    "Iridel — build polished, client-ready demos with a warm, minimal, accessibility-first design system.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${libreBaskerville.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
