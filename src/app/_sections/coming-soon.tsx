"use client"

import { useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  CalendarDaysIcon,
  CoffeeIcon,
  FacebookIcon,
  GraduationCapIcon,
  HandshakeIcon,
  InstagramIcon,
  ShoppingBagIcon,
  TicketIcon,
} from "lucide-react"

import { SvgFollowScroll } from "@/components/ui/svg-follow-scroll"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { VariableWeightText } from "@/components/ui/variable-weight-text"

/* Dynamic + ssr:false so `three` (~600KB) code-splits out of the initial
   bundle instead of loading on every page view. Same chunk id as the
   PaddleViewer/BallViewer pair in locations.tsx, so whichever section the
   visitor reaches first warms it for the other. */
const BallViewer = dynamic(
  () => import("@/lib/paddle3d/ball-viewer").then((m) => m.BallViewer),
  { ssr: false }
)

/**
 * Coming Soon — previews the services beyond court booking. On desktop, a
 * pickleball holds the vertical center of the screen on the right while the
 * card list scrolls past on the left at its own, faster pace. The ball is
 * clipped by the section, so it slides out of sight behind the top and
 * bottom edges rather than floating over the neighbouring sections.
 * Whichever card lines up with the ball's height is the "active" one — it
 * pulls in while the rest ripple outward in a wave. Partnerships' circle
 * badge swaps color on the same active-alignment trigger as every other
 * card, not on hover.
 * Partnerships is the one item that's live today, so it carries a lime
 * status tag regardless of which card is active.
 *
 * Cards are clickable: clicking one scrolls the page so that card lands in
 * the ball's active position. Partnerships is the exception — since it's
 * the one live channel, clicking it opens Instagram to start a conversation
 * instead of scrolling.
 *
 * Mobile runs the same choreography at a smaller scale: the ball rides a
 * narrow lane pinned to the right edge (the card list reserves that gutter as
 * padding), the drawn stroke stays behind it, and the cards only ripple a few
 * pixels instead of sliding across the column.
 */

gsap.registerPlugin(ScrollTrigger)

/* Same weight-sweep headline treatment as the Locations "Two branches. One
   tap." heading — fast enough to land as one gesture rather than a
   per-letter crawl. */
const HEADLINE_STAGGER = 0.014
const HEADLINE_ANIM = { type: "spring", duration: 0.35, bounce: 0 } as const

const ITEMS = [
  {
    variant: "membership" as const,
    icon: TicketIcon,
    title: "Memberships",
    body: "Priority slots and member rates across both branches.",
    live: false,
  },
  {
    variant: "lesson" as const,
    icon: GraduationCapIcon,
    title: "Coaching Sessions",
    body: "One-on-one and small-group clinics with resident coaches.",
    live: false,
  },
  {
    variant: "ticket" as const,
    icon: CalendarDaysIcon,
    title: "Events & Bulk Reservations",
    body: "Birthdays, corporate nights, and group bookings across multiple courts.",
    live: false,
  },
  {
    variant: "cafe" as const,
    icon: CoffeeIcon,
    title: "Café",
    body: "A space to recharge between games, opening at AS Fortuna.",
    live: false,
  },
  {
    variant: "proshop" as const,
    icon: ShoppingBagIcon,
    title: "Equipment",
    body: "Paddle rental, balls, and Paddle Power merch at the pro shop.",
    live: false,
  },
  {
    variant: "partnership" as const,
    icon: HandshakeIcon,
    title: "Partnerships",
    body: "Brand collabs and community events. Send us a message any time.",
    live: true,
  },
]

const ACTIVE_ICON_BG = "#a3b500" // pp-lime
const ACTIVE_ICON_FG = "#111111" // pp-ink
const IDLE_ICON_BG = "#111111" // pp-ink
const IDLE_ICON_FG = "#f7f4ee" // pp-cream

