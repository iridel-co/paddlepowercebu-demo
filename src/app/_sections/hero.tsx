"use client"

import * as React from "react"
import ReactDOM from "react-dom"
import { PillLink } from "../_ui/pill-link"
import { LiquidGlass } from "../_ui/liquid-glass"
import { VariableWeightText } from "@/components/ui/variable-weight-text"

/**
 * Hero — scroll-driven frame sequence behind the designed overlay.
 *
 * Frames were extracted from `public/herosection-video-scroll.mp4` with ffmpeg,
 * then compressed to WebP by `tools/optimize-assets.mjs` (halves the sequence):
 *   ffmpeg -i public/herosection-video-scroll.mp4 -q:v 3 public/frames/frame-%03d.jpg
 *   node tools/optimize-assets.mjs
 *
 * The section is TRACK_VH tall; a sticky viewport-height stage inside it paints
 * the frame matching scroll progress, so the rally scrubs as the user scrolls.
 * The header is a fixed overlay, so the stage pins at y=0 and the content
 * column carries its own top padding to clear it.
 */

const FRAME_COUNT = 55
const FRAME_WIDTH = 1280
const FRAME_HEIGHT = 720
/** Section height as a multiple of the viewport (svh) — more = slower scrub. */
const TRACK_VH = 240
/** Per-frame easing toward the scroll target — lower = smoother, laggier. */
const EASE = 0.12
/** Below this frame delta the follower snaps and the rAF loop parks. */
const SETTLE = 0.01
/** Track progress window over which the hero copy fades out. The frames keep
 *  scrubbing the whole way — only the overlay clears. */
const FADE_START = 0.42
const FADE_END = 0.7
/** Frames fetched at once after the first one lands. The sequence is ~1.1 MB;
 *  firing all 55 requests together starves the first frame — which is the only
 *  one standing between the visitor and a painted hero. */
const LOAD_CONCURRENCY = 6
/** Canvas widths under this px value paint the frame rotated a quarter turn.
 *  Matches Tailwind's `sm` breakpoint, where the layout also switches. */
const ROTATE_BELOW = 640
/** How far up the frame is nudged, as a fraction of the stage height. Raise to
 *  push the rally higher, 0 to centre it. */
const FOCUS_SHIFT = 0.05

const frameSrc = (index: number) =>
  `/frames/frame-${String(index + 1).padStart(3, "0")}.webp`

/* Same weight-sweep headline treatment as the Locations "Your court. One
   tap." heading — fast enough to land as one gesture rather than a per-letter
   crawl. Second line's delay lets the sweep read as a single continuous pass
   down from "Your court." into "Anytime." */
const HEADLINE_STAGGER = 0.014
const HEADLINE_ANIM = { type: "spring", duration: 0.35, bounce: 0 } as const
/* Each word is its own instance so phones can stack them one per line (see
   the `block sm:inline` wrappers below) while desktop keeps "Your court." on
   one line. Delays are the character offsets the words would have had inside
   a single instance, so the sweep still reads as one continuous pass. */
const WORD_TWO_DELAY = 5 * HEADLINE_STAGGER // after "Your "
const SECOND_LINE_DELAY = 12 * HEADLINE_STAGGER // after "Your court."

