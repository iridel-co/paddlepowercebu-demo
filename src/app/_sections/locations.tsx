"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useInView, useReducedMotion } from "motion/react"

import { VariableWeightText } from "@/components/ui/variable-weight-text"
import { useMediaQuery } from "@/lib/use-media-query"

import { LiquidGlass } from "../_ui/liquid-glass"

/* Same chunk the paddle showcase pulls in further down the page, so whichever
   section the visitor reaches first warms it for the other. */
const PaddleViewer = dynamic(
  () => import("@/lib/paddle3d/paddle-viewer").then((m) => m.PaddleViewer),
  { ssr: false }
)
const BallViewer = dynamic(
  () => import("@/lib/paddle3d/ball-viewer").then((m) => m.BallViewer),
  { ssr: false }
)

/**
 * Locations / Book — the page's conversion section.
 *
 * Built from the Claude Design file `Court Booking Choice.dc.html`: the two
 * branches are the two sides of a single pickleball court, so choosing a
 * branch is literally picking a side. One tap per half, straight to Ondafit —
 * no location picker step in between.
 *
 * The surface matches the court in the hero rally frames — green service
 * zones, cream kitchen, cream tape — so the page only ever shows one court.
 * The CTA is the brand lime.
 *
 * Orientation flips with the viewport. The court is drawn once and the bands,
 * the net, and the two half-links all swap axis at `lg` — a 44:20 court is
 * unreadable on a phone, so below `lg` it stands on its baseline instead.
 */

const BRANCHES = [
  {
    name: "AS Fortuna",
    /* Sits above the net on mobile, left of it on desktop. */
    side: "North Branch",
    meta: "24/7 · Indoor · Solar-powered",
    /* TODO: replace with client's Ondafit booking link — AS Fortuna */
    bookingUrl: "#",
    /* TODO: replace with client's actual pin — placeholder AS Fortuna, Mandaue */
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=AS+Fortuna+Mandaue+Cebu",
  },
  {
    name: "Talisay",
    side: "South Branch",
    meta: "24/7 · Indoor · Solar-powered",
    /* TODO: replace with client's Ondafit booking link — Talisay */
    bookingUrl: "#",
    /* TODO: replace with client's actual pin — placeholder Talisay, Cebu */
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Talisay+Cebu",
  },
] as const

/* Court tape. 3px reads right at desktop width and doesn't disappear at 350px. */
const LINE = "bg-pp-cream"

/**
 * Per-branch placement. `frame` is the half itself — near side is the top of
 * the court on mobile and its left at `lg`.
 *
 * At `lg` the card centres in that half's outer service box: 34.1% in from the
 * baseline, which from the half's own left edge is 34.1% for the near side and
 * 65.9% for the far one. Below `lg` there's no paddle in the corner to sit
 * clear of and the halves are short, so the card just centres in its own half —
 * the two then read as evenly mirrored across the net on a phone.
 *
 * Whole strings, never interpolated fragments — Tailwind only sees literals.
 */
const HALVES = {
  "AS Fortuna": {
    frame: "top-0 lg:inset-y-0 lg:right-auto lg:left-0",
    card: "top-1/2 lg:left-[34.1%]",
    /* Near side comes forward: rotateX(-) lifts the top edge out of the
       screen, rotateY(+) swings the left edge out. Axis follows the layout. */
    tilt: "-rotate-x-3 lg:rotate-x-0 lg:rotate-y-4",
  },
  Talisay: {
    frame: "bottom-0 lg:inset-y-0 lg:right-0 lg:left-auto",
    card: "top-1/2 lg:left-[65.9%]",
    tilt: "rotate-x-3 lg:rotate-x-0 lg:-rotate-y-4",
  },
} as const

type BranchName = (typeof BRANCHES)[number]["name"]

/* Fast enough to land as a single gesture rather than a per-letter crawl.
   Module-level so the object keeps one identity across renders. */
const HEADLINE_STAGGER = 0.014
const HEADLINE_ANIM = { type: "spring", duration: 0.35, bounce: 0 } as const
/* Character count of "Two branches." plus its trailing space, at the shared
   stagger — where the second half of the headline picks the sweep back up. */