function StatusPill({
  live,
  variant,
}: {
  live: boolean
  variant: "outline" | "filled" | "dashed"
}) {
  const label = live ? "Live now" : "Coming soon"
  const base =
    "w-fit shrink-0 rounded-full px-3.5 py-1.5 text-[10px] font-bold tracking-[0.14em] uppercase"

  if (live) {
    return <span className={`${base} bg-pp-lime text-pp-ink`}>{label}</span>
  }
  if (variant === "outline") {
    return (
      <span className={`${base} border-pp-lime text-pp-lime border`}>
        {label}
      </span>
    )
  }
  if (variant === "filled") {
    return <span className={`${base} bg-pp-lime text-pp-ink`}>{label}</span>
  }
  return (
    <span
      className={`${base} border-pp-ink/25 text-pp-charcoal/60 border border-dashed`}
    >
      {label}
    </span>
  )
}

// The ball sits right of center and the cards sit left of center so the two
// never overlap. On mobile there's no room for that split — the ball hugs the
// right edge and the list reserves a gutter for it instead, so the cards stay
// where they are (baseX 0) and only ripple by a few pixels.
const DESKTOP_MOTION = {
  baseX: -150,
  maxShift: 190,
  shiftPerStep: 55,
  maxRotate: 6,
  rotatePerStep: 2,
  activeScale: 1.03,
  minScale: 0.85,
  scalePerStep: 0.05,
  minOpacity: 0.32,
  opacityPerStep: 0.16,
  // Fraction of a viewport the ball drifts *past* a pure center-hold across
  // the section. 0 = the desktop behaviour: the ball's travel matches scroll
  // exactly, so it sits still on screen while the cards slide past it.
  drift: 0,
}

const MOBILE_MOTION = {
  baseX: 0,
  maxShift: 26,
  shiftPerStep: 10,
  maxRotate: 3,
  rotatePerStep: 1,
  activeScale: 1.02,
  minScale: 0.93,
  scalePerStep: 0.025,
  minOpacity: 0.5,
  opacityPerStep: 0.12,
  // Mobile cards barely move, so a center-holding ball reads as frozen. It
  // enters a fifth of a viewport high and leaves a fifth low, which shows up
  // as a slow fall down the screen across the section.
  drift: 0.2,
}

type Motion = typeof DESKTOP_MOTION

const INSTAGRAM_URL = "https://instagram.com/paddlepowercebu"
const FACEBOOK_URL = "https://facebook.com/paddlepowercebu"

// Tap/click auto-dismiss for the "Still coming soon!" tooltip — long enough
// to read, short enough not to linger after the finger lifts.
const TAP_TOOLTIP_MS = 1800

