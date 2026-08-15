"use client"

import Image from "next/image"
import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react"

import { localClientImg } from "@/lib/images"
import { VariableWeightText } from "@/components/ui/variable-weight-text"

/**
 * Visit — the page's closing CTA, replacing the old partnerships block.
 *
 * Structured as a two-column "see you on court" closer: the statement and every
 * way to reach the club on the left, the physical facts on the right — a court
 * photo and hours. The Talisay branch (address, map, directions link) runs
 * full width below both columns.
 *
 * Contact is social link-out only (the client declined an email integration),
 * so the channel rows are profiles rather than a form. Partnership enquiries
 * ride the same rows — the Coming Soon grid already carries that pitch, so it
 * doesn't need a section of its own.
 *
 * Ink surface, flowing straight into the ink footer: this is the loud closer,
 * the footer is the small print under it.
 */

/* Every way in. TODO: add PHONE and EMAIL rows here once the client supplies
   them — same shape, `external: false` with a `tel:` / `mailto:` href. */
const CHANNELS: {
  label: string
  value: string
  href: string
  /** In-page anchor — skips the new-tab treatment the profiles get. */
  internal?: boolean
}[] = [
  {
    label: "Instagram",
    value: "@paddlepowercebu",
    href: "https://instagram.com/paddlepowercebu",
  },
  {
    /* TODO: confirm Facebook page URL with client */
    label: "Facebook",
    value: "Paddle Power Cebu",
    href: "https://facebook.com/paddlepowercebu",
  },
  {
    label: "Book",
    value: "Book your court",
    href: "#locations",
    internal: true,
  },
]

const BRANCH = {
  name: "Talisay",
  region: "Cebu",
  address: ["Maghaway Rd", "Talisay City, 6045 Cebu", "Philippines"],
  /* Plus Code, not a business-name search — the embed's `q=` param treats
     bare text as a fuzzy place search, and "Paddle Power" isn't a verified
     Google listing at this address, so it was surfacing a second pin for a
     similarly-named nearby business. A Plus Code geocodes to exactly one
     point, so only one pin renders. */
  mapQuery: "7R59+W5 Talisay, Cebu",
} as const

/* Keyless Google Maps — the `output=embed` form needs no API key, and the same
   query drives the directions link so the pin and the route always agree. */
const mapEmbed = (q: string) =>
  `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=14&output=embed`
