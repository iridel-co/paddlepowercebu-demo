"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

import {
  configurePaddleRenderer,
  createPaddleScene,
  PADDLE_LENGTH,
} from "./paddle-scene"

export type PaddleViewerProps = {
  /** Degrees per second of idle turntable rotation. 0 disables it. */
  spinSpeed?: number
  /** Drag to orbit. Disable for a purely decorative hero element. */
  interactive?: boolean
  /** Starting orbit angle in degrees; 0 is the reference front view. */
  initialAzimuth?: number
  /** Stage the procedural pickleball alongside the paddle in the same scene. */
  ball?: boolean
  /**
   * Rock the paddle back and forth around `initialAzimuth` by this many degrees
   * instead of turning it all the way around. Takes precedence over
   * `spinSpeed`: a full turntable reads as a product viewer, a sway reads as an
   * object hanging in the air. 0 disables it.
   */
  swayDegrees?: number
  /** Seconds for one full sway cycle. */
  swayPeriod?: number
  /**
   * Stops the render loop without tearing the scene down. For a viewer the page
   * keeps mounted but hides — the court paddles sit at `opacity: 0` until their
   * half is hovered — since an invisible canvas still intersects the viewport
   * and would otherwise sway and redraw at 60fps for nobody. Unpausing renders
   * on the next frame, so the paddle is painted before its fade-in finishes.
   */
  paused?: boolean
  className?: string
}

/**
 * Drop-in viewer for the procedural Paddle Power paddle.
 *
 * Transparent background so it sits on any section colour. Pauses when scrolled out of view and
 * when the tab is hidden, and respects `prefers-reduced-motion` by not auto-spinning.
 */
export function PaddleViewer({
  spinSpeed = 18,
  interactive = true,
  initialAzimuth = -22,
  ball = false,
  swayDegrees = 0,
  swayPeriod = 7,
  paused = false,
  className,
}: PaddleViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  // Read inside the loop rather than listed as an effect dependency: a hover
  // that flipped `paused` would otherwise tear down the WebGL context and
  // rebuild the scene on every pointer entry.
  const pausedRef = useRef(paused)
  const invalidateRef = useRef<() => void>(() => {})

  // Resuming always draws one frame, even if nothing about the scene changed
  // while it was parked: a canvas whose drawing buffer was not preserved can
  // come back blank, and the paddle is mid-fade-in at that moment.
  useEffect(() => {
    pausedRef.current = paused
    if (!paused) invalidateRef.current()
  }, [paused])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // A device without a usable WebGL context (older Safari, GPU blocklisted,
    // hardware acceleration off) throws here. Left unguarded that takes the
    // whole page down with it, so fail quiet and leave the host empty — the
    // section's copy still reads on its own.
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return
    }
    configurePaddleRenderer(renderer)
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    host.appendChild(renderer.domElement)
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.display = "block"
    if (interactive) renderer.domElement.style.touchAction = "pan-y"

    // The albedo maps are fetched after the model is built, so the first frames
    // render an untextured white paddle — it reads as flat grey plastic, not as
    // the product. Hold the canvas hidden until the maps are on the materials
    // and fade in, rather than showing the wrong paddle for a second.
    renderer.domElement.style.opacity = "0"
    renderer.domElement.style.transition = "opacity 350ms ease-out"

    /**
     * Redraw only when something actually changed.
     *
     * A paddle that is neither swaying, spinning, nor being dragged renders an
     * identical frame 60 times a second — a full scene draw per frame, on a
     * canvas nobody is looking at differently. The flag below turns the loop
     * into a scheduler: it keeps rAF alive (so a change lands on the very next
     * frame) but skips the draw itself, which is the expensive half.
     */
    let needsRender = true
    const invalidate = () => {
      needsRender = true
    }
    invalidateRef.current = invalidate

    // Until then the albedo maps are still landing and `applyMeasuredResponse`
    // is still writing to the materials, so every frame differs from the last.
    let settled = false

    const paddle = createPaddleScene({
      background: null,
      lighting: "reference",
      frameHeight: PADDLE_LENGTH * 1.12,
      renderer,
      ball,
      onReady: () => {
        renderer.domElement.style.opacity = "1"
        settled = true
        invalidate()
      },
    })

    let azimuth = initialAzimuth
    paddle.setAzimuth(azimuth)

    const resize = () => {
      const { clientWidth, clientHeight } = host
      if (!clientWidth || !clientHeight) return
      renderer.setSize(clientWidth, clientHeight, false)
      paddle.resize(clientWidth, clientHeight)
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
      paddle.setAzimuth(azimuth)
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
    const sway = reducedMotion ? 0 : swayDegrees
    const idleSpin = reducedMotion || sway ? 0 : spinSpeed

    let visible = true
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        // Whatever moved while it was off screen has to be caught up on the
        // first frame back.
        if (visible) invalidate()
      },
      { threshold: 0.05 }
    )
    intersectionObserver.observe(host)

    let frame = 0
    let previous = performance.now()
    // Sway is driven off wall-clock elapsed time rather than accumulated
    // deltas, so a tab that was hidden for a minute resumes on the same curve
    // instead of picking up wherever it froze.
    const started = previous
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const delta = Math.min(0.05, (now - previous) / 1000)
      previous = now
      if (!visible || document.hidden || pausedRef.current) return
      if (sway && !dragging) {
        const phase = ((now - started) / 1000 / swayPeriod) * Math.PI * 2
        paddle.setAzimuth(initialAzimuth + Math.sin(phase) * sway)
        invalidate()
      } else if (idleSpin && !dragging) {
        azimuth += idleSpin * delta
        paddle.setAzimuth(azimuth)
        invalidate()
      }
      if (!needsRender && settled) return
      needsRender = false
      renderer.render(paddle.scene, paddle.camera)
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
      paddle.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [spinSpeed, interactive, initialAzimuth, ball, swayDegrees, swayPeriod])

  return <div ref={hostRef} className={className} aria-hidden="true" />
}
