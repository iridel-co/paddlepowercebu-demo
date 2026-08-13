"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

import {
  configureBallRenderer,
  createBallScene,
} from "@/lib/paddle3d/ball-scene"

declare global {
  interface Window {
    __ballReady?: boolean
    __ballSetAzimuth?: (degrees: number) => void
  }
}

/**
 * Review harness for the pickleball reconstruction.
 *
 * Renders at the reference framing on a white sweep and exposes `window.__ballSetAzimuth` so a
 * turntable capture can hit several angles in one page load. Not a marketing page — it exists
 * so renders stay comparable to `public/images/pickleball-ball.png`.
 *
 * Doubles as the still-image export source — see `tools/export-renders.mjs`. Query string:
 * `?bg=transparent` drops the white sweep, `?w=900&h=900` sets the canvas size, `?az=20` sets
 * the orbit angle. Read off `window.location` rather than `useSearchParams` so the route stays
 * statically prerenderable without a Suspense boundary.
 */
export default function BallReviewPage() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const params = new URLSearchParams(window.location.search)
    const transparent = params.get("bg") === "transparent"
    const width = Number(params.get("w")) || 673
    const height = Number(params.get("h")) || 673

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: transparent,
    })
    configureBallRenderer(renderer)
    renderer.setPixelRatio(1)
    renderer.setSize(width, height)
    host.appendChild(renderer.domElement)

    const ball = createBallScene({
      background: transparent ? null : "#ffffff",
      lighting: "reference",
      renderer,
    })
    ball.resize(width, height)

    const draw = () => renderer.render(ball.scene, ball.camera)
    if (params.has("az")) ball.setAzimuth(Number(params.get("az")))
    draw()

    window.__ballSetAzimuth = (degrees: number) => {
      ball.setAzimuth(degrees)
      draw()
    }
    window.__ballReady = true

    return () => {
      delete window.__ballReady
      delete window.__ballSetAzimuth
      ball.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={hostRef} id="ball-review-canvas" className="w-fit" />
}