export function DemoHero() {
  const sectionRef = React.useRef<HTMLElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const framesRef = React.useRef<HTMLImageElement[]>([])
  /** Fractional frame actually on screen — eases toward the scroll target. */
  const currentFrameRef = React.useRef(0)
  const rafRef = React.useRef<number | null>(null)

  const [ready, setReady] = React.useState(false)

  // Hoisted into <head> during SSR, so frame 0 is in flight before the client
  // bundle has parsed. Nothing else on the page outranks it — it is the hero.
  ReactDOM.preload(frameSrc(0), { as: "image", fetchPriority: "high" })

  React.useEffect(() => {
    const canvas = canvasRef.current
    const section = sectionRef.current
    if (!canvas || !section) return

    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) return

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    let disposed = false

    const ready2d = (img: HTMLImageElement | undefined) =>
      !!img?.complete && img.naturalWidth > 0

    /**
     * Paint a fractional frame with cover-fit math against the canvas' CSS box.
     * The two neighbouring frames are cross-faded by the fractional part, which
     * hides the stepping you'd otherwise see with only FRAME_COUNT stills.
     */
    /**
     * Nearest frame that has actually decoded. Frames stream in after the first
     * one, so a fast scroll can reach an index that isn't there yet — showing
     * the closest one that is beats holding the previous paint.
     */
    const nearestLoaded = (index: number) => {
      if (ready2d(framesRef.current[index])) return index
      for (let step = 1; step < FRAME_COUNT; step += 1) {
        if (ready2d(framesRef.current[index - step])) return index - step
        if (ready2d(framesRef.current[index + step])) return index + step
      }
      return -1
    }

    const paint = (frame: number) => {
      const requested = Math.floor(frame)
      const base = nearestLoaded(requested)
      if (base < 0) return
      // Only cross-fade when the exact pair is on hand; a blend against a
      // substituted frame reads as a flicker.
      const blend = base === requested ? frame - requested : 0
      const imgA = framesRef.current[base]
      const imgB = framesRef.current[Math.min(base + 1, FRAME_COUNT - 1)]

      const { clientWidth: cw, clientHeight: ch } = canvas
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr
        canvas.height = ch * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Phones get the rally turned a quarter turn: the footage is a 16:9
      // top-down court, so cover-fitting it into a portrait box crops away
      // everything but the net. Rotated, the court runs down the screen and
      // both players stay in view. Top-down framing has no "up", so the
      // turn reads as camera orientation rather than a tipped image.
      const rotated = cw < ROTATE_BELOW

      // The rally sits a touch high rather than dead centre, which drops the
      // court clear of the headline. The frame is cover-fitted to a box that
      // is FOCUS_SHIFT taller than the stage on both sides, so lifting it by
      // that much still leaves material covering the bottom edge.
      const shift = ch * FOCUS_SHIFT
      // Screen-space box the frame has to cover. Rotated, the drawing space
      // turns with it, so the two axes swap.
      const boxW = rotated ? ch + shift * 2 : cw
      const boxH = rotated ? cw : ch + shift * 2

      const scale = Math.max(boxW / FRAME_WIDTH, boxH / FRAME_HEIGHT)
      const dw = FRAME_WIDTH * scale
      const dh = FRAME_HEIGHT * scale

      // Shift applied before the rotation, so it stays vertical on screen.
      ctx.translate(cw / 2, ch / 2 - shift)
      if (rotated) ctx.rotate(Math.PI / 2)
      const dx = -dw / 2
      const dy = -dh / 2

      ctx.globalAlpha = 1
      ctx.drawImage(imgA, dx, dy, dw, dh)
      if (blend > 0 && ready2d(imgB)) {
        ctx.globalAlpha = blend
        ctx.drawImage(imgB, dx, dy, dw, dh)
        ctx.globalAlpha = 1
      }
      currentFrameRef.current = frame
    }

    /**
     * 0 → 1 as the track scrolls past, clamped at both ends.
     *
     * `getBoundingClientRect` forces the browser to flush pending layout, so it
     * is read exactly once per animation frame and cached here for everything
     * downstream. It used to be called twice per scroll *event* — once for the
     * frame index, once for the copy fade — which put a synchronous layout in
     * the middle of the same frame that then wrote the fade's styles.
     */
    let progress = 0
    const readProgress = () => {
      const rect = section.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      progress =
        scrollable <= 0 ? 0 : Math.min(Math.max(-rect.top / scrollable, 0), 1)
      return progress
    }

    /** Map scroll position within the track to a fractional frame index. */
    const frameForScroll = () => progress * (FRAME_COUNT - 1)

    /**
     * Clear the copy off the rally partway through the track, so the section
     * scrolling over the top lands on bare footage. The canvas is untouched —
     * the frames keep scrubbing underneath the whole way. Driven straight off
     * scroll rather than the eased frame follower: the fade should track the
     * finger exactly.
     */
    const fade = () => {
      const content = contentRef.current
      if (!content || reduceMotion) return
      const p = Math.min(
        Math.max((progress - FADE_START) / (FADE_END - FADE_START), 0),
        1
      )
      content.style.opacity = String(1 - p)
      content.style.transform = `translate3d(0, ${p * -32}px, 0)`
      content.style.pointerEvents = p > 0.9 ? "none" : ""
    }

    /**
     * Runs while the follower is still catching up to the scroll target, then
     * parks itself. Easing decouples playback from raw scroll deltas, so a
     * flick of the wheel glides instead of jumping.
     */
    const update = () => {
      rafRef.current = null
      if (reduceMotion) {
        if (currentFrameRef.current !== 0) paint(0)
        return
      }

      readProgress()
      fade()

      const target = frameForScroll()
      const current = currentFrameRef.current
      const delta = target - current

      if (Math.abs(delta) < SETTLE) {
        if (current !== target) paint(target)
        return
      }

      paint(current + delta * EASE)
      rafRef.current = requestAnimationFrame(update)
    }

    /**
     * Scroll events do nothing but wake the loop. Everything that reads or
     * writes layout happens inside `update`, on the frame — a scroll listener
     * that measured and restyled inline ran that work at the event's rate,
     * which on a trackpad or a phone is well above the frame rate.
     */
    const schedule = () => {
      if (rafRef.current === null)
        rafRef.current = requestAnimationFrame(update)
    }

    // Repaint the current frame against the new canvas box. A ResizeObserver
    // rather than a `resize` listener: the stage is `100svh`, so it also
    // changes height when mobile browser chrome collapses and when the webfont
    // lands and reflows the copy. Missing those leaves the canvas backing store
    // sized to a stale box and the frame drawn letterboxed inside it.
    const onResize = () => {
      readProgress()
      paint(currentFrameRef.current)
      fade()
    }
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(canvas)

    // The page may already be restored mid-track on load.
    readProgress()
    fade()

    /**
     * Stream the sequence in, first frame first.
     *
     * The veil lifts on frame 0 alone rather than on the full set: waiting for
     * all 55 left the hero blank for the whole download on a cold load. The
     * rest fill in behind it a few at a time, and `nearestLoaded` covers any
     * gap somebody scrolls into before it arrives.
     */
    framesRef.current = Array.from({ length: FRAME_COUNT }, () => {
      const img = new window.Image()
      img.decoding = "async"
      return img
    })

    let next = 1
    const loadFrame = (i: number) => {
      const img = framesRef.current[i]
      const onSettled = () => {
        if (disposed) return
        if (i === 0) {
          setReady(true)
          // Force a paint rather than going through `schedule()`: if the page
          // hasn't been scrolled, target and current are both 0 and `update()`
          // no-ops, leaving the canvas blank.
          readProgress()
          paint(reduceMotion ? 0 : frameForScroll())
          schedule()
          for (let lane = 0; lane < LOAD_CONCURRENCY; lane += 1) pump()
          return
        }
        // A newly arrived frame may be the one the follower is parked on.
        paint(currentFrameRef.current)
        pump()
      }
      img.onload = onSettled
      // Keep the queue draining past a frame that 404s or fails to decode.
      img.onerror = onSettled
      // Frame 0 is the hero and keeps the high priority its preload gave it.
      // The rest are explicitly demoted: six in-flight image requests otherwise
      // hold the connection for the ~2.7s the sequence takes to stream, and the
      // next section's three.js chunk and PBR maps queue behind them. Low
      // priority lets those overtake the tail of the rally, which nobody has
      // scrolled to yet.
      if (i > 0) img.fetchPriority = "low"
      img.src = frameSrc(i)
    }
    const pump = () => {
      if (disposed || next >= FRAME_COUNT) return
      loadFrame(next++)
    }

    loadFrame(0)

    window.addEventListener("scroll", schedule, { passive: true })

    return () => {
      disposed = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      window.removeEventListener("scroll", schedule)
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <section
      id="top"
      ref={sectionRef}
      data-slot="hero"
      className="bg-pp-cream relative w-full"
      style={{ height: `${TRACK_VH}svh` }}
    >
      <div className="sticky top-0 h-svh w-full overflow-hidden">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Overhead view of a pickleball rally on a Paddle Power Cebu court"
          className="absolute inset-0 h-full w-full"
        />

        {/* Loading veil — fades out once every frame is decoded */}
        <div
          aria-hidden
          className={`bg-pp-cream absolute inset-0 transition-opacity duration-700 ${
            ready ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        />

        <div
          ref={contentRef}
          className="relative h-full will-change-[opacity,transform]"
        >
          {/* ── Centered headline ───────────────────────────────────────── */}
          {/* Extra bottom padding against `justify-center` lifts the headline
              off centre — it sits high over the rally rather than colliding
              with it. */}
          <div className="flex h-full flex-col items-center justify-center px-5 pt-[calc(var(--nav-h)+1rem)] pb-[20vh] text-center sm:px-6 lg:pt-[calc(var(--nav-h)+2rem)] lg:pb-[15.5vh]">
            <h1 className="m-0 w-full max-w-[20ch] text-[17.5vw] leading-[0.86] font-black tracking-[-0.035em] text-balance text-white uppercase drop-shadow-[0_2px_18px_rgba(0,0,0,0.35)] sm:text-[clamp(56px,11.5vw,196px)] sm:leading-[0.88]">
              <span className="block sm:inline">
                <VariableWeightText
                  text="Your"
                  play={ready}
                  staggerTiming={HEADLINE_STAGGER}
                  animationConfig={HEADLINE_ANIM}
                />
              </span>
              {/* Phones stack the words, so the inter-word space would open a
                  stray indent on the next line. */}
              <span className="hidden whitespace-pre sm:inline"> </span>
              <span className="block sm:inline">
                <VariableWeightText
                  text="court."
                  play={ready}
                  staggerTiming={HEADLINE_STAGGER}
                  animationConfig={HEADLINE_ANIM}
                  startDelay={WORD_TWO_DELAY}
                />
              </span>
              {/* Always its own line — a `<br>` would add an empty line box on
                  phones, where the words above are already block-level. */}
              <span className="block">
                <VariableWeightText
                  text="Anytime."
                  className="text-pp-lime-light"
                  play={ready}
                  staggerTiming={HEADLINE_STAGGER}
                  animationConfig={HEADLINE_ANIM}
                  startDelay={SECOND_LINE_DELAY}
                />
              </span>
              {/* Says what the place actually is, for anything reading the
                  page rather than looking at it — a screen reader, or a
                  search engine deciding what this page is about. The visible
                  headline says none of it. Inside the h1 rather than beside
                  it so it reads as one heading, and outside the animated
                  spans so it can't affect the weight sweep. */}
              <span className="sr-only">
                {" "}
                — premium indoor pickleball courts in Talisay, Cebu
              </span>
            </h1>
          </div>

          {/* Body copy + CTAs ride one small liquid-glass panel, parked in the
              bottom-right corner of the stage. Full-width only on the narrowest
              screens, where a corner card would be unreadable. */}
          <LiquidGlass
            className="absolute right-5 bottom-8 left-5 bg-black/25 sm:left-auto sm:w-[272px] lg:right-12 lg:bottom-12"
            borderRadius="20px"
            blurIntensity="xl"
            shadowIntensity="xs"
            glowIntensity="sm"
          >
            {/* Corner ribbon — clipped to a square so the rotated strip reads
                as cloth wrapping the panel's corner, not a floating label. */}
            <div className="absolute top-0 right-0 h-20 w-20 overflow-hidden">
              <div className="bg-pp-lime-light absolute top-[15px] -right-8 w-[130px] rotate-45 py-[3px] text-center shadow-[0_1px_3px_rgba(0,0,0,0.25)]">
                <span className="text-[10px] font-bold tracking-[0.08em] text-white uppercase">
                  Open 24/7
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3.5 pt-9 pr-8 pb-4 pl-5">
              <p className="m-0 text-center text-[13.5px] leading-relaxed font-medium text-pretty text-white/90 sm:text-left">
                Premium indoor pickleball in Cebu, open around the clock.
              </p>
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=Paddle+Power%2C+Maghaway+Rd%2C+Talisay%2C+6045+Cebu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-pp-lime-light hover:text-pp-cream focus-visible:outline-pp-olive text-center text-[11px] font-bold tracking-[0.16em] uppercase transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-left"
              >
                Maghaway Rd, Talisay
              </a>

              {/* Centered while the panel spans the full width of a phone;
                  left-aligned once it shrinks to the corner card. */}
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                {/* TODO: replace with client's Ondafit booking link — Talisay */}
                <PillLink
                  href="#locations"
                  variant="lime-light"
                  className="min-h-11 px-[18px] py-2.5 text-[13px]"
                >
                  Book Your Court
                </PillLink>
              </div>
            </div>
          </LiquidGlass>
        </div>
      </div>
    </section>
  )
}
