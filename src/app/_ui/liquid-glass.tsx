import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Liquid-glass surface — Apple-style refracted panel.
 *
 * Adapted from the `liquid-weather-glass` reference component, minus its
 * `motion` drag/expand behaviour (a hero panel should never be draggable, and
 * the dependency buys nothing else here). What's kept is the layer stack that
 * produces the effect:
 *
 * 1. **Bend**  — backdrop-blur pushed through an `feDisplacementMap` so the
 *    backdrop warps at the panel edges instead of blurring flatly.
 * 2. **Face**  — outer drop shadow plus a white bloom.
 * 3. **Edge**  — inset highlights on all four sides, the "thick glass" read.
 *
 * Give the panel its own translucent tint via `className` (e.g. `bg-white/10`).
 */

const BLUR = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
  xl: "backdrop-blur-xl",
} as const

const EDGE = {
  none: "inset 0 0 0 0 rgba(255,255,255,0)",
  xs: "inset 1px 1px 1px 0 rgba(255,255,255,0.3), inset -1px -1px 1px 0 rgba(255,255,255,0.3)",
  sm: "inset 2px 2px 2px 0 rgba(255,255,255,0.35), inset -2px -2px 2px 0 rgba(255,255,255,0.35)",
  md: "inset 3px 3px 3px 0 rgba(255,255,255,0.45), inset -3px -3px 3px 0 rgba(255,255,255,0.45)",
  lg: "inset 4px 4px 4px 0 rgba(255,255,255,0.5), inset -4px -4px 4px 0 rgba(255,255,255,0.5)",
  xl: "inset 6px 6px 6px 0 rgba(255,255,255,0.55), inset -6px -6px 6px 0 rgba(255,255,255,0.55)",
} as const

const GLOW = {
  none: "0 4px 4px rgba(0,0,0,0.05), 0 0 12px rgba(0,0,0,0.05)",
  xs: "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 16px rgba(255,255,255,0.05)",
  sm: "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 24px rgba(255,255,255,0.1)",
  md: "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 32px rgba(255,255,255,0.15)",
  lg: "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 40px rgba(255,255,255,0.2)",
  xl: "0 4px 4px rgba(0,0,0,0.15), 0 0 12px rgba(0,0,0,0.08), 0 0 48px rgba(255,255,255,0.25)",
} as const

/** One shared filter def for every panel on the page. */
const FILTER_ID = "pp-liquid-glass-blur"

export interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  blurIntensity?: keyof typeof BLUR
  shadowIntensity?: keyof typeof EDGE
  glowIntensity?: keyof typeof GLOW
  /** Any CSS length — must match the visual radius you want on all layers. */
  borderRadius?: string
}

export function LiquidGlass({
  children,
  className,
  blurIntensity = "xl",
  shadowIntensity = "xs",
  glowIntensity = "sm",
  borderRadius = "28px",
  style,
  ...props
}: LiquidGlassProps) {
  return (
    <div
      data-slot="liquid-glass"
      className={cn("relative isolate", className)}
      style={{ borderRadius, ...style }}
      {...props}
    >
      {/* Displacement source for the bend layer. Rendered inline so the panel
          stays self-contained; duplicate ids across panels resolve to the
          same def, which is exactly what we want. */}
      <svg aria-hidden className="absolute h-0 w-0">
        <defs>
          <filter
            id={FILTER_ID}
            x="0"
            y="0"
            width="100%"
            height="100%"
            filterUnits="objectBoundingBox"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.003 0.007"
              numOctaves="1"
              result="turbulence"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turbulence"
              scale="200"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Bend. The `filter: url()` lives in a class rather than inline so a
          media query can drop it — see `.pp-glass-bend` in globals.css. It is
          the single most expensive thing this page paints: an SVG filter graph
          re-run over a backdrop-blur, on panels that sit over the hero's
          scrubbing canvas and over two live WebGL contexts, so its input is
          dirty on every frame. */}
      <div
        aria-hidden
        className={cn(
          "pp-glass-bend absolute inset-0 z-0",
          BLUR[blurIntensity]
        )}
        style={{ borderRadius }}
      />
      {/* Face */}
      <div
        aria-hidden
        className="absolute inset-0 z-10"
        style={{ borderRadius, boxShadow: GLOW[glowIntensity] }}
      />
      {/* Edge */}
      <div
        aria-hidden
        className="absolute inset-0 z-20"
        style={{ borderRadius, boxShadow: EDGE[shadowIntensity] }}
      />

      <div className="relative z-30">{children}</div>
    </div>
  )
}
