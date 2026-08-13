"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  stagger,
  useAnimate,
  useInView,
  type AnimationOptions,
} from "motion/react"

/**
 * Per-character `font-variation-settings` animation.
 *
 * Adapted from the 21st.dev "bold on hover" component. Two changes for this
 * site: it plays automatically the first time it scrolls into view (hover is
 * opt-in), and it splits on words before characters so `text-balance` and
 * normal wrapping can't break a word mid-string.
 *
 * Requires a variable font — Montserrat is loaded without a `weight` list in
 * `layout.tsx` for exactly this. Montserrat exposes `wght` only (no `slnt`),
 * so the styles below are weight-only.
 */

/* Module-level so the default doesn't get a fresh identity every render. */
const DEFAULT_ANIMATION: AnimationOptions = {
  type: "spring",
  duration: 0.7,
  bounce: 0,
}

/** Flips a stagger origin so a pass runs in the opposite order. */
function mirrorOrigin(
  origin: "first" | "last" | "center" | number,
  charCount: number
): "first" | "last" | "center" | number {
  if (origin === "first") return "last"
  if (origin === "last") return "first"
  if (origin === "center") return "center"
  return Math.max(charCount - 1, 0) - origin
}

type VariableWeightTextProps = {
  text: string
  /** Rendered weight before the animation runs. */
  initialStyle?: string
  /** Weight animated to, and held. */
  activeStyle?: string
  animationConfig?: AnimationOptions
  staggerTiming?: number
  staggerOrigin?: "first" | "last" | "center" | number
  /** Seconds to wait before the first character moves — lets adjacent
   *  instances read as one continuous sweep. */
  startDelay?: number
  /** Seconds to wait before the *reverse* sweep starts. Mirror of
   *  `startDelay`: the instance that finished last unwinds first, so the exit
   *  reads as the entrance played backwards. */
  exitDelay?: number
  /** Fraction of the element that must be visible to trigger. */
  inViewAmount?: number
  /** External play signal. When provided, in-view detection is skipped: the
   *  sweep runs when this turns true and unwinds back to `initialStyle` when
   *  it turns false, so leaving the viewport arms the next entrance. */
  play?: boolean
  /** Replay the sweep on hover. The text stays bold afterwards — hover
   *  restarts the animation rather than reversing it. */
  hover?: boolean
  /** Replay whenever this number changes — lets a parent hover replay several
   *  instances as one line. Ignored until the first play has happened. */
  replaySignal?: number
  className?: string
}

export function VariableWeightText({
  text,
  initialStyle = "'wght' 400",
  activeStyle = "'wght' 900",
  animationConfig = DEFAULT_ANIMATION,
  staggerTiming = 0.03,
  staggerOrigin = "first",
  startDelay = 0,
  exitDelay = 0,
  inViewAmount = 0.6,
  play,
  hover = true,
  replaySignal = 0,
  className,
}: VariableWeightTextProps) {
  const [scope, animate] = useAnimate<HTMLSpanElement>()
  const selfInView = useInView(scope, { amount: inViewAmount })
  const [hasPlayed, setHasPlayed] = useState(false)
  /** Guards hover replays so a mouse crossing the text doesn't restack runs. */
  const isRunning = useRef(false)
  /** Owns the "run finished" timer so an interrupting run can cancel the old
   *  one — otherwise a stale timer clears the guard mid-sweep. */
  const doneTimer = useRef<number | undefined>(undefined)

  const charCount = text.replace(/ /g, "").length

  /** One staggered pass to `target`. Interrupts whatever is in flight. */
  const run = useCallback(
    (
      target: string,
      origin: VariableWeightTextProps["staggerOrigin"],
      delay: number
    ) => {
      isRunning.current = true
      window.clearTimeout(doneTimer.current)

      animate(
        ".char",
        { fontVariationSettings: target },
        {
          ...animationConfig,
          delay: stagger(staggerTiming, { from: origin, startDelay: delay }),
        }
      )

      const total =
        delay +
        staggerTiming * Math.max(charCount - 1, 0) +
        (typeof animationConfig.duration === "number"
          ? animationConfig.duration
          : 0.7)
      doneTimer.current = window.setTimeout(() => {
        isRunning.current = false
      }, total * 1000)
    },
    [animate, animationConfig, staggerTiming, charCount]
  )

  /** Instantly rewind to the light weight — used before a hover replay. */
  const reset = useCallback(() => {
    isRunning.current = false
    window.clearTimeout(doneTimer.current)
    animate(".char", { fontVariationSettings: initialStyle }, { duration: 0 })
  }, [animate, initialStyle])

  /** Staggered sweep to the bold weight. */
  const sweep = useCallback(
    () => run(activeStyle, staggerOrigin, startDelay),
    [run, activeStyle, staggerOrigin, startDelay]
  )

  /** The same sweep played backwards: the character that went bold last is the
   *  first to come back down, so the exit mirrors the entrance. */
  const unsweep = useCallback(
    () => run(initialStyle, mirrorOrigin(staggerOrigin, charCount), exitDelay),
    [run, initialStyle, staggerOrigin, charCount, exitDelay]
  )

  const replay = useCallback(() => {
    if (isRunning.current) return
    reset()
    sweep()
  }, [reset, sweep])

  useEffect(() => () => window.clearTimeout(doneTimer.current), [])

  const triggered = play ?? selfInView

  /* Plays on entrance and unwinds on exit, so scrolling back gets the sweep
     again rather than a headline that is already bold. The exit is animated,
     not instant — it fires while the text is still partly on screen. */
  useEffect(() => {
    if (triggered === hasPlayed) return
    setHasPlayed(triggered)

    if (triggered) sweep()
    else unsweep()
  }, [triggered, hasPlayed, sweep, unsweep])

  /* Keyed on the signal's value, not on the effect firing — `replay` is a new
     identity every render, so an unguarded effect would re-fire on any
     unrelated re-render. */
  const lastSignal = useRef(0)

  useEffect(() => {
    if (!replaySignal || replaySignal === lastSignal.current) return
    lastSignal.current = replaySignal
    if (hasPlayed) replay()
  }, [replaySignal, hasPlayed, replay])

  return (
    <span
      ref={scope}
      className={className}
      onPointerEnter={hover && hasPlayed ? replay : undefined}
    >
      <span className="sr-only">{text}</span>

      {/* Words stay whole; only characters inside them are animated. The
          inter-word space is its own `whitespace-pre` box — a trailing space
          inside an inline-block gets collapsed away, closing the gap. */}
      {text.split(" ").map((word, wordIndex, words) => (
        <span key={`${word}-${wordIndex}`} aria-hidden="true">
          <span className="inline-block whitespace-nowrap">
            {word.split("").map((char, charIndex) => (
              <span
                key={charIndex}
                className="char inline-block"
                style={{ fontVariationSettings: initialStyle }}
              >
                {char}
              </span>
            ))}
          </span>
          {wordIndex < words.length - 1 ? (
            <span className="inline-block whitespace-pre"> </span>
          ) : null}
        </span>
      ))}
    </span>
  )
}