const SECOND_LINE_DELAY = 13 * HEADLINE_STAGGER
/* Scrolling back out plays the same sweep in reverse: "One tap." unwinds
   first, from its last character, and the first line follows. Mirroring the
   entrance means the first line waits out the gap between the two spans —
   "One tap." (7 letters) finishes at SECOND_LINE_DELAY + 6 stagger steps, and
   "Two branches." (12 letters) needs 11 of its own. */
const FIRST_LINE_EXIT_DELAY = SECOND_LINE_DELAY + (6 - 11) * HEADLINE_STAGGER

export function DemoLocations() {
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  /* The headline sweeps once the section itself owns the viewport, not the
     moment its first line clears the fold. Not `once` — dropping below the
     threshold unwinds the weight so the next scroll-in plays it again. */
  const sectionInView = useInView(sectionRef, { amount: 0.5 })
  /* The section is far taller than the headline, so it can still own half the
     viewport long after the headline has scrolled off. Gating on the heading
     too means the reverse sweep runs while the words are still on screen,
     going out — the entrance stays section-timed because the heading is
     already in view by the time the section crosses its own threshold. */
  const headingInView = useInView(headingRef, { amount: 0.9 })
  /* Deliberately earlier than `sectionInView`, and separate from it so the
     headline's timing stays untouched. The paddle costs ~1.9s of synchronous
     geometry construction on first build, so waiting until the section owns
     half the viewport meant the visitor watched an empty court while the main
     thread worked. Starting a viewport ahead lets the build overlap the scroll
     that brings them here. */
  const paddleApproaching = useInView(sectionRef, {
    margin: "100% 0px 100% 0px",
  })
  const headlinePlaying = sectionInView && headingInView
  const [replaySignal, setReplaySignal] = useState(0)
  /* Which half the pointer is over. Drives the court's tilt so the hovered
     side reads as the near side of a real court. Gated in JS rather than with
     a `motion-reduce:` variant: the tilt classes land in the `lg` block, which
     always wins the cascade against an unprefixed reset. */
  const reducedMotion = useReducedMotion()
  const [hovered, setHovered] = useState<BranchName | null>(null)
  const tilt = hovered && !reducedMotion ? HALVES[hovered].tilt : ""

  /* Ball hover logic, ported from the Claude Design file's `enter`/`leave`
     state machine: switching sides while the ball is already in play sends it
     straight across the net, ping-ponging between the two corners, and every
     entry gives the paddle a 360ms "swing" kick. Spin keeps accumulating
     rather than resetting, so it never snaps backwards mid-turn.
     `prevHoveredRef` reads the side *before* this entry, since `hovered`
     itself hasn't updated yet. */
  const prevHoveredRef = useRef<BranchName | null>(null)
  const swingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const arcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [swinging, setSwinging] = useState<BranchName | null>(null)
  const [spin, setSpin] = useState(0)
  /* True only while the ball is mid-crossing. Swaps its idle infinite float
     for the one-shot `pp-ball-arc` rise-and-settle so the two animations
     never run on the same element at once — that overlap was what read as
     jitter along the path. */
  const [arcing, setArcing] = useState(false)

  const clearBallTimers = () => {
    if (swingTimerRef.current) clearTimeout(swingTimerRef.current)
    if (arcTimerRef.current) clearTimeout(arcTimerRef.current)
  }
  useEffect(() => clearBallTimers, [])

  const enterSide = (side: BranchName) => {
    if (prevHoveredRef.current === side) return
    const traveling =
      prevHoveredRef.current !== null && prevHoveredRef.current !== side
    clearBallTimers()
    prevHoveredRef.current = side
    setHovered(side)
    setSwinging(side)
    setSpin((s) => s + (traveling ? 620 : 100))
    setArcing(traveling)
    if (traveling) arcTimerRef.current = setTimeout(() => setArcing(false), 520)
    swingTimerRef.current = setTimeout(() => setSwinging(null), 360)
  }

  const leaveCourt = () => {
    clearBallTimers()
    prevHoveredRef.current = null
    setHovered(null)
    setSwinging(null)
    setArcing(false)
  }

  /* The paddle is a single viewer that slides across the net rather than one
     per half — a WebGL context is far too expensive to stand up twice, and
     sliding is what sells the switch anyway. Mounted only once the section
     owns the viewport: three.js and its PBR maps are the heaviest thing on the
     site, and this section sits directly under the hero's frame sequence.
     Once mounted it stays, so the second hover is instant. */
  const [paddleMounted, setPaddleMounted] = useState(false)
  useEffect(() => {
    if (paddleApproaching) setPaddleMounted(true)
  }, [paddleApproaching])

  /* The paddles and the ball only ever show at `lg` — but a `hidden lg:block`
     wrapper hides them without stopping them: `display: none` still runs the
     effects inside, so a phone stood up three WebGL contexts, fetched the ten
     PBR maps behind them (~460KB), and paid the paddle's geometry build, all
     for a subtree it never paints. The breakpoint has to be a real condition on
     mounting, not a class. */
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const showCourtProps = paddleMounted && isDesktop

  return (
    <section
      id="locations"
      ref={sectionRef}
      className="border-pp-ink/10 flex min-h-svh scroll-mt-(--nav-h) flex-col justify-center border-t bg-white px-5 pt-20 pb-24 lg:px-12 lg:pt-24 lg:pb-36"
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-12 lg:gap-16">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Both halves share one trigger and one hover target so the weight
              sweep reads as a single pass across the whole line. */}
          <h2
            ref={headingRef}
            className="text-pp-ink m-0 max-w-[18ch] leading-[0.95] tracking-[-0.025em] text-balance uppercase lg:max-w-none lg:whitespace-nowrap"
            style={{ fontSize: "clamp(44px, 6.2vw, 84px)" }}
            onPointerEnter={() => setReplaySignal((n) => n + 1)}
          >
            <VariableWeightText
              text="Two branches."
              play={headlinePlaying}
              replaySignal={replaySignal}
              hover={false}
              staggerTiming={HEADLINE_STAGGER}
              animationConfig={HEADLINE_ANIM}
              exitDelay={FIRST_LINE_EXIT_DELAY}
            />{" "}
            <VariableWeightText
              text="One tap."
              className="text-pp-lime-light"
              play={headlinePlaying}
              replaySignal={replaySignal}
              hover={false}
              staggerTiming={HEADLINE_STAGGER}
              animationConfig={HEADLINE_ANIM}
              startDelay={SECOND_LINE_DELAY}
            />
          </h2>
          <p className="text-pp-charcoal/80 m-0 max-w-[52ch] text-base leading-relaxed font-medium text-pretty lg:text-lg">
            Booking runs through Ondafit. Pick your side, pick your slot, play.
            No account, no waiting on a reply.
          </p>
        </div>

        {/* ── The court ──────────────────────────────────────────────────── */}
        {/* Aspect is picked so a service zone (34.09% of the court) is always
            taller than the card sitting in it, with the hover scale applied —
            at 390px that needs ~17 units of height per 10 of width, and the
            narrow end of `sm` (640px) needs a square. A real 44:20 court only
            fits at `lg`, where the zone is wide enough for the card too. */}
        {/* Perspective lives on the wrapper so the court can tilt inside it
            without the vanishing point moving with the rotation. Distance is
            long enough that a 4° swing reads as depth, not as a fisheye. */}
        <div className="perspective-[1600px] perspective-origin-center">
          <div
            onPointerLeave={leaveCourt}
            onMouseLeave={leaveCourt}
            className={`relative aspect-10/18 w-full transition-transform duration-500 ease-out transform-3d motion-reduce:transition-none sm:aspect-square lg:aspect-44/20 ${tilt}`}
          >
            {/* Playing surface: service zone / kitchen / service zone. */}
            <div className="border-pp-cream ring-pp-ink/10 absolute inset-0 flex flex-col border-[3px] ring-1 lg:flex-row">
              <div className="bg-pp-court relative h-[34.09%] w-full lg:h-full lg:w-[34.09%]">
                {/* Centre service line — long axis of the court. */}
                <div
                  className={`absolute top-0 bottom-0 left-1/2 -ml-[1.5px] w-[3px] lg:top-1/2 lg:right-0 lg:bottom-auto lg:left-0 lg:-mt-[1.5px] lg:ml-0 lg:h-[3px] lg:w-auto ${LINE}`}
                />
              </div>

              {/* Kitchen (non-volley zone), taped on both of its long edges. */}
              <div className="bg-pp-tan relative h-[31.82%] w-full lg:h-full lg:w-[31.82%]">
                <div
                  className={`absolute top-0 right-0 left-0 h-[3px] lg:top-0 lg:right-auto lg:bottom-0 lg:left-0 lg:h-auto lg:w-[3px] ${LINE}`}
                />
                <div
                  className={`absolute right-0 bottom-0 left-0 h-[3px] lg:top-0 lg:right-0 lg:bottom-0 lg:left-auto lg:h-auto lg:w-[3px] ${LINE}`}
                />
              </div>

              <div className="bg-pp-court relative h-[34.09%] w-full lg:h-full lg:w-[34.09%]">
                <div
                  className={`absolute top-0 bottom-0 left-1/2 -ml-[1.5px] w-[3px] lg:top-1/2 lg:right-0 lg:bottom-auto lg:left-0 lg:-mt-[1.5px] lg:ml-0 lg:h-[3px] lg:w-auto ${LINE}`}
                />
              </div>
            </div>

            {/* Two independent paddles, one per branch, parked at its own
                corner — not one viewer sliding between corners. Both mount
                once and scale/lift in when their own side is hovered.
                Hidden state is `scale-0`, never `opacity-0`: an alpha canvas
                shrunk to nothing has no translucent in-between frame the way
                a fading one does, so the paddle only ever reads as fully
                solid or fully gone. Their own branch card lifts out of the
                way at the same time (see `cardLift` below), so the paddle
                never fights the card for the same pixels.

                Desktop only, and two live WebGL contexts instead of one —
                a deliberate trade for reading as two real paddles rather
                than a single one sliding across. No corner whitespace to
                spare on the vertical mobile layout, and no hover there
                either. */}
            {showCourtProps &&
              BRANCHES.map((branch) => {
                const isActive = hovered === branch.name
                const sign = branch.name === "Talisay" ? -1 : 1
                const anchor =
                  branch.name === "Talisay"
                    ? "bottom-0 right-0 translate-x-[26%]"
                    : "bottom-0 left-0 -translate-x-[26%]"
                return (
                  <div
                    key={branch.name}
                    aria-hidden
                    className={`pointer-events-none absolute z-35 hidden h-[104%] w-[58%] translate-y-[34%] lg:block ${anchor}`}
                  >
                    <div
                      className="h-full w-full origin-bottom transition-[opacity,transform] duration-500 ease-out"
                      style={{
                        opacity: isActive ? 1 : 0,
                        /* Entrance reads as coming in from this branch's own
                           edge of the screen — left for AS Fortuna, right for
                           Talisay — rather than rising from the bottom
                           centre. `sign` is +1 for the left side and -1 for
                           the right, so `-sign` pushes each paddle off toward
                           its own edge when inactive. The spin is signed too
                           (`-78 * sign`), so the two sides unwind in opposite
                           directions — Talisay counter-clockwise, AS Fortuna
                           clockwise — like two hands mirrored across the net
                           rather than both spinning the same way. */
                        transform: isActive
                          ? "translateX(0) translateY(0) rotate(0deg)"
                          : `translateX(${-sign * 90}%) translateY(1rem) rotate(${-78 * sign}deg)`,
                      }}
                    >
                      {/* The swing angle, straight from the design's
                          `lAngle`/`rAngle`: 4° while `swinging` (the
                          snap-open on entry), easing to 24° once it settles
                          into the ready stance — leaning toward the net.
                          Signed per side so it keeps unwinding the same
                          direction as the entrance rotate above rather than
                          fighting it. Composes with the entrance rotate
                          rather than replacing it, so the paddle reads as one
                          continuous swing into the ready stance rather than
                          growing from nothing. Its own layer so it doesn't
                          fight the float keyframes, which also animate
                          `transform`. No baked-in ball here — the ball is
                          its own independently-animated element below,
                          driven by the same state machine. */}
                      <div
                        className="h-full w-full transition-transform duration-500 ease-out motion-reduce:transition-none"
                        style={{
                          transform: isActive
                            ? `rotate(${(swinging === branch.name ? 4 : 24) * sign}deg)`
                            : "rotate(0deg)",
                        }}
                      >
                        <div className="h-full w-full animate-[pp-paddle-float_6.5s_ease-in-out_infinite] motion-reduce:animate-none">
                          <PaddleViewer
                            className="h-full w-full"
                            spinSpeed={0}
                            swayDegrees={9}
                            swayPeriod={8}
                            interactive={false}
                            initialAzimuth={-22}
                            /* Both paddles stay mounted so the second hover is
                               instant, but the one at rest sits at opacity 0 —
                               it has no business swaying and redrawing at
                               60fps while it's invisible. */
                            paused={!isActive}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}

            {/* The ball: rests against the paddle face — same corner, same
                slide — rather than floating free in the kitchen, so the two
                read as one object at rest. A side switch sends it straight
                across the net in a single ping-pong slide (no separate lift
                or scale), spinning throughout. z-40 so it clears the net
                (z-30) and the paddle (z-35) mid-slide, though it still sits
                under the cards (z-50), which stay topmost throughout.
                Desktop only, same gate as the paddle. */}
            {showCourtProps && (
              <div
                aria-hidden
                className="pointer-events-none absolute z-40 hidden aspect-square w-[9%] -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-520 ease-out lg:block"
                style={{
                  left: hovered === "Talisay" ? "72%" : "28%",
                  top: hovered ? "55%" : "72%",
                }}
              >
                <div
                  className="h-full w-full transition-opacity duration-300 ease-out"
                  style={{ opacity: hovered ? 1 : 0 }}
                >
                  {/* While crossing, a single up/down arc timed to the 520ms
                      slide above. At rest against the paddle face, the same
                      idle bob the paddle uses, on its own shorter period
                      since the ball is the smaller object. Never both at
                      once — see `arcing` above. This layer sits *outside*
                      the spin div below, not inside it — its translateY has
                      to stay in screen space. Nested inside the spin, the
                      "up" direction would rotate along with the hundreds of
                      degrees of spin, twisting a clean vertical arc into a
                      wobble. */}
                  <div
                    className={
                      arcing
                        ? "h-full w-full animate-[pp-ball-arc_520ms_ease-in-out_1] motion-reduce:animate-none"
                        : "h-full w-full animate-[pp-paddle-float_4s_ease-in-out_infinite] motion-reduce:animate-none"
                    }
                  >
                    <div
                      className="h-full w-full transition-transform duration-520 ease-linear"
                      style={{ transform: `rotate(${spin}deg)` }}
                    >
                      <BallViewer
                        className="h-full w-full"
                        spinSpeed={30}
                        interactive={false}
                        /* Only in play while a side is hovered; the rest of the
                           time it is a transparent canvas spinning for nobody. */
                        paused={!hovered}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Net — overhangs the sideline by 4.5% at both posts, as a real one does. */}
            <div className="pointer-events-none absolute top-1/2 -right-[4.5%] -left-[4.5%] z-30 -mt-[2.5px] h-[5px] bg-[linear-gradient(180deg,rgba(17,17,17,0.35),rgba(17,17,17,0.6))] lg:top-[-4.5%] lg:bottom-[-4.5%] lg:left-1/2 lg:-ml-[2.5px] lg:h-auto lg:w-[5px] lg:bg-[linear-gradient(90deg,rgba(17,17,17,0.35),rgba(17,17,17,0.6))]">
              {/* Mesh. */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(247,244,238,0.5)_0_1px,transparent_1px_4px)] lg:bg-[repeating-linear-gradient(0deg,rgba(247,244,238,0.5)_0_1px,transparent_1px_4px)]" />
              {/* Headband at each post. */}
              <div
                className={`absolute top-0 bottom-0 left-0 w-[2px] lg:top-0 lg:-right-px lg:bottom-auto lg:-left-px lg:h-[2px] lg:w-auto ${LINE}`}
              />
              <div
                className={`absolute top-0 right-0 bottom-0 w-[2px] lg:top-auto lg:-right-px lg:bottom-0 lg:-left-px lg:h-[2px] lg:w-auto ${LINE}`}
              />
            </div>

            {/* Two halves, two links. Each card sits in the centre of its own
              service box (34.1% in from the baseline), so the pair reads as
              mirrored across the net. */}
            {BRANCHES.map((branch) => {
              const half = HALVES[branch.name]
              /* Lifted clear of the paddle's now-larger corner whenever its
                 own side is hovered — `lg`-only, since the paddle only ever
                 shows there. The unprefixed `-translate-y-1/2` still centres
                 the card at every width below `lg`, and below `lg` no
                 `lg:-translate-y-*` class is present to win the cascade. */
              const cardLift =
                hovered === branch.name
                  ? "lg:-translate-y-[95%]"
                  : "lg:-translate-y-1/2"
              return (
                /* A <div>, not an <a> — the card now holds two real links
                   (Book, Get directions) and a link can't nest inside a
                   link. Whole-half click-to-book is kept as a progressive
                   enhancement on top of the Book link itself, which stays
                   the real, keyboard-reachable target. */
                <div
                  key={branch.name}
                  onClick={() => {
                    window.location.href = branch.bookingUrl
                  }}
                  /* Focus tilts the court too, so keyboard users get the same
                   read of which side they're about to book. Leave is handled
                   on the court container, not per element — moving straight
                   from one half to the other fires this `onPointerEnter`
                   before the old half's `onPointerLeave`, which would clear
                   `prevHoveredRef` and blind the ball's "traveling" check.
                   React's onFocus/onBlur bubble like focusin/focusout, so
                   focusing either link inside still fires these. */
                  onPointerEnter={() => enterSide(branch.name)}
                  onFocus={() => enterSide(branch.name)}
                  onBlur={() => leaveCourt()}
                  className={`group absolute right-0 left-0 z-50 h-1/2 cursor-pointer lg:h-full lg:w-1/2 ${half.frame}`}
                >
                  {/* Same liquid-glass panel the hero's copy block rides —
                    tinted darker than the hero's `bg-black/25`, since this one
                    sits on the bright court rather than a dim frame and the
                    copy inside has to stay legible against it. 20px radius is
                    the hero's.

                    The card is laid out at its *hovered* size and scaled
                    down at rest, never up — text is rasterised once at layout
                    size, so scaling past 1 blurs it while scaling back to 1
                    lands pixel-exact. Scale composes with the centring and
                    lift translate: Tailwind keeps `scale` and `translate` on
                    separate properties, so the card grows about its own centre
                    and stays pinned to its service box, only rising straight
                    up out of the paddle's way. */}
                  <LiquidGlass
                    borderRadius="20px"
                    blurIntensity="xl"
                    shadowIntensity="xs"
                    glowIntensity="sm"
                    className={`absolute left-1/2 w-[290px] max-w-[90%] origin-center -translate-x-1/2 -translate-y-1/2 bg-black/65 ${cardLift} scale-[0.95] transition-[scale,translate] duration-300 ease-out group-hover:scale-100 motion-reduce:transition-none lg:w-[306px] xl:w-[348px] ${half.card}`}
                  >
                    <div className="flex flex-col items-center gap-3 px-6 py-[18px] sm:gap-3.5 sm:py-5 lg:gap-4 lg:px-7 lg:py-6">
                      <span className="text-pp-lime-light text-[11px] font-bold tracking-[0.18em] uppercase lg:text-xs">
                        {branch.side}
                      </span>
                      <span className="text-[25px] leading-none font-black tracking-[-0.015em] text-white lg:text-[29px]">
                        {branch.name}
                      </span>
                      <span className="text-xs font-medium text-white/85 lg:text-[13px]">
                        {branch.meta}
                      </span>
                      <a
                        href={branch.bookingUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-pp-lime-light focus-visible:outline-pp-olive group-hover:bg-pp-cream group-hover:text-pp-ink mt-1 w-full rounded-full px-5 py-3.5 text-center text-[15px] font-bold text-white transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 lg:py-4 lg:text-base"
                      >
                        Book {branch.name}
                      </a>
                      <a
                        href={branch.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="focus-visible:outline-pp-olive inline-flex items-center gap-1.5 text-xs font-medium text-white/85 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 lg:text-[13px]"
                      >
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Get directions
                      </a>
                    </div>
                  </LiquidGlass>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