const mapLink = (q: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`

const LABEL = "text-pp-tan/60 text-[10px] font-bold tracking-[0.16em] uppercase"
const RULE = "border-pp-tan/15"

/* Same weight-sweep headline treatment as the Locations "Your court. One
   tap." heading — fast enough to land as one gesture rather than a
   per-letter crawl. Second line's delay lets the sweep read as a single
   continuous pass down from "See you" into "on court." */
const HEADLINE_STAGGER = 0.014
const HEADLINE_ANIM = { type: "spring", duration: 0.35, bounce: 0 } as const
const FIRST_LINE = "See you"
const SECOND_LINE_DELAY = (FIRST_LINE.length + 1) * HEADLINE_STAGGER

export function DemoVisit() {
  return (
    <section
      id="visit"
      className="bg-pp-ink scroll-mt-(--nav-h) px-5 py-20 lg:px-12 lg:py-28"
    >
      <div className="mx-auto grid max-w-[1240px] gap-14 lg:grid-cols-12 lg:gap-16">
        {/* ── Statement + channels ───────────────────────────────────────── */}
        <div className="flex flex-col gap-9 lg:col-span-7">
          <div className="flex flex-col gap-5">
            <h2
              className="text-pp-cream m-0 leading-[0.9] font-black tracking-[-0.03em] uppercase"
              style={{ fontSize: "clamp(50px, 7.5vw, 104px)" }}
            >
              <VariableWeightText
                text={FIRST_LINE}
                staggerTiming={HEADLINE_STAGGER}
                animationConfig={HEADLINE_ANIM}
              />
              <br />
              <VariableWeightText
                text="on court."
                className="text-pp-lime-light"
                staggerTiming={HEADLINE_STAGGER}
                animationConfig={HEADLINE_ANIM}
                startDelay={SECOND_LINE_DELAY}
              />
            </h2>
            <p className="text-pp-tan/70 m-0 max-w-[46ch] text-base leading-relaxed font-medium lg:text-lg">
              Reservations run through Ondafit, any hour, no account needed. For
              coaching, events, or brand collabs, Instagram is the fastest way
              to reach us.
            </p>
          </div>

          {/* Whole row is the link, so the hit area is the full width. */}
          <div className={`flex flex-col border-t ${RULE}`}>
            {CHANNELS.map((channel) => (
              <a
                key={channel.label}
                href={channel.href}
                {...(channel.internal
                  ? {}
                  : { target: "_blank", rel: "noopener noreferrer" })}
                className={`group focus-visible:outline-pp-lime-light grid grid-cols-[auto_1fr_auto] items-center gap-5 border-b py-5 focus-visible:outline-2 focus-visible:outline-offset-2 sm:gap-8 ${RULE}`}
              >
                <span className={`${LABEL} w-[68px] sm:w-[88px]`}>
                  {channel.label}
                </span>
                <span className="text-pp-cream group-hover:text-pp-lime-light text-lg font-bold tracking-[-0.01em] transition-colors duration-200 ease-out lg:text-xl">
                  {channel.value}
                </span>
                <ArrowRightIcon
                  className="text-pp-tan/40 group-hover:text-pp-lime-light size-[18px] transition-[color,transform] duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none"
                  aria-hidden
                />
              </a>
            ))}
          </div>
        </div>

        {/* ── The facts ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-10 lg:col-span-5 lg:-mt-3">
          {/* Framed plate, mounted like a print — thin rule, inset image,
              caption on the mat. Sized so the column's total height (image +
              caption + Hours below) lands on the left column's own height —
              the "Book" row is the last thing on the left, so that's the
              target the Café row has to hit. Nudged up to align the frame's
              top edge with the headline's cap-height, not its taller line box. */}
          <figure className="border-pp-tan/20 m-0 flex flex-col gap-3 border p-3">
            <div className="relative aspect-3/2 overflow-hidden">
              <Image
                src={localClientImg("paddle-power-cebu", "court-render.webp")}
                alt="Interior render of the Paddle Power Cebu court: blue playing surface under a lit steel-truss roof"
                fill
                sizes="(min-width: 1024px) 460px, 100vw"
                className="object-cover object-[center_30%]"
              />
            </div>
            <figcaption className="text-pp-tan/55 text-center text-xs font-medium">
              Inside the club
            </figcaption>
          </figure>

          <div className={`flex flex-col gap-4 border-t pt-8 ${RULE}`}>
            <span className={LABEL}>Hours</span>
            <dl className="m-0 flex flex-col">
              {[
                { term: "Courts", detail: "Open 24 / 7" },
                { term: "Bookings", detail: "Daily · all hours" },
                { term: "Café", detail: "Coming soon" },
              ].map((row) => (
                <div
                  key={row.term}
                  className={`flex items-baseline justify-between gap-4 border-b py-3.5 ${RULE}`}
                >
                  <dt className="text-pp-cream/80 m-0 text-sm font-medium">
                    {row.term}
                  </dt>
                  <dd className="text-pp-cream m-0 text-sm font-bold">
                    {row.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* ── Where — one confirmed branch, so it spreads across the full
            width as a wide address-plus-map pair instead of a cramped
            single column. ──────────────────────────────────────────────── */}
        <div className="lg:col-span-12">
          <div className="grid gap-8 lg:grid-cols-[320px_1fr] lg:items-center lg:gap-16">
            <div className="flex flex-col gap-5">
              {/* Branch and province, not just the branch — "Talisay" alone
                  means nothing to someone who hasn't already found us. */}
              <h3 className="text-pp-cream m-0 text-2xl font-black tracking-[-0.015em] lg:text-3xl">
                {BRANCH.name}, {BRANCH.region}
              </h3>
              <address className="text-pp-cream/80 text-base leading-relaxed font-medium not-italic lg:text-lg">
                {BRANCH.address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
              <a
                href={mapLink(BRANCH.mapQuery)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pp-cream hover:text-pp-lime-light focus-visible:outline-pp-lime-light group inline-flex items-center gap-2 self-start text-[10px] font-bold tracking-[0.16em] uppercase transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Get directions
                <ArrowUpRightIcon
                  className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </a>
            </div>
            <iframe
              src={mapEmbed(BRANCH.mapQuery)}
              title={`Map of Paddle Power Cebu: ${BRANCH.name}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="border-pp-tan/15 h-60 w-full border filter-[grayscale(20%)_invert(92%)_hue-rotate(180deg)_brightness(95%)_contrast(90%)] lg:h-80"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