export function DemoComingSoon() {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const ballTrackRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const iconRefs = useRef<(HTMLElement | null)[]>([])
  const extraCircleRefs = useRef<(HTMLElement | null)[]>([])

  // Hover opens the tooltip natively (Radix listens for it even in
  // controlled mode); a click/tap also forces it open and auto-dismisses,
  // since touch devices never fire a hover event.
  const [openTipIndex, setOpenTipIndex] = useState<number | null>(null)
  const tipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Card clicks travel to wherever that card sits in the active/ball-aligned
  // scroll position. On desktop (see mm.add below) that's a computed scroll
  // offset so the ball actually lines up with the card; this fallback (used
  // before the effect wires the real one, and on breakpoints without the
  // ball) just brings the card into view.
  const scrollToItemRef = useRef<(index: number) => void>((index) => {
    itemRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  })

  const handleCardActivate = (index: number) => {
    if (ITEMS[index].variant === "partnership") {
      window.open(INSTAGRAM_URL, "_blank", "noopener,noreferrer")
      return
    }
    setOpenTipIndex(index)
    if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current)
    tipTimeoutRef.current = setTimeout(
      () => setOpenTipIndex(null),
      TAP_TOOLTIP_MS
    )
    scrollToItemRef.current(index)
  }

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      // Both breakpoints run the same ball-travel + active-card machinery;
      // only the card motion amounts differ (see DESKTOP_MOTION/MOBILE_MOTION).
      const setup = (motion: Motion) => () => {
        const ball = ballRef.current
        const ballTrack = ballTrackRef.current
        const pin = pinRef.current
        const list = listRef.current
        if (!ball || !ballTrack || !pin || !list) return

        // Background circles drift slower than scroll — parallax depth cue.
        gsap.to("[data-parallax-slow]", {
          yPercent: -18,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
        })

        const items = itemRefs.current
        const icons = iconRefs.current
        let activeIndex = -1

        const setActive = (index: number) => {
          if (index === activeIndex) return
          activeIndex = index
          items.forEach((item, i) => {
            const icon = icons[i]
            if (!item || !icon) return
            const dist = i - index
            const abs = Math.abs(dist)
            const isActive = dist === 0
            gsap.to(item, {
              x:
                motion.baseX +
                Math.sign(dist) *
                  Math.min(abs * motion.shiftPerStep, motion.maxShift),
              rotateZ:
                Math.sign(dist) *
                Math.min(abs * motion.rotatePerStep, motion.maxRotate),
              scale: isActive
                ? motion.activeScale
                : Math.max(motion.minScale, 1 - abs * motion.scalePerStep),
              opacity: Math.max(
                motion.minOpacity,
                1 - abs * motion.opacityPerStep
              ),
              duration: 0.6,
              ease: "power3.out",
              overwrite: "auto",
              // Scaling text on a GPU-composited layer (force3D) leaves the
              // card looking soft once the tween settles — Chrome caches the
              // pre-scale raster and stretches it instead of re-rasterizing
              // at the new size. These tweens are discrete (triggered once
              // per active-card change, not scrubbed every frame), so the
              // performance cost of staying off the GPU layer is negligible
              // and the crisper text is worth it.
              force3D: false,
            })
            gsap.to(icon, {
              backgroundColor: isActive ? ACTIVE_ICON_BG : IDLE_ICON_BG,
              color: isActive ? ACTIVE_ICON_FG : IDLE_ICON_FG,
              duration: 0.35,
              overwrite: "auto",
            })
            // Partnership carries a second, peeking circle behind the icon
            // badge — it swaps in the opposite direction so the two colors
            // always read as a matched pair.
            const extraCircle = extraCircleRefs.current[i]
            if (ITEMS[i].variant === "partnership" && extraCircle) {
              gsap.to(extraCircle, {
                backgroundColor: isActive ? IDLE_ICON_BG : ACTIVE_ICON_BG,
                duration: 0.35,
                overwrite: "auto",
              })
            }
          })
        }

        // Geometry is measured once per refresh and cached in document
        // space. Reading getBoundingClientRect inside onUpdate forces a
        // layout on every scroll frame, and that sync layout — interleaved
        // with the transforms GSAP writes the same frame — is what makes the
        // travel feel steppy. Everything below is arithmetic on cached
        // numbers, so the scroll frame stays read-free.
        let pinTop = 0
        let itemCenters: number[] = []
        let trackHeight = 0

        const measure = () => {
          const scrollY = window.scrollY
          pinTop = pin.getBoundingClientRect().top + scrollY
          trackHeight = ballTrack.offsetHeight
          itemCenters = items.map((item) => {
            if (!item) return Infinity
            const rect = item.getBoundingClientRect()
            // Cards carry their own scrubbed `y`, so subtract it to get the
            // resting position — otherwise a card measured mid-entrance
            // would be cached 32px off.
            const offset = Number(gsap.getProperty(item, "y")) || 0
            return rect.top + scrollY - offset + rect.height / 2
          })
        }

        const updateActive = () => {
          // The wrapper's `y` is the tween's own value, so the ball's
          // position comes straight from it — no measuring required.
          const trackY = Number(gsap.getProperty(ballTrack, "y"))
          const ballCenter = pinTop + trackY + trackHeight / 2

          let closest = 0
          let closestDist = Infinity
          itemCenters.forEach((center, i) => {
            const dist = Math.abs(center - ballCenter)
            if (dist < closestDist) {
              closestDist = dist
              closest = i
            }
          })
          setActive(closest)
        }

        itemRefs.current.forEach((item) => {
          if (!item) return
          gsap.set(item, { x: motion.baseX, y: 0, opacity: 1 })
        })

        // The ball holds the viewport center. It stays an ordinary
        // absolutely-positioned child — a ScrollTrigger `pin` uses
        // position:fixed, which escapes the section's overflow-hidden and
        // paints over the next section.
        //
        // Holding the viewport center is a *linear* function of scroll, so
        // it's expressed as a plain scrubbed tween rather than recomputing
        // getBoundingClientRect and writing transforms every frame. GSAP
        // interpolates it on its own rAF and the `scrub` easing absorbs the
        // sub-pixel noise between scroll deltas — that noise is what showed
        // up as jitter.
        const ballHeight = () => ballTrack.offsetHeight
        const drift = () => window.innerHeight * motion.drift
        const startY = () =>
          -window.innerHeight / 2 - ballHeight() / 2 - drift()
        const endY = () =>
          window.innerHeight / 2 + pin.offsetHeight - ballHeight() / 2 + drift()

        // `y` rides on the wrapper so the stroke travels with the ball;
        // `rotation` stays on the ball alone so the path doesn't spin.
        gsap.fromTo(
          ballTrack,
          { y: startY },
          {
            y: endY,
            ease: "none",
            // Driven off the tween, not the ScrollTrigger: with `scrub` the
            // tween keeps easing for a few frames after the scroll stops, and
            // the active card has to track where the ball actually is.
            onUpdate: updateActive,
            scrollTrigger: {
              id: "coming-soon-ball",
              trigger: pin,
              start: "top bottom",
              end: "bottom top",
              // A longer scrub lets GSAP ease toward the scroll position
              // over several frames instead of snapping to each delta, which
              // is what turns a trackpad's coarse steps into a glide.
              scrub: 1,
              invalidateOnRefresh: true,
              onRefresh: () => {
                measure()
                updateActive()
              },
            },
          }
        )

        // The spin is deliberately not tied to scroll — the ball keeps
        // turning at a constant rate whether the page moves or not. Only its
        // vertical travel above is scroll-driven.
        gsap.to(ball, {
          rotation: 360,
          duration: 9,
          ease: "none",
          repeat: -1,
        })

        // Clicking a card scrolls to whatever scroll position puts the ball
        // exactly at that card's height — i.e. the same alignment `updateActive`
        // already computes on scroll, just solved in reverse. `measure()` is
        // re-run so the click works even if the layout shifted since the last
        // scroll (e.g. after a resize).
        const scrollToItem = (index: number) => {
          measure()
          const st = ScrollTrigger.getById("coming-soon-ball")
          const center = itemCenters[index]
          if (!st || !Number.isFinite(center)) return
          const targetTrackY = center - pinTop - trackHeight / 2
          const progress = gsap.utils.clamp(
            0,
            1,
            (targetTrackY - startY()) / (endY() - startY())
          )
          window.scrollTo({
            top: gsap.utils.interpolate(st.start, st.end, progress),
            behavior: "smooth",
          })
        }
        scrollToItemRef.current = scrollToItem

        return () => {
          scrollToItemRef.current = (index) => {
            itemRefs.current[index]?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            })
          }
        }
      }

      mm.add("(min-width: 1024px)", setup(DESKTOP_MOTION))
      mm.add("(max-width: 1023px)", setup(MOBILE_MOTION))

      return () => mm.revert()
    },
    { scope: sectionRef }
  )

  return (
    <section
      id="soon"
      ref={sectionRef}
      className="border-pp-ink/10 bg-pp-tan relative scroll-mt-(--nav-h) overflow-hidden border-t px-5 py-16 lg:px-12 lg:py-24"
    >
      <div
        data-parallax-slow
        className="bg-pp-lime/20 pointer-events-none absolute -top-24 -right-24 size-72 rounded-full blur-3xl"
        aria-hidden
      />
      <div
        data-parallax-slow
        className="bg-pp-ink/5 pointer-events-none absolute top-1/3 -left-20 size-80 rounded-full blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex max-w-[1240px] flex-col gap-6 lg:gap-8">
        <div className="flex flex-col gap-4">
          <h2
            className="text-pp-ink m-0 max-w-[20ch] leading-[0.95] font-black tracking-[-0.025em] text-balance uppercase"
            style={{ fontSize: "clamp(44px, 6.2vw, 84px)" }}
          >
            <VariableWeightText
              text="More than a court."
              staggerTiming={HEADLINE_STAGGER}
              animationConfig={HEADLINE_ANIM}
            />
          </h2>
          <p className="text-pp-charcoal/80 m-0 max-w-[52ch] text-base leading-relaxed font-medium lg:text-lg">
            The courts are open now. Here&apos;s what lands next at Paddle Power
            Cebu.
          </p>
        </div>

        <div ref={pinRef} className="relative">
          {/* The box spans the ball's whole travel, not just the pin: it
              starts half a viewport above the pin and ends half a viewport
              below, exactly like the ball's `startY`/`endY`. Both therefore
              begin off-screen and are clipped by the section's
              overflow-hidden, and because the stroke is stretched over that
              same span (preserveAspectRatio="none") its tip stays level with
              the ball across the full scroll — no draw-window offset needed.
              It's pushed right of the section edge so the opening loop reads
              as coming in from outside.

              Two instances rather than one: `to` has to differ per breakpoint
              and it's a render-time prop, not a class. The draw is a fraction
              of the path's *arc* length, but the tip has to keep pace with a
              *vertical* scroll — and on a narrow box the path's horizontal
              loops are squeezed flat, so the same fraction covers far more
              vertical ground. Mobile therefore draws a shorter span over the
              same scroll so the tip doesn't run ahead of the ball. */}
          <SvgFollowScroll
            target={pinRef}
            strokeWidth={14}
            from={0}
            to={0.62}
            preserveAspectRatio="none"
            className="pointer-events-none absolute -top-[50vh] -right-[22%] block h-[calc(100%+100vh)] w-[78%] opacity-25 mix-blend-multiply sm:w-[68%] lg:hidden"
          />
          <SvgFollowScroll
            target={pinRef}
            strokeWidth={14}
            from={0}
            to={0.95}
            preserveAspectRatio="none"
            className="pointer-events-none absolute -top-[50vh] -right-[16%] hidden h-[calc(100%+100vh)] w-[58%] opacity-30 mix-blend-multiply lg:block"
          />

          <div
            ref={ballTrackRef}
            className="pointer-events-none absolute top-0 right-0 left-auto z-10 size-24 will-change-transform sm:size-32 lg:right-auto lg:left-[calc(50%+280px)] lg:size-48"
          >
            <div ref={ballRef} className="relative size-full">
              <BallViewer
                interactive={false}
                spinSpeed={0}
                tiltDegrees={-10}
                className="size-full drop-shadow-2xl"
              />
            </div>
          </div>

          <TooltipProvider delayDuration={150}>
            <div
              ref={listRef}
              /* The right gutter is the ball's lane — cards stop short of it so
               the two never overlap on narrow screens. */
              className="flex flex-col items-center gap-8 py-[10vh] pr-[88px] sm:gap-10 sm:pr-[124px] lg:gap-14 lg:py-[14vh] lg:pr-0"
            >
              {ITEMS.map((item, i) => {
                const iconBadgeRef = (el: HTMLSpanElement | null) => {
                  iconRefs.current[i] = el
                }
                const badgeClass =
                  "flex size-12 shrink-0 items-center justify-center rounded-full bg-pp-ink text-pp-cream"

                const cardBody = (
                  <div
                    key={item.title}
                    ref={(el) => {
                      itemRefs.current[i] = el
                    }}
                    className="w-full max-w-xl cursor-pointer will-change-transform backface-hidden"
                    role="button"
                    tabIndex={0}
                    aria-label={
                      item.variant === "partnership"
                        ? `${item.title}: message us on Instagram`
                        : `Jump to ${item.title}`
                    }
                    onClick={() => handleCardActivate(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleCardActivate(i)
                      }
                    }}
                  >
                    {item.variant === "membership" && (
                      <div className="bg-pp-ink text-pp-cream relative overflow-hidden rounded-3xl p-5 sm:p-6 lg:p-8">
                        <div className="mb-6 flex items-start justify-between">
                          <span className="text-pp-cream/45 text-[11px] font-bold tracking-[0.16em] uppercase">
                            Club Member
                          </span>
                          <span ref={iconBadgeRef} className={badgeClass}>
                            <item.icon className="size-5" aria-hidden />
                          </span>
                        </div>
                        <h3 className="mb-1.5 text-lg font-bold tracking-[-0.01em] sm:text-xl lg:text-2xl">
                          {item.title}
                        </h3>
                        <p className="text-pp-cream/65 mb-7 text-sm leading-relaxed font-medium lg:text-base">
                          {item.body}
                        </p>
                        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
                          <span className="text-pp-cream/35 font-mono text-[11px] tracking-[0.18em] sm:text-xs sm:tracking-[0.2em]">
                            •••• •••• 4471
                          </span>
                          <StatusPill live={item.live} variant="outline" />
                        </div>
                      </div>
                    )}

                    {item.variant === "lesson" && (
                      <div
                        className="bg-pp-cream ring-pp-ink/5 relative rounded-2xl p-5 pt-8 shadow-sm ring-1 sm:p-6 sm:pt-9 lg:p-8 lg:pt-10"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(transparent 0 27px, rgba(17,17,17,0.07) 27px 28px)",
                          backgroundPositionY: "58px",
                        }}
                      >
                        <div
                          className="bg-pp-ink/80 absolute -top-2.5 left-1/2 h-4 w-14 -translate-x-1/2 rounded-full"
                          aria-hidden
                        />
                        <div className="mb-3 flex items-center gap-2.5">
                          <span
                            ref={iconBadgeRef}
                            className="bg-pp-ink text-pp-cream flex size-9 shrink-0 items-center justify-center rounded-lg"
                          >
                            <item.icon className="size-4" aria-hidden />
                          </span>
                          <span className="text-pp-charcoal/50 font-mono text-[10px] tracking-[0.15em] uppercase">
                            Session Plan
                          </span>
                        </div>
                        <h3 className="text-pp-ink mb-2.5 text-lg font-bold tracking-[-0.01em] sm:text-xl lg:text-2xl">
                          {item.title}
                        </h3>
                        <p className="text-pp-charcoal/70 mb-5 text-sm leading-relaxed font-medium lg:text-base">
                          {item.body}
                        </p>
                        <StatusPill live={item.live} variant="filled" />
                      </div>
                    )}

                    {item.variant === "ticket" && (
                      <div className="bg-pp-cream flex overflow-hidden rounded-2xl">
                        <div
                          className="flex-1 p-5 sm:p-6 lg:p-7"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle 7px at 100% 22%, #e8d8c2 99%, transparent 100%), radial-gradient(circle 7px at 100% 78%, #e8d8c2 99%, transparent 100%)",
                          }}
                        >
                          <span className="text-pp-charcoal/50 mb-1 block font-mono text-[10px] tracking-[0.15em] uppercase">
                            Event Pass · No. 0217
                          </span>
                          <h3 className="text-pp-ink mb-1.5 text-lg font-bold tracking-[-0.01em] sm:text-xl lg:text-2xl">
                            {item.title}
                          </h3>
                          <p className="text-pp-charcoal/70 text-sm leading-relaxed font-medium lg:text-base">
                            {item.body}
                          </p>
                        </div>
                        <div
                          className="border-pp-ink/15 w-0 border-l-2 border-dashed"
                          aria-hidden
                        />
                        <div
                          ref={(el) => {
                            iconRefs.current[i] = el
                          }}
                          className="bg-pp-ink text-pp-cream flex w-16 shrink-0 flex-col items-center justify-center gap-2 p-3 sm:w-20 lg:w-24"
                        >
                          <item.icon className="size-6" aria-hidden />
                          <span className="text-center text-[9px] leading-tight font-bold tracking-[0.08em] uppercase">
                            {item.live ? "Live now" : "Coming soon"}
                          </span>
                        </div>
                      </div>
                    )}

                    {item.variant === "cafe" && (
                      <div className="bg-pp-cream rounded-3xl p-5 sm:p-6 lg:p-8">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-pp-ink text-lg font-bold tracking-[-0.01em] sm:text-xl lg:text-2xl">
                            {item.title}
                          </h3>
                          <StatusPill live={item.live} variant="dashed" />
                        </div>
                        <p className="text-pp-charcoal/70 mb-5 text-sm leading-relaxed font-medium lg:text-base">
                          {item.body}
                        </p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          {[0, 1, 2].map((n) => (
                            <span
                              key={n}
                              ref={n === 0 ? iconBadgeRef : undefined}
                              className="bg-pp-ink text-pp-cream flex size-7 items-center justify-center rounded-full sm:size-8"
                            >
                              <item.icon className="size-3.5" aria-hidden />
                            </span>
                          ))}
                          {[4, 5, 6].map((n) => (
                            <span
                              key={n}
                              className="border-pp-ink/20 text-pp-charcoal/50 flex size-7 items-center justify-center rounded-full border border-dashed text-[11px] font-semibold sm:size-8"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.variant === "proshop" && (
                      <div className="bg-pp-cream relative rounded-3xl p-5 sm:p-6 lg:p-8">
                        <div className="mb-4 flex items-center gap-3">
                          <span ref={iconBadgeRef} className={badgeClass}>
                            <item.icon className="size-5" aria-hidden />
                          </span>
                          <h3 className="text-pp-ink text-lg font-bold tracking-[-0.01em] sm:text-xl lg:text-2xl">
                            {item.title}
                          </h3>
                        </div>
                        <p className="text-pp-charcoal/70 mb-5 text-sm leading-relaxed font-medium lg:text-base">
                          {item.body}
                        </p>
                        <StatusPill live={item.live} variant="dashed" />
                      </div>
                    )}

                    {item.variant === "partnership" && (
                      <div className="bg-pp-cream rounded-3xl p-5 sm:p-6 lg:p-8">
                        <div className="mb-4 flex items-center gap-0.5">
                          <span
                            ref={iconBadgeRef}
                            className={`${badgeClass} relative z-10`}
                          >
                            <item.icon className="size-5" aria-hidden />
                          </span>
                          <span
                            ref={(el) => {
                              extraCircleRefs.current[i] = el
                            }}
                            className="bg-pp-lime relative z-0 -ml-3.5 size-11 rounded-full"
                            aria-hidden
                          />
                        </div>
                        <h3 className="text-pp-ink mb-1.5 text-lg font-bold tracking-[-0.01em] sm:text-xl lg:text-2xl">
                          {item.title}
                        </h3>
                        <p className="text-pp-charcoal/70 mb-5 text-sm leading-relaxed font-medium lg:text-base">
                          {item.body}
                        </p>
                        <div className="border-pp-ink/15 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 border-t border-dashed pt-3.5">
                          <span className="bg-pp-lime text-pp-ink w-fit shrink-0 rounded-full px-3.5 py-1.5 text-[10px] font-bold tracking-[0.14em] uppercase">
                            Contact Us
                          </span>
                          <div className="flex items-center gap-2">
                            <a
                              href={FACEBOOK_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Paddle Power Cebu on Facebook"
                              className="bg-pp-ink text-pp-cream hover:bg-pp-lime hover:text-pp-ink flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ease-out"
                            >
                              <FacebookIcon className="size-3.5" aria-hidden />
                            </a>
                            <a
                              href={INSTAGRAM_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Paddle Power Cebu on Instagram"
                              className="bg-pp-ink text-pp-cream hover:bg-pp-lime hover:text-pp-ink flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ease-out"
                            >
                              <InstagramIcon className="size-3.5" aria-hidden />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )

                if (item.variant === "partnership") return cardBody

                return (
                  <Tooltip
                    key={item.title}
                    open={openTipIndex === i}
                    onOpenChange={(open) => setOpenTipIndex(open ? i : null)}
                  >
                    <TooltipTrigger asChild>{cardBody}</TooltipTrigger>
                    <TooltipContent side="top">
                      Still coming soon!
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </section>
  )
}
