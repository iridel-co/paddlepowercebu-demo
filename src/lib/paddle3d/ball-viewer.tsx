"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

import { configureBallRenderer, createBallScene } from "./ball-scene"

export type BallViewerProps = {
  /** Degrees per second of idle rotation. 0 disables it. */
  spinSpeed?: number
  /** Drag to spin. Disable for a purely decorative element. */
  interactive?: boolean
  /** Starting angle in degrees. */
  initialAzimuth?: number
  /** Tilts the spin axis so the turn reads as a tumble rather than a globe. */
  tiltDegrees?: number
  /**
   * Stops the render loop without tearing the scene down — for a viewer the
   * page keeps mounted but hides, like the ball waiting at `opacity: 0` for a
   * court half to be hovered. Unpausing draws on the next frame.
   */
  paused?: boolean
  className?: string
}

/**
 * Drop-in viewer for the procedural pickleball.
 *
 * Same contract as `PaddleViewer`: transparent background, pauses when scrolled out of view or
 * when the tab is hidden, respects `prefers-reduced-motion`, and fails quiet with an empty host
 * on a device without a usable WebGL context.
 */
export function BallViewer({
  spinSpeed = 24,
  interactive = true,
  initialAzimuth = 18,
  tiltDegrees = -16,
  paused = false,
  className,
}: BallViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  // Kept in refs rather than in the effect's dependencies: flipping `paused` on
  // hover must not tear down and rebuild the WebGL context.
  const pausedRef = useRef(paused)
  const invalidateRef = useRef<() => void>(() => {})

  useEffect(() => {
    pausedRef.current = paused
    if (!paused) invalidateRef.current()
  }, [paused])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return
    }
    configureBallRenderer(renderer)
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    host.appendChild(renderer.domElement)
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.display = "block"
    if (interactive) renderer.domElement.style.touchAction = "pan-y"

    /**
     * Redraw only when something changed. A ball with `spinSpeed={0}` — the one
     * riding the Coming Soon list, whose motion is all CSS on the wrapper — is
     * otherwise a full scene draw every frame for a picture that never changes.
     */
    let needsRender = true
    const invalidate = () => {
      needsRender = true
    }
    invalidateRef.current = invalidate

    const ball = createBallScene({
      background: null,
      lighting: "reference",
      renderer,
    })
    ball.model.rotation.x = THREE.MathUtils.degToRad(tiltDegrees)

    /* The perforation mask now bakes in slices after the model is built, and
       a ball without its mask draws as a solid shell with `alphaTest` holes
       missing. Hold the canvas invisible until the mask is real — no fade,
       so once ready it appears exactly as it always has. The bake finishes
       hundreds of pixels of scroll before the ball can enter the viewport. */
    renderer.domElement.style.opacity = "0"
    void Promise.resolve(
      ball.model.userData.texturesComplete as Promise<void> | undefined
    ).then(() => {
      renderer.domElement.style.opacity = "1"
      invalidate()
    })

    let azimuth = initialAzimuth
    ball.setAzimuth(azimuth)

    const resize = () => {
      const { clientWidth, clientHeight } = host
      if (!clientWidth || !clientHeight) return
      renderer.setSize(clientWidth, clientHeight, false)
      ball.resize(clientWidth, clientHeight)
      invalidate()
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)

    let dragging = false
    let lastX = 0
    const onDown = (event: PointerEvent) => {
      dragging = true
      lastX = event.clientX
      renderer.domElement.setPointerCapture(event.pointerId)
    }
    const onMove = (event: PointerEvent) => {
      if (!dragging) return
      azimuth += (event.clientX - lastX) * 0.4
      lastX = event.clientX
      ball.setAzimuth(azimuth)
      invalidate()
    }
    const onUp = (event: PointerEvent) => {
      dragging = false
      renderer.domElement.releasePointerCapture(event.pointerId)
    }
    if (interactive) {
      renderer.domElement.addEventListener("pointerdown", onDown)
      renderer.domElement.addEventListener("pointermove", onMove)
      renderer.domElement.addEventListener("pointerup", onUp)
      renderer.domElement.addEventListener("pointercancel", onUp)
    }

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const idleSpin = reducedMotion ? 0 : spinSpeed

    let visible = true
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) invalidate()
      },
      { threshold: 0.05 }
    )
    intersectionObserver.observe(host)

    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min(0.05, (now - previous) / 1000)
      previous = now
      if (!visible || document.hidden || pausedRef.current) return
      if (idleSpin && !dragging) {
        azimuth += idleSpin * delta
        ball.setAzimuth(azimuth)
        invalidate()
      }
      if (!needsRender) return
      needsRender = false
      renderer.render(ball.scene, ball.camera)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      if (interactive) {
        renderer.domElement.removeEventListener("pointerdown", onDown)
        renderer.domElement.removeEventListener("pointermove", onMove)
        renderer.domElement.removeEventListener("pointerup", onUp)
        renderer.domElement.removeEventListener("pointercancel", onUp)
      }
      ball.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [spinSpeed, interactive, initialAzimuth, tiltDegrees])

  return <div ref={hostRef} className={className} aria-hidden="true" />
}
