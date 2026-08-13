"use client"

import * as React from "react"
import Image from "next/image"
import { MenuIcon } from "lucide-react"
import { Navbar } from "@/components/common/navbar"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { localClientImg } from "@/lib/images"
import { getNavHeightPx } from "@/lib/nav-height"
import { PillLink } from "../_ui/pill-link"

/**
 * Fixed header that reads white over the hero and solidifies into cream + ink
 * as the body takes the screen.
 *
 * The trigger is the top edge of the post-hero body (`#after-hero`), not the
 * hero's own bottom: the hero is a tall scrub track and the body is pulled up
 * over its tail, so the hero's DOM bottom passes the band long after Locations
 * has visually taken over. Reading the body's top edge instead — with a lead of
 * `LEAD_VH` so the 260ms fade finishes before it locks under the band — puts
 * the swap exactly where the surface behind the nav changes.
 */

const LINKS = [
  { href: "#locations", label: "Locations" },
  { href: "#soon", label: "Coming Soon" },
  { href: "#faq", label: "FAQ" },
  { href: "#visit", label: "Visit" },
]

/** Fallback trigger when the body marker isn't on the page (inner routes). */
const STICK_AT = 24

/**
 * How far above the header band the body starts the swap, in viewport heights.
 * 0 means the fade begins the moment the hero is fully out of frame — any lead
 * above that visibly starts the swap while the hero is still on screen.
 */
const LEAD_VH = 0

export function SiteHeader() {
  const [stuck, setStuck] = React.useState(false)
  const rafRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    const read = () => {
      rafRef.current = null
      const body = document.getElementById("after-hero")
      if (!body) {
        setStuck(window.scrollY > STICK_AT)
        return
      }
      const lead = window.innerHeight * LEAD_VH
      setStuck(body.getBoundingClientRect().top <= getNavHeightPx() + lead)
    }
    // Single rAF gate — never do the read directly in the scroll handler.
    const onScroll = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(read)
    }

    read()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  /**
   * Over the hero the whole nav reads white; once the hero clears, it swaps to
   * ink. The mark can't be recoloured with CSS (it's a flat SVG asset), so both
   * one-colour versions are stacked and cross-faded on the same 260ms curve as
   * the text and surface — everything lands together at the seam.
   */
  const logoMark = (variant: "black" | "white") => (
    <Image
      src={localClientImg(
        "paddle-power-cebu",
        `paddle-power-one-color-${variant}.svg`
      )}
      alt="Paddle Power Cebu"
      width={462}
      height={175}
      priority
      className={cn(
        "h-8 w-auto transition-opacity duration-260 ease-out",
        (variant === "black") === stuck ? "opacity-100" : "opacity-0"
      )}
    />
  )

  const logo = (
    <div className="flex items-center gap-3">
      <a
        href="#top"
        className="relative flex items-center"
        aria-label="Paddle Power Cebu"
      >
        {logoMark("black")}
        <span aria-hidden className="absolute inset-0 flex items-center">
          {logoMark("white")}
        </span>
      </a>
      <a
        href="https://iridel.com"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "hidden text-xs font-medium tracking-[0.01em] whitespace-nowrap transition-colors duration-260 ease-out sm:inline-block",
          stuck
            ? "text-pp-ink/50 hover:text-pp-ink"
            : "text-white/70 hover:text-white"
        )}
      >
        Demo by iridel.com
      </a>
    </div>
  )

  /** Same logo, forced dark — the mobile drawer is always cream. */
  const drawerLogo = (
    <a href="#top" className="flex items-center" aria-label="Paddle Power Cebu">
      <Image
        src={localClientImg(
          "paddle-power-cebu",
          "paddle-power-one-color-black.svg"
        )}
        alt="Paddle Power Cebu"
        width={462}
        height={175}
        className="h-8 w-auto"
      />
    </a>
  )

  return (
    <Navbar
      className={cn(
        "fixed h-(--nav-h) px-5 transition-[background-color,box-shadow,border-color] duration-260 ease-out lg:px-12",
        stuck
          ? "bg-pp-cream/92 supports-[backdrop-filter]:bg-pp-cream/85 border-pp-ink/25 shadow-[0_6px_24px_rgba(17,17,17,0.06)]"
          : // Both the plain and the `supports-[…]` background have to be
            // cleared: tailwind-merge treats the variant class as its own key,
            // so `bg-transparent` alone leaves the base surface showing.
            "border-transparent bg-transparent shadow-none supports-[backdrop-filter]:bg-transparent"
      )}
      start={logo}
      center={
        <nav
          aria-label="Sections"
          className="hidden items-center gap-[34px] text-sm font-medium tracking-[0.01em] whitespace-nowrap lg:flex"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors duration-260 ease-out",
                stuck
                  ? "text-pp-ink hover:text-pp-olive"
                  : "hover:text-pp-lime text-white"
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>
      }
      end={
        <>
          <PillLink
            href="#locations"
            variant={stuck ? "outline" : "white"}
            className="hidden duration-260 sm:inline-flex"
          >
            Book a Court
          </PillLink>

          <Sheet>
            <SheetTrigger
              aria-label="Open menu"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-260 ease-out lg:hidden",
                stuck
                  ? "text-pp-ink hover:bg-pp-ink/5"
                  : "text-white hover:bg-white/15"
              )}
            >
              <MenuIcon className="size-5" />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="bg-pp-cream text-pp-ink w-[86vw] max-w-[360px] gap-8 border-l-0"
            >
              {/* Satisfies the Sheet's required title without visible chrome. */}
              <SheetTitle asChild>{drawerLogo}</SheetTitle>

              <nav
                aria-label="Sections"
                className="flex flex-col gap-1 text-2xl font-bold tracking-tight"
              >
                {LINKS.map((link) => (
                  <SheetClose key={link.href} asChild>
                    <a
                      href={link.href}
                      className="hover:text-pp-olive py-2 transition-colors"
                    >
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
              </nav>

              <SheetClose asChild>
                <PillLink href="#locations" variant="lime" className="w-full">
                  Book a Court
                </PillLink>
              </SheetClose>

              <a
                href="https://iridel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pp-ink/50 hover:text-pp-ink text-xs font-medium transition-colors"
              >
                Demo by iridel.com
              </a>
            </SheetContent>
          </Sheet>
        </>
      }
    />
  )
}
