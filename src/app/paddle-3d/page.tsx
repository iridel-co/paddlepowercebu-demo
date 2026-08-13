"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

import {
  configurePaddleRenderer,
  createPaddleScene,
} from "@/lib/paddle3d/paddle-scene"

declare global {
  interface Window {
    __paddleReady?: boolean
    /** Flips once the PBR maps are on the materials and a textured frame has been drawn. */
    __paddleTexturesReady?: boolean
    __paddleSetAzimuth?: (degrees: number) => void
    __paddleStripMaps?: (stripped: boolean) => void
    __paddleExport?: () => {
      meshes: unknown[]
      measured: Record<string, number[]>
    }
    __paddleSetLighting?: (mode: "neutral" | "reference") => void
  }
}

/**
 * Review harness for the img2threejs reconstruction.
 *
 * Renders the paddle at the reference framing on the reference's white sweep, and exposes
 * `window.__paddleSetAzimuth` so the turntable gate can capture the same scene at several
 * orbit angles. Not a marketing page — this exists so renders are comparable to the photo.
 *
 * Doubles as the still-image export source, driven by the query string so a capture script
 * needs nothing but a URL — see `tools/export-renders.mjs`:
 *
 *   ?bg=transparent   drop the white sweep, for PNGs that composite onto anything
 *   ?w=1400&h=1750    canvas size in CSS pixels
 *   ?az=-22           starting orbit angle in degrees
 *   ?ball=1           stage the pickleball beside the paddle face
 *
 * Read off `window.location` rather than `useSearchParams` so the route stays statically
 * prerenderable without a Suspense boundary.
 */
export default function PaddleReviewPage() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const params = new URLSearchParams(window.location.search)
    const transparent = params.get("bg") === "transparent"
    const width = Number(params.get("w")) || 1024
    const height = Number(params.get("h")) || 1024
    const withBall = params.get("ball") === "1"
    const background = transparent ? null : "#ffffff"

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: transparent,
    })
    configurePaddleRenderer(renderer)
    renderer.setPixelRatio(1)
    renderer.setSize(width, height)
    host.appendChild(renderer.domElement)

    let paddle = createPaddleScene({
      background,
      lighting: "reference",
      renderer,
      ball: withBall,
      // The albedo maps land after the first frame. Capturing before then gets an untextured
      // white paddle, so publish a flag the export script can wait on, and redraw.
      onReady: () => {
        renderer.render(paddle.scene, paddle.camera)
        window.__paddleTexturesReady = true
      },
    })
    paddle.resize(width, height)

    const draw = () => renderer.render(paddle.scene, paddle.camera)
    if (params.has("az")) paddle.setAzimuth(Number(params.get("az")))
    draw()

    // The spec's lighting contract requires a neutral-light render alongside the reference-lit
    // one, so material readability is judged independently of the photo's own key.
    window.__paddleSetLighting = (mode) => {
      const azimuth = paddle.model.rotation.y
      paddle.dispose()
      paddle = createPaddleScene({
        background,
        lighting: mode,
        renderer,
        ball: withBall,
      })
      paddle.resize(width, height)
      paddle.model.rotation.y = azimuth
      draw()
    }

    window.__paddleSetAzimuth = (degrees: number) => {
      paddle.setAzimuth(degrees)
      draw()
    }

    // Map-stripped evidence for the blockout gate: proves the silhouette is carried by geometry,
    // not by the projected reference textures. Swaps to a flat clay material and back.
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>()
    const clay = new THREE.MeshStandardMaterial({
      color: 0x9a9a9a,
      roughness: 0.85,
      metalness: 0,
    })
    window.__paddleStripMaps = (stripped: boolean) => {
      paddle.model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return
        if (stripped) {
          if (!originals.has(object)) originals.set(object, object.material)
          object.material = clay
        } else {
          const original = originals.get(object)
          if (original) object.material = original
        }
      })
      draw()
    }
    // Geometry evidence for the deterministic self-intersection and attachment-anchor gates.
    window.__paddleExport = () => {
      const meshes: unknown[] = []
      const measured: Record<string, number[]> = {}
      const world = new THREE.Vector3()
      paddle.model.traverse((object) => {
        const componentId = object.userData?.sculptComponent?.id
        if (typeof componentId === "string") {
          object.getWorldPosition(world)
          measured[componentId] = [world.x, world.y, world.z]
        }
        if (!(object instanceof THREE.Mesh)) return
        const geometry = object.geometry
          .clone()
          .applyMatrix4(object.matrixWorld)
        const indexed = geometry.index ? geometry : undefined
        const position = geometry.getAttribute("position")
        const vertices: number[][] = []
        for (let i = 0; i < position.count; i += 1) {
          vertices.push([position.getX(i), position.getY(i), position.getZ(i)])
        }
        const indices = indexed
          ? Array.from(indexed.index!.array)
          : Array.from({ length: position.count }, (_, i) => i)
        // Real vertex normals, not the gate's centroid fallback: a ring-topology part like the
        // edge guard has its centroid inside its own hole, so a centroid-derived "outward"
        // direction points into the solid and reads as a false self-intersection.
        geometry.computeVertexNormals()
        const normalAttr = geometry.getAttribute("normal")
        const normals: number[][] = []
        for (let i = 0; i < normalAttr.count; i += 1) {
          normals.push([
            normalAttr.getX(i),
            normalAttr.getY(i),
            normalAttr.getZ(i),
          ])
        }
        meshes.push({
          id: object.name,
          name: object.name,
          vertices,
          indices,
          normals,
        })
        geometry.dispose()
      })
      return { meshes, measured }
    }
    ;(window as unknown as Record<string, unknown>).__paddleRoot = paddle.model
    window.__paddleReady = true

    return () => {
      delete window.__paddleExport
      delete window.__paddleSetLighting
      delete window.__paddleReady
      delete window.__paddleTexturesReady
      delete window.__paddleSetAzimuth
      delete window.__paddleStripMaps
      clay.dispose()
      paddle.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div ref={hostRef} id="paddle-review-canvas" className="w-fit" />
  )
}
