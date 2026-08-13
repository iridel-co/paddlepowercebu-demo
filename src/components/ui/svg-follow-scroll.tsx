"use client"

import { useRef } from "react"
import type { MotionValue } from "motion/react"
import { motion, useScroll, useTransform } from "motion/react"

/**
 * A stroke that draws itself in time with scroll progress.
 *
 * The path's `pathLength` is bound to how far the host element has travelled
 * through the viewport, so the line appears to be drawn as the reader scrolls
 * and un-draws on the way back up. Purely decorative — it renders
 * `aria-hidden` and never accepts pointer events.
 */

export type SvgFollowScrollProps = {
  className?: string
  /** Stroke colour. Any CSS colour; defaults to the brand lime. */
  stroke?: string
  strokeWidth?: number
  /** Fraction of the path already drawn when it enters view. */
  from?: number
  /** Fraction drawn once it has fully passed through. */
  to?: number
  /**
   * Element whose travel through the viewport drives the draw. Defaults to
   * this component's own wrapper — pass a stationary ancestor when the
   * wrapper itself is animated, since an element that holds a fixed screen
   * position would otherwise report a constant progress and never draw.
   */
  target?: React.RefObject<HTMLElement | null>
  /**
   * Scroll-progress window the draw is mapped onto, as fractions of the
   * target's travel through the viewport. Defaults to the whole travel.
   * Narrow it to sync the stroke's tip with something that only moves during
   * part of that travel — outside the window the draw simply holds.
   */
  startAt?: number
  endAt?: number
  /**
   * How the artwork is fitted into the box. Defaults to anchoring the top
   * edge, so the path starts where the element starts and trails downward
   * rather than being letterboxed toward the middle.
   */
  preserveAspectRatio?: string
}

export function SvgFollowScroll({
  className,
  stroke = "var(--color-pp-lime)",
  strokeWidth = 20,
  from = 0.1,
  to = 1,
  target,
  startAt = 0,
  endAt = 1,
  preserveAspectRatio = "xMidYMin meet",
}: SvgFollowScrollProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: target ?? ref,
    offset: ["start end", "end start"],
  })

  return (
    <div ref={ref} className={className} aria-hidden>
      <LinePath
        scrollYProgress={scrollYProgress}
        stroke={stroke}
        strokeWidth={strokeWidth}
        from={from}
        to={to}
        startAt={startAt}
        endAt={endAt}
        preserveAspectRatio={preserveAspectRatio}
      />
    </div>
  )
}

function LinePath({
  scrollYProgress,
  stroke,
  strokeWidth,
  from,
  to,
  startAt,
  endAt,
  preserveAspectRatio,
}: {
  scrollYProgress: MotionValue<number>
  stroke: string
  strokeWidth: number
  from: number
  to: number
  startAt: number
  endAt: number
  preserveAspectRatio: string
}) {
  // useTransform clamps to the output edges outside the input range, so the
  // stroke holds at `from` before the window and at `to` after it.
  const pathLength = useTransform(scrollYProgress, [startAt, endAt], [from, to])
  const strokeDashoffset = useTransform(pathLength, (value) => 1 - value)

  return (
    <svg
      width="1278"
      height="2360"
      // The viewBox is cropped to the trimmed artwork's own bounds so the
      // stroke starts flush with the top edge of its box instead of sitting
      // ~14% down from it.
      viewBox="0 308 1278 2360"
      fill="none"
      overflow="visible"
      preserveAspectRatio={preserveAspectRatio}
      xmlns="http://www.w3.org/2000/svg"
      className="size-full"
    >
      <motion.path
        // Trimmed: the artwork's original opening was a dense knot of loops
        // that ate most of the path length in one corner. It now starts at
        // the single loop that leads into the long sweep down the section.
        d="M913.558 321.045C919.727 385.734 990.968 497.068 1063.84 503.35C1111.46 507.456 1166.79 511.984 1175.68 464.527C1191.52 379.956 1101.26 334.985 1030.29 377.017C971.109 412.064 956.297 483.647 953.797 561.655C947.587 755.413 1197.56 941.828 936.039 1140.66C745.771 1285.32 321.926 950.737 134.536 1202.19C-6.68295 1391.68 -53.4837 1655.38 131.935 1760.5C478.381 1956.91 1124.19 1515 1201.28 1997.83C1273.66 2451.23 100.805 1864.7 303.794 2668.89"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        // Keeps the stroke an even weight even when the box scales the
        // artwork unevenly (preserveAspectRatio="none").
        vectorEffect="non-scaling-stroke"
        style={{ pathLength, strokeDashoffset }}
      />
    </svg>
  )
}
