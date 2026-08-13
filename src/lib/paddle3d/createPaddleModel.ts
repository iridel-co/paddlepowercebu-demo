import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js"
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

export type ProceduralModelOptions = {
  wireframe?: boolean
  castShadow?: boolean
  receiveShadow?: boolean
  textureSize?: number
  textureAnisotropy?: number
  qualityPriority?: "reference-fidelity" | "balanced"
}

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>
  meshes: Record<string, THREE.Mesh>
  sockets: Record<string, THREE.Object3D>
  colliders: Record<string, unknown>
  destructionGroups: Record<string, THREE.Object3D[]>
}

type SculptMaterialSpec = Record<string, any>

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(
  points: [number, number][],
  holes?: [number, number][][]
): THREE.Shape {
  const shape = new THREE.Shape()
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1])
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1])
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue
    const path = new THREE.Path()
    path.moveTo(loop[0][0], loop[0][1])
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1])
    path.closePath()
    shape.holes.push(path)
  }
  return shape
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seg = 24
): [number, number][] {
  const loop: [number, number][] = []
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  return loop
}

function buildExtrudeGeometry(profile: {
  points: [number, number][]
  depth: number
  holes?: [number, number][][]
  ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[]
}): THREE.ExtrudeGeometry {
  const holes = [
    ...(profile.holes ?? []),
    ...(profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)),
  ]
  const shape = buildExtrudeShape(profile.points, holes)
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  })
}

function buildLatheGeometry(profile: {
  points: [number, number][]
  segments?: number
}): THREE.LatheGeometry {
  const points = profile.points.map(
    ([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y)
  )
  return new THREE.LatheGeometry(points, profile.segments ?? 24)
}

function buildTubeGeometry(path: {
  points: [number, number, number][]
  radius?: number
  radialSegments?: number
  closed?: boolean
}): THREE.TubeGeometry {
  const vectors = path.points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  const curve = new THREE.CatmullRomCurve3(vectors, path.closed ?? false)
  const tubularSegments = Math.max(8, path.points.length * 6)
  return new THREE.TubeGeometry(
    curve,
    tubularSegments,
    path.radius ?? 0.05,
    path.radialSegments ?? 8,
    path.closed ?? false
  )
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function readLayerNumber(
  value: unknown,
  keys: string[],
  fallback: number
): number {
  if (typeof value === "number") return value
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    for (const key of keys) {
      if (typeof record[key] === "number") return record[key] as number
    }
  }
  return fallback
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? "#" +
      hex
        .slice(1)
        .split("")
        .map((part) => part + part)
        .join("")
    : hex
  const value = /^#[0-9a-f]{6}$/i.test(normalized)
    ? Number.parseInt(normalized.slice(1), 16)
    : 0x8a7a5f
  return [
    clampAlbedoChannel((value >> 16) & 255),
    clampAlbedoChannel((value >> 8) & 255),
    clampAlbedoChannel(value & 255),
  ]
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette
  if (Array.isArray(palette) && palette.length > 0)
    return palette.filter((value) => typeof value === "string")
  const secondary = spec.albedo?.secondary
  const colors = [
    spec.baseColor ?? spec.color ?? spec.albedo?.dominant,
    ...(Array.isArray(secondary) ? secondary : []),
  ]
  return colors.filter(
    (value): value is string =>
      typeof value === "string" && value.startsWith("#")
  )
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)))
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value))
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value))
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === "string" ? spec.baseColor : "#8A7A5F"
  const [red, green, blue] = hexToRgb(source)
  return new THREE.Color(red / 255, green / 255, blue / 255)
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value)
}

function periodicHash(
  x: number,
  y: number,
  seed: number,
  periodX: number,
  periodY: number
): number {
  const wrappedX = ((x % periodX) + periodX) % periodX
  const wrappedY = ((y % periodY) + periodY) % periodY
  let value =
    Math.imul(wrappedX + seed * 17, 374761393) ^
    Math.imul(wrappedY + seed * 31, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

function periodicValueNoise(
  u: number,
  v: number,
  seed: number,
  periodX: number,
  periodY: number
): number {
  const x = u * periodX
  const y = v * periodY
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = smoothCurve(x - x0)
  const ty = smoothCurve(y - y0)
  const a = periodicHash(x0, y0, seed, periodX, periodY)
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY)
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY)
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY)
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, tx),
    THREE.MathUtils.lerp(c, d, tx),
    ty
  )
}

type SurfaceBand = {
  frequency: number
  amplitude: number
  stretchX: number
  stretchY: number
  ridge: boolean
}

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands)
    ? spec.surfaceFrequencyBands
    : []
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return []
    const band = item as Record<string, unknown>
    const frequency = typeof band.frequency === "number" ? band.frequency : 0
    const amplitude = typeof band.amplitude === "number" ? band.amplitude : 0
    if (frequency <= 0 || amplitude <= 0) return []
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1]
    const description =
      `${String(band.pattern ?? "")} ${String(band.role ?? "")}`.toLowerCase()
    return [
      {
        frequency,
        amplitude,
        stretchX:
          typeof stretch[0] === "number" ? Math.max(0.1, stretch[0]) : 1,
        stretchY:
          typeof stretch[1] === "number" ? Math.max(0.1, stretch[1]) : 1,
        ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
      },
    ]
  })
  return parsed.length > 0
    ? parsed
    : [
        {
          frequency: 2,
          amplitude: 0.42,
          stretchX: 1,
          stretchY: 1,
          ridge: false,
        },
        {
          frequency: 12,
          amplitude: 0.22,
          stretchX: 1,
          stretchY: 1,
          ridge: false,
        },
        {
          frequency: 56,
          amplitude: 0.08,
          stretchX: 1,
          stretchY: 1,
          ridge: false,
        },
      ]
}

function sampleSurface(
  u: number,
  v: number,
  bands: SurfaceBand[],
  seed: number
): number {
  let value = 0
  let weight = 0
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index]
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX))
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY))
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY)
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1)
    value += sample * band.amplitude
    weight += band.amplitude
  }
  return weight > 0 ? clamp01(value / weight) : 0.5
}

function mixPalette(
  colors: [number, number, number][],
  value: number
): [number, number, number] {
  if (colors.length === 1) return colors[0]
  const scaled = clamp01(value) * (colors.length - 1)
  const index = Math.min(colors.length - 2, Math.floor(scaled))
  const mix = scaled - index
  const a = colors[index]
  const b = colors[index + 1]
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ]
}

type ColorGradientStop = { offset: number; color: string }
type ColorGradientSpec = {
  type: "linear" | "radial"
  axis: [number, number]
  stops: ColorGradientStop[]
}

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value)
  if (!match) return [138, 122, 95]
  return [
    clampAlbedoChannel(Number(match[1])),
    clampAlbedoChannel(Number(match[2])),
    clampAlbedoChannel(Number(match[3])),
  ]
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(
  gradient: ColorGradientSpec,
  u: number,
  v: number
): [number, number, number] {
  const stops =
    gradient.stops.length >= 2
      ? gradient.stops
      : [
          { offset: 0, color: "rgba(138,122,95,1)" },
          { offset: 1, color: "rgba(138,122,95,1)" },
        ]
  let t: number
  if (gradient.type === "radial") {
    const [cx, cy] = gradient.axis
    const dx = u - cx
    const dy = v - cy
    const maxRadius = Math.max(
      0.001,
      Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy))
    )
    t = clamp01(Math.hypot(dx, dy) / maxRadius)
  } else {
    const [ax, ay] = gradient.axis
    const projection = (u - 0.5) * ax + (v - 0.5) * ay
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5
    t = clamp01(projection / maxProjection + 0.5)
  }
  const scaled = t * (stops.length - 1)
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)))
  const mix = scaled - index
  const a = parseRgba(stops[index].color)
  const b = parseRgba(stops[index + 1].color)
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ]
}

function writePixel(
  data: Uint8ClampedArray,
  offset: number,
  red: number,
  green: number,
  blue: number
): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)))
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)))
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)))
  data[offset + 3] = 255
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  return canvas
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  const projection =
    spec.textureProjection && typeof spec.textureProjection === "object"
      ? spec.textureProjection
      : {}
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2]
  texture.colorSpace = colorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(
    typeof repeat[0] === "number" ? repeat[0] : 2,
    typeof repeat[1] === "number" ? repeat[1] : 2
  )
  texture.anisotropy = Math.max(
    1,
    Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8)
  )
  texture.needsUpdate = true
  return texture
}

type ProceduralTextureSet = {
  albedo: THREE.Texture
  roughness: THREE.Texture
  height: THREE.Texture
  normal: THREE.Texture
  ao: THREE.Texture
  source: "reference-pixel-extraction" | "procedural"
}

function referenceMapUrl(
  spec: SculptMaterialSpec,
  channel: string
): string | null {
  const reference = spec.referencePbr
  if (!reference || typeof reference !== "object") return null
  if (reference.usable === false) return null
  const confidence =
    typeof reference.confidence === "number"
      ? reference.confidence
      : typeof reference.estimatedFidelity === "number"
        ? reference.estimatedFidelity
        : 0
  const threshold =
    typeof reference.targetThreshold === "number"
      ? reference.targetThreshold
      : 0.7
  if (confidence < threshold) return null
  const maps = reference.maps
  if (!maps || typeof maps !== "object") return null
  const map = (maps as Record<string, unknown>)[channel]
  if (!map || typeof map !== "object") return null
  const record = map as Record<string, unknown>
  const url =
    typeof record.url === "string" && record.url.trim()
      ? record.url
      : record.path
  return typeof url === "string" && url.trim() ? url : null
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions
): THREE.Texture {
  // Loaded asynchronously — do not touch `needsUpdate` below, or the first
  // render warns "Texture marked for update but no image data found". The
  // loader raises the flag itself once the file lands.
  const texture = new THREE.TextureLoader().load(url)
  const projection =
    spec.textureProjection && typeof spec.textureProjection === "object"
      ? spec.textureProjection
      : {}
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1]
  texture.colorSpace = colorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(
    typeof repeat[0] === "number" ? repeat[0] : 1,
    typeof repeat[1] === "number" ? repeat[1] : 1
  )
  texture.anisotropy = Math.max(
    1,
    Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8)
  )
  return texture
}

function makeReferenceTextureSet(
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions
): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, "albedo")
  const roughness = referenceMapUrl(spec, "roughness")
  const height = referenceMapUrl(spec, "height")
  const normal = referenceMapUrl(spec, "normal")
  const ao = referenceMapUrl(spec, "ao")
  if (!albedo || !roughness || !height || !normal || !ao) return null
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(
      roughness,
      THREE.NoColorSpace,
      spec,
      options
    ),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: "reference-pixel-extraction",
  }
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions
): ProceduralTextureSet | null {
  if (typeof document === "undefined") return null
  const qualityFirst =
    (options.qualityPriority ?? "reference-fidelity") === "reference-fidelity"
  const requested = options.textureSize ?? spec.textureResolution
  const requestedSize =
    typeof requested === "number" && Number.isFinite(requested)
      ? requested
      : qualityFirst
        ? 1024
        : 512
  const size = Math.max(
    256,
    Math.min(2048, 2 ** Math.round(Math.log2(requestedSize)))
  )
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  }
  const contexts = {
    albedo: canvases.albedo.getContext("2d"),
    roughness: canvases.roughness.getContext("2d"),
    height: canvases.height.getContext("2d"),
    normal: canvases.normal.getContext("2d"),
    ao: canvases.ao.getContext("2d"),
  }
  if (
    !contexts.albedo ||
    !contexts.roughness ||
    !contexts.height ||
    !contexts.normal ||
    !contexts.ao
  )
    return null
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  }
  const seed = hashString(id)
  const bands = surfaceBands(spec)
  const heightField = new Float32Array(size * size)
  const roughnessField = new Float32Array(size * size)
  const palette = materialPalette(spec)
  const fallback =
    typeof spec.baseColor === "string" ? spec.baseColor : "#8A7A5F"
  const colors = (
    palette.length >= 2 ? palette : [fallback, "#6E614B", "#A08F70"]
  ).map(hexToRgb)
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ["base"], 0.76))
  const roughnessVariation = clamp01(
    readLayerNumber(spec.roughness, ["variation"], 0.18)
  )
  const colorAmplitude = clamp01(
    readLayerNumber(spec.colorVariation, ["amplitude", "variation"], 0.18)
  )
  const heightCorrelation = clamp01(
    readLayerNumber(spec.colorVariation, ["heightCorrelation"], 0.3)
  )
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient
  for (let y = 0; y < size; y += 1) {
    const v = y / size
    for (let x = 0; x < size; x += 1) {
      const u = x / size
      const index = y * size + x
      const height = sampleSurface(u, v, bands, seed + 101)
      const roughNoise = sampleSurface(u, v, bands, seed + 7001)
      const colorNoise = sampleSurface(u, v, bands, seed + 15013)
      heightField[index] = height
      roughnessField[index] = clamp01(
        baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2
      )
      let color: [number, number, number]
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v)
      } else {
        const paletteValue = clamp01(
          0.5 +
            (colorNoise - 0.5) * colorAmplitude * 2 +
            (height - 0.5) * heightCorrelation
        )
        color = mixPalette(colors, paletteValue)
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2])
    }
  }
  const normalStrength = Math.max(
    0.05,
    readLayerNumber(spec.normal, ["strength", "amplitude"], 0.35)
  )
  const aoStrength = clamp01(
    readLayerNumber(spec.ambientOcclusion, ["cavityStrength", "strength"], 0.35)
  )
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size
    const down = ((y + 1) % size) * size
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size
      const right = (x + 1) % size
      const index = y * size + x
      const center = heightField[index]
      const dx =
        (heightField[y * size + right] - heightField[y * size + left]) *
        normalStrength *
        6
      const dy =
        (heightField[down + x] - heightField[up + x]) * normalStrength * 6
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1)
      const normalX = -dx * inverseLength
      const normalY = -dy * inverseLength
      const normalZ = inverseLength
      const neighborAverage =
        (heightField[y * size + left] +
          heightField[y * size + right] +
          heightField[up + x] +
          heightField[down + x]) *
        0.25
      const cavity = Math.max(0, neighborAverage - center)
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16))
      const offset = index * 4
      const heightByte = center * 255
      const roughnessByte = roughnessField[index] * 255
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte)
      writePixel(
        images.roughness.data,
        offset,
        roughnessByte,
        roughnessByte,
        roughnessByte
      )
      writePixel(
        images.normal.data,
        offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255
      )
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255)
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0)
  contexts.roughness.putImageData(images.roughness, 0, 0)
  contexts.height.putImageData(images.height, 0, 0)
  contexts.normal.putImageData(images.normal, 0, 0)
  contexts.ao.putImageData(images.ao, 0, 0)
  return {
    albedo: createMapTexture(
      canvases.albedo,
      THREE.SRGBColorSpace,
      spec,
      options
    ),
    roughness: createMapTexture(
      canvases.roughness,
      THREE.NoColorSpace,
      spec,
      options
    ),
    height: createMapTexture(
      canvases.height,
      THREE.NoColorSpace,
      spec,
      options
    ),
    normal: createMapTexture(
      canvases.normal,
      THREE.NoColorSpace,
      spec,
      options
    ),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: "procedural",
  }
}

function createSculptMaterial(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
  denseComponent = false
): THREE.MeshPhysicalMaterial {
  const textures =
    makeReferenceTextureSet(spec, options) ??
    makeProceduralTextureSet(id, spec, options)
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures
      ? 1
      : clamp01(readLayerNumber(spec.roughness, ["base"], 0.76)),
    metalness: clampPbrMetalness(
      readLayerNumber(spec.metalness, ["base"], 0.0)
    ),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ["base", "amount"], 0)),
    clearcoatRoughness: clamp01(
      readLayerNumber(spec.clearcoatRoughness, ["base"], 0.25)
    ),
    transmission: clamp01(
      readLayerNumber(spec.transmission, ["base", "amount"], 0)
    ),
    ior: clampPbrIor(readLayerNumber(spec.ior, ["base", "value"], 1.5)),
    thickness: Math.max(
      0,
      readLayerNumber(spec.thickness, ["base", "amount"], 0)
    ),
    attenuationDistance: Math.max(
      0.001,
      readLayerNumber(spec.attenuationDistance, ["base", "value"], Infinity)
    ),
    attenuationColor: new THREE.Color(
      typeof spec.attenuationColor === "string"
        ? spec.attenuationColor
        : "#ffffff"
    ),
    sheen: clamp01(readLayerNumber(spec.sheen, ["base", "amount"], 0)),
    sheenColor: new THREE.Color(
      typeof spec.sheenColor === "string" ? spec.sheenColor : "#ffffff"
    ),
    sheenRoughness: clamp01(
      readLayerNumber(spec.sheenRoughness, ["base"], 1.0)
    ),
    iridescence: clamp01(
      readLayerNumber(spec.iridescence, ["base", "amount"], 0)
    ),
    iridescenceIOR: clampPbrIor(
      readLayerNumber(spec.iridescenceIOR, ["base", "value"], 1.3)
    ),
    anisotropy: clamp01(
      readLayerNumber(spec.anisotropy, ["base", "amount"], 0)
    ),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ["rotation"], 0),
    specularIntensity: clampPbrF0(
      readLayerNumber(
        spec.specularF0 ?? spec.f0 ?? spec.specularIntensity,
        ["base", "value"],
        1.0
      )
    ),
    specularColor: new THREE.Color(
      typeof spec.specularColor === "string" ? spec.specularColor : "#ffffff"
    ),
    emissive: new THREE.Color(
      typeof spec.emissive === "string" ? spec.emissive : "#000000"
    ),
    emissiveIntensity: Math.max(
      0,
      readLayerNumber(spec.emissiveIntensity, ["base"], 1.0)
    ),
    opacity: clamp01(readLayerNumber(spec.opacity, ["base"], 1)),
    transparent:
      readLayerNumber(spec.transmission, ["base", "amount"], 0) > 0 ||
      readLayerNumber(spec.opacity, ["base"], 1) < 1,
    alphaTest: Math.max(
      0,
      readLayerNumber(spec.alpha, ["cutoff", "alphaTest"], 0)
    ),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  })
  if (textures) {
    material.map = textures.albedo
    material.roughnessMap = textures.roughness
    material.normalMap = textures.normal
    material.normalScale.setScalar(
      Math.max(
        0.05,
        readLayerNumber(spec.normal, ["strength", "amplitude"], 0.35)
      )
    )
    material.aoMap = textures.ao
    material.aoMap.channel = 0
    material.aoMapIntensity = readLayerNumber(
      spec.ambientOcclusion,
      ["cavityStrength", "strength"],
      0.35
    )
    const denseMesh =
      denseComponent ||
      spec.denseMesh === true ||
      spec.geometryDensity === "dense" ||
      spec.topologyClass === "dense"
    const bumpScale = Math.max(
      0,
      readLayerNumber(spec.bump, ["amplitude", "strength"], 0)
    )
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height
      material.bumpScale = effectiveBumpScale
    }
    const displacementScale = Math.max(
      0,
      readLayerNumber(spec.displacement, ["amplitude", "strength"], 0)
    )
    const effectiveDisplacementScale = denseMesh
      ? Math.max(0.005, displacementScale)
      : displacementScale
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height
      material.displacementScale = effectiveDisplacementScale
      material.displacementBias = -effectiveDisplacementScale * 0.5
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ["envMapIntensity"], 0.8)
  material.userData.sculptMaterial = spec
  material.userData.proceduralMapsIndependent = true
  material.userData.pbrConstraints = {
    albedoRange: [30, 240],
    binaryMetalness: true,
    f0Range: [0.02, 1],
    iorRange: [1, 2.5],
  }
  material.userData.pbrTextureSource = textures?.source ?? "flat-fallback"
  material.userData.referencePbr = spec.referencePbr ?? null
  material.userData.referenceMaterialId =
    spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null
  material.userData.materialEvidence = spec.materialEvidence ?? null
  material.userData.validationViews =
    spec.materialReference?.validationViews ?? []
  material.needsUpdate = true
  return material
}

type AttachmentEndpoint = {
  start: THREE.Vector3
  midpoint: THREE.Vector3
  quaternion: THREE.Quaternion
  length: number
  baseRadius: number
  endRadius: number
}

function readVector3(
  value: unknown,
  fallback: [number, number, number]
): THREE.Vector3 {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === "number")
  ) {
    return new THREE.Vector3(value[0], value[1], value[2])
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2])
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function makeAttachmentEndpoint(
  attachment: unknown
): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== "object") return null
  const record = attachment as Record<string, unknown>
  const start = readVector3(record.localStart, [0, 0, 0])
  const end = readVector3(record.localEnd, [0, 1, 0])
  const delta = end.clone().sub(start)
  const length = delta.length()
  if (length <= 0.0001) return null
  const direction = delta.clone().normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction
  )
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06))
  const endRadius = Math.max(
    0.003,
    readNumber(record.endRadius, baseRadius * 0.55)
  )
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  }
}

function authoredGeometryEndpoint(): AttachmentEndpoint | null {
  /* patched by tools/patch_paddle_factory.py */
  // This component's form comes from its geometryDescriptor, so it takes the generator's
  // authored-geometry branch instead of the attachment-cylinder branch.
  return null
}

function remapExtrudeUvsToBounds(
  geometry: THREE.BufferGeometry
): THREE.BufferGeometry {
  /* patched by tools/patch_paddle_factory.py */
  // ExtrudeGeometry emits UVs in the shape's local units (metres here). The de-lit reference
  // albedo is authored over the profile bounding box, so normalise to 0..1 or it tiles.
  const uv = geometry.getAttribute("uv")
  if (!uv) return geometry
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return geometry
  const w = box.max.x - box.min.x
  const h = box.max.y - box.min.y
  if (w <= 0 || h <= 0) return geometry

  // Both extrude caps share the shape's XY coordinates, so they share UVs — which means the
  // back cap shows the decal mirrored, read from behind. Mirror U on the back cap only, so the
  // logo reads correctly from both sides. Cap vertices are identified by their normal facing
  // straight down -Z; the side walls (whose normals point outward in XY) are left alone.
  const normal = geometry.getAttribute("normal")
  for (let i = 0; i < uv.count; i += 1) {
    let u = (uv.getX(i) - box.min.x) / w
    const v = (uv.getY(i) - box.min.y) / h
    if (normal && normal.getZ(i) < -0.9) u = 1 - u
    uv.setXY(i, u, v)
  }
  uv.needsUpdate = true
  return geometry
}

// Generated from ObjectSculptSpec target: Paddle Power Pickleball Paddle
// Sculpt build pass: surface-pass
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createPaddlePowerPickleballPaddleModel(
  options: ProceduralModelOptions = {}
): THREE.Group {
  const root = new THREE.Group()
  root.name = "Paddle Power Pickleball Paddle"
  root.userData.reconstructionEvidence = {
    itemFamily: null,
    subtype: null,
    componentAdapter: null,
    route: null,
    exactnessTier: null,
    referenceCamera: {
      solved: false,
      fovDegrees: 40.0,
      aspect: 1.0,
      orientation: { yaw: 0.0, pitch: 0.0, roll: 0.0 },
      positionHint: [0.0, 0.0, 3.0],
      note: "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review.",
    },
    approximationNotes: [],
  }
  root.userData.materialPipeline = {}
  root.userData.materialReferenceRegistry = null

  const materialMap: Record<string, THREE.Material> = {}
  materialMap["faceSkin"] = createSculptMaterial(
    "faceSkin",
    {
      id: "faceSkin",
      name: "Face plate composite skin",
      type: "standard",
      shaderModel: "MeshPhysicalMaterial / PBR",
      baseColor: "#3B4747",
      color: "#3B4747",
      albedo: {
        dominant: "#3B4747",
        secondary: ["#ADCB04", "#EBD8C0", "#2F3838"],
        samplingNotes:
          "Median RGB per region sampled from the reference (see analysis.md Layer 5).",
      },
      colorVariation: {
        palette: ["#3B4747", "#ADCB04", "#EBD8C0", "#2F3838", "#565C53"],
        pattern: "uniform",
        amplitude: 0.06,
        heightCorrelation: 0.2,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: "uv",
        repeat: [1.0, 1.0],
        anisotropy: 8,
        texelDensityIntent:
          "Object-scale texel density; micro detail must not stretch with component scale.",
      },
      surfaceFrequencyBands: [
        {
          id: "macro",
          frequency: 2.0,
          amplitude: 0.35,
          role: "broad colour and height breakup",
        },
        {
          id: "meso",
          frequency: 12.0,
          amplitude: 0.18,
          role: "visible relief",
        },
        {
          id: "micro",
          frequency: 56.0,
          amplitude: 0.07,
          role: "highlight breakup under grazing light",
        },
      ],
      roughness: {
        base: 0.62,
        variation: 0.09,
        map: "independent-procedural-field",
        localResponse:
          "higher roughness in seams and cavities, lower on wear-polished high points",
      },
      metalness: { base: 0.0, variation: 0.0 },
      normal: {
        pattern: "derived-from-independent-height-field",
        strength: 0.09,
        scale: 18.0,
        space: "tangent",
      },
      bump: { pattern: "none", amplitude: 0.0, scale: 1.0 },
      displacement: {
        pattern: "none",
        amplitude: 0.0,
        scale: 1.0,
        silhouetteAffects: false,
      },
      ambientOcclusion: {
        cavityStrength: 0.3,
        contactShadowBias: 0.35,
        notes:
          "Darken seams, ring edges, perforations, and the rim-to-skin junction.",
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: "#2F2A22" },
      localOverrides: [
        {
          id: "faceSkin.decalMap",
          kind: "decal",
          region: {
            x: 0.34,
            y: 0.06,
            width: 0.32,
            height: 0.36,
            units: "normalized",
          },
          albedo: "#ADCB04",
          roughness: 0.58,
          note: "Triangle mark and three text lines; supplied by the de-lit albedo map, not painted procedurally.",
          evidenceRef: "public/images/paddlepower-paddle.jpeg",
          confidence: 0.93,
        },
        {
          id: "faceSkin.rearMirror",
          kind: "assumption",
          region: {
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
            units: "normalized",
          },
          albedo: "#3B4747",
          roughness: 0.62,
          note: "Rear skin mirrors the front; the reference never shows it.",
          evidenceRef: "public/images/paddlepower-paddle.jpeg",
          confidence: 0.35,
        },
      ],
      shaderNotes: [
        "Satin dielectric: metalness pinned at 0, no clearcoat — the reference shows no sheen band across the plate.",
        "Albedo is the de-lit reference crop; do NOT reuse it as roughness/height/normal/AO.",
        "Normal strength cut 0.21 -> 0.09 and bump dropped to 0 after the blockout review: the reference-extracted height field embossed the decal, which is screen print, not relief.",
      ],
      envMapIntensity: 0.14,
      clearcoat: { base: 0.0, roughness: 0.0 },
      referencePbr: {
        version: "1.0",
        sourceImage: "public/images/paddlepower-paddle.jpeg",
        extractor:
          "forge/stage1_intake/extract_pbr_evidence.py + forge/stage1_intake/delight_albedo.py",
        method:
          "orthographic front crop of the face plate, de-lit against a box-blurred luminance proxy, renormalised so the face field median returns to the measured rgb(59,71,71); roughness/height/normal/ao extracted from the same crop and downsampled to 256 px",
        verdict: "usable",
        hardLimit:
          "single-image inference, not inverse rendering; the rear face is a mirror assumption",
        usable: true,
        confidence: 0.78,
        estimatedFidelity: 0.78,
        targetThreshold: 0.7,
        maps: {
          albedo: {
            url: "/images/paddle-face-albedo.jpg",
            colorSpace: "srgb",
            uvOrientation: "y-up, origin bottom-left",
            width: 896,
            height: 1099,
            source: "reference-pixel-extraction",
            notes:
              "De-lit face crop; the decal is the reference's own pixels, not a procedural approximation.",
          },
          roughness: {
            url: "/images/paddle-face-roughness.png",
            colorSpace: "linear",
            uvOrientation: "y-up, origin bottom-left",
            width: 256,
            height: 314,
            source: "reference-pixel-extraction",
            notes: "Extracted roughness field, base 0.688 variation 0.086.",
          },
          height: {
            url: "/images/paddle-face-height.png",
            colorSpace: "linear",
            uvOrientation: "y-up, origin bottom-left",
            width: 256,
            height: 314,
            source: "reference-pixel-extraction",
            notes:
              "Extracted height field; the decal reads very slightly proud, matching the reference.",
          },
          normal: {
            url: "/images/paddle-face-normal.png",
            colorSpace: "linear",
            uvOrientation: "y-up, origin bottom-left",
            width: 256,
            height: 314,
            source: "reference-pixel-extraction",
            notes: "Derived from the independent height field, strength 0.21.",
          },
          ao: {
            url: "/images/paddle-face-ao.png",
            colorSpace: "linear",
            uvOrientation: "y-up, origin bottom-left",
            width: 256,
            height: 314,
            source: "reference-pixel-extraction",
            notes:
              "Cavity occlusion around the decal edges and the rim junction.",
          },
        },
      },
      doubleSided: false,
    },
    options
  )
  materialMap["edgeGuard"] = createSculptMaterial(
    "edgeGuard",
    {
      id: "edgeGuard",
      name: "Edge guard bead",
      type: "standard",
      shaderModel: "MeshPhysicalMaterial / PBR",
      baseColor: "#384344",
      color: "#384344",
      albedo: {
        dominant: "#384344",
        secondary: ["#414D4F", "#2C3536"],
        samplingNotes:
          "Median RGB per region sampled from the reference (see analysis.md Layer 5).",
      },
      colorVariation: {
        palette: ["#384344", "#414D4F", "#2C3536"],
        pattern: "uniform",
        amplitude: 0.06,
        heightCorrelation: 0.2,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: "uv",
        repeat: [1.0, 1.0],
        anisotropy: 8,
        texelDensityIntent:
          "Object-scale texel density; micro detail must not stretch with component scale.",
      },
      surfaceFrequencyBands: [
        {
          id: "macro",
          frequency: 2.0,
          amplitude: 0.35,
          role: "broad colour and height breakup",
        },
        {
          id: "meso",
          frequency: 12.0,
          amplitude: 0.18,
          role: "visible relief",
        },
        {
          id: "micro",
          frequency: 56.0,
          amplitude: 0.07,
          role: "highlight breakup under grazing light",
        },
      ],
      roughness: {
        base: 0.7,
        variation: 0.1,
        map: "independent-procedural-field",
        localResponse:
          "higher roughness in seams and cavities, lower on wear-polished high points",
      },
      metalness: { base: 0.0, variation: 0.0 },
      normal: {
        pattern: "derived-from-independent-height-field",
        strength: 0.3,
        scale: 90.0,
        space: "tangent",
      },
      bump: { pattern: "none", amplitude: 0.0003, scale: 1.0 },
      displacement: {
        pattern: "none",
        amplitude: 0.0,
        scale: 1.0,
        silhouetteAffects: false,
      },
      ambientOcclusion: {
        cavityStrength: 0.38,
        contactShadowBias: 0.35,
        notes:
          "Darken seams, ring edges, perforations, and the rim-to-skin junction.",
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: "#2F2A22" },
      localOverrides: [
        {
          id: "edgeGuard.seamStipple",
          kind: "relief",
          region: {
            x: 0.246,
            y: 0.006,
            width: 0.504,
            height: 0.1,
            units: "normalized",
          },
          albedo: "#333D3E",
          roughness: 0.78,
          note: "Fine irregular stipple along the outer line, strongest along the upper perimeter.",
          evidenceRef: "public/images/paddlepower-paddle.jpeg",
          confidence: 0.55,
        },
      ],
      shaderNotes: [
        "Reads marginally darker and rougher than the face field (measured 55/66/68 vs 59/71/71).",
        "The left/right sample difference in the reference is the key light, not two albedos — do not bake it in.",
        "Reference PBR map extraction is deliberately not run for this material: its visible footprint in the reference is too small to yield evidence rather than noise. Its response comes from measured median albedo plus authored roughness/metalness, which is stated here rather than hidden behind a passing gate. 12-18 px wide band in the reference.",
      ],
      envMapIntensity: 0.14,
      doubleSided: false,
      qualityTier: "utility",
    },
    options
  )
  materialMap["collarPolymer"] = createSculptMaterial(
    "collarPolymer",
    {
      id: "collarPolymer",
      name: "Collar ring polymer",
      type: "standard",
      shaderModel: "MeshPhysicalMaterial / PBR",
      baseColor: "#1A1D21",
      color: "#1A1D21",
      albedo: {
        dominant: "#1A1D21",
        secondary: ["#262A2E", "#0E1013"],
        samplingNotes:
          "Median RGB per region sampled from the reference (see analysis.md Layer 5).",
      },
      colorVariation: {
        palette: ["#1A1D21", "#262A2E", "#0E1013"],
        pattern: "uniform",
        amplitude: 0.06,
        heightCorrelation: 0.2,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: "uv",
        repeat: [1.0, 1.0],
        anisotropy: 8,
        texelDensityIntent:
          "Object-scale texel density; micro detail must not stretch with component scale.",
      },
      surfaceFrequencyBands: [
        {
          id: "macro",
          frequency: 2.0,
          amplitude: 0.35,
          role: "broad colour and height breakup",
        },
        {
          id: "meso",
          frequency: 12.0,
          amplitude: 0.18,
          role: "visible relief",
        },
        {
          id: "micro",
          frequency: 56.0,
          amplitude: 0.07,
          role: "highlight breakup under grazing light",
        },
      ],
      roughness: {
        base: 0.34,
        variation: 0.08,
        map: "independent-procedural-field",
        localResponse:
          "higher roughness in seams and cavities, lower on wear-polished high points",
      },
      metalness: { base: 0.0, variation: 0.0 },
      normal: {
        pattern: "derived-from-independent-height-field",
        strength: 0.18,
        scale: 60.0,
        space: "tangent",
      },
      bump: { pattern: "none", amplitude: 0.0, scale: 1.0 },
      displacement: {
        pattern: "none",
        amplitude: 0.0,
        scale: 1.0,
        silhouetteAffects: false,
      },
      ambientOcclusion: {
        cavityStrength: 0.42,
        contactShadowBias: 0.35,
        notes:
          "Darken seams, ring edges, perforations, and the rim-to-skin junction.",
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: "#2F2A22" },
      localOverrides: [
        {
          id: "collarPolymer.turnLines",
          kind: "linework",
          region: {
            x: 0.45,
            y: 0.677,
            width: 0.1,
            height: 0.036,
            units: "normalized",
          },
          albedo: "#22262A",
          roughness: 0.28,
          note: "Circumferential turn lines catching a thin specular band.",
          evidenceRef: "public/images/paddlepower-paddle.jpeg",
          confidence: 0.5,
        },
      ],
      shaderNotes: [
        "Satin near-black polymer; low roughness gives the thin highlight seen at the ring edges.",
        "Reference PBR map extraction is deliberately not run for this material: its visible footprint in the reference is too small to yield evidence rather than noise. Its response comes from measured median albedo plus authored roughness/metalness, which is stated here rather than hidden behind a passing gate. Two rings, 20 px and 22 px tall.",
      ],
      envMapIntensity: 0.14,
      doubleSided: false,
      qualityTier: "utility",
    },
    options
  )
  materialMap["collarGold"] = createSculptMaterial(
    "collarGold",
    {
      id: "collarGold",
      name: "Collar ring gold",
      type: "standard",
      shaderModel: "MeshPhysicalMaterial / PBR",
      baseColor: "#B6995C",
      color: "#B6995C",
      albedo: {
        dominant: "#B6995C",
        secondary: ["#E0CEA6", "#8C7444"],
        samplingNotes:
          "Median RGB per region sampled from the reference (see analysis.md Layer 5).",
      },
      colorVariation: {
        palette: ["#B6995C", "#E0CEA6", "#8C7444"],
        pattern: "uniform",
        amplitude: 0.06,
        heightCorrelation: 0.2,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: "uv",
        repeat: [1.0, 1.0],
        anisotropy: 8,
        texelDensityIntent:
          "Object-scale texel density; micro detail must not stretch with component scale.",
      },
      surfaceFrequencyBands: [
        {
          id: "macro",
          frequency: 2.0,
          amplitude: 0.35,
          role: "broad colour and height breakup",
        },
        {
          id: "meso",
          frequency: 12.0,
          amplitude: 0.18,
          role: "visible relief",
        },
        {
          id: "micro",
          frequency: 56.0,
          amplitude: 0.07,
          role: "highlight breakup under grazing light",
        },
      ],
      roughness: {
        base: 0.22,
        variation: 0.12,
        map: "independent-procedural-field",
        localResponse:
          "higher roughness in seams and cavities, lower on wear-polished high points",
      },
      metalness: { base: 1.0, variation: 0.0 },
      normal: {
        pattern: "derived-from-independent-height-field",
        strength: 0.15,
        scale: 120.0,
        space: "tangent",
      },
      bump: { pattern: "none", amplitude: 0.0, scale: 1.0 },
      displacement: {
        pattern: "none",
        amplitude: 0.0,
        scale: 1.0,
        silhouetteAffects: false,
      },
      ambientOcclusion: {
        cavityStrength: 0.25,
        contactShadowBias: 0.35,
        notes:
          "Darken seams, ring edges, perforations, and the rim-to-skin junction.",
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: "#2F2A22" },
      localOverrides: [
        {
          id: "collarGold.brushGrain",
          kind: "gloss",
          region: {
            x: 0.45,
            y: 0.688,
            width: 0.1,
            height: 0.014,
            units: "normalized",
          },
          albedo: "#C9AC70",
          roughness: 0.28,
          note: "Value varies across the ring's own width — the cue that identified it as metal.",
          evidenceRef: "public/images/paddlepower-paddle.jpeg",
          confidence: 0.7,
        },
      ],
      shaderNotes: [
        "The only metal on the object: binary metalness 1.0, no dielectric blend.",
        "Anisotropy along the turning direction keeps the highlight a band, not a dot.",
        "Reference PBR map extraction is deliberately not run for this material: its visible footprint in the reference is too small to yield evidence rather than noise. Its response comes from measured median albedo plus authored roughness/metalness, which is stated here rather than hidden behind a passing gate. One ring, 28 px tall. Identity comes from measured albedo rgb(182,153,92) and binary metalness 1.0, not from extracted maps.",
        "Roughness 0.35 -> 0.22 and envMapIntensity 0.8 -> 1.35 after the structural review: the band was reading as dull brass rather than the reference's bright polished gold.",
      ],
      envMapIntensity: 0.44,
      doubleSided: false,
      qualityTier: "utility",
    },
    options
  )
  materialMap["gripWrap"] = createSculptMaterial(
    "gripWrap",
    {
      id: "gripWrap",
      name: "Grip overwrap PU",
      type: "standard",
      shaderModel: "MeshPhysicalMaterial / PBR",
      baseColor: "#E4D3B6",
      color: "#E4D3B6",
      albedo: {
        dominant: "#E4D3B6",
        secondary: ["#C8B698", "#F0E2C6"],
        samplingNotes:
          "Median RGB per region sampled from the reference (see analysis.md Layer 5).",
      },
      colorVariation: {
        palette: ["#E4D3B6", "#C8B698", "#F0E2C6"],
        pattern: "uniform",
        amplitude: 0.06,
        heightCorrelation: 0.2,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: "uv",
        repeat: [3.0, 2.0],
        anisotropy: 8,
        texelDensityIntent:
          "Object-scale texel density; micro detail must not stretch with component scale.",
      },
      surfaceFrequencyBands: [
        {
          id: "macro",
          frequency: 2.0,
          amplitude: 0.35,
          role: "broad colour and height breakup",
        },
        {
          id: "meso",
          frequency: 12.0,
          amplitude: 0.18,
          role: "visible relief",
        },
        {
          id: "micro",
          frequency: 56.0,
          amplitude: 0.07,
          role: "highlight breakup under grazing light",
        },
      ],
      roughness: {
        base: 0.84,
        variation: 0.11,
        map: "independent-procedural-field",
        localResponse:
          "higher roughness in seams and cavities, lower on wear-polished high points",
      },
      metalness: { base: 0.0, variation: 0.0 },
      normal: {
        pattern: "derived-from-independent-height-field",
        strength: 0.45,
        scale: 140.0,
        space: "tangent",
      },
      bump: { pattern: "none", amplitude: 0.0007, scale: 1.0 },
      displacement: {
        pattern: "none",
        amplitude: 0.0,
        scale: 1.0,
        silhouetteAffects: false,
      },
      ambientOcclusion: {
        cavityStrength: 0.4,
        contactShadowBias: 0.35,
        notes:
          "Darken seams, ring edges, perforations, and the rim-to-skin junction.",
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: "#2F2A22" },
      localOverrides: [
        {
          id: "gripWrap.perforationField",
          kind: "hole",
          region: {
            x: 0.45,
            y: 0.732,
            width: 0.1,
            height: 0.19,
            units: "normalized",
          },
          albedo: "#B7A588",
          roughness: 0.9,
          note: "Sparse round perforations, measured dark-pixel fraction 0.036 — explicitly not a dense knurl.",
          evidenceRef: "public/images/paddlepower-paddle.jpeg",
          confidence: 0.8,
        },
        {
          id: "gripWrap.terminalSeam",
          kind: "seam",
          region: {
            x: 0.45,
            y: 0.715,
            width: 0.1,
            height: 0.02,
            units: "normalized",
          },
          albedo: "#C4B294",
          roughness: 0.88,
          note: "Diagonal cut edge where the wrap terminates below the collar.",
          evidenceRef: "public/images/paddlepower-paddle.jpeg",
          confidence: 0.6,
        },
      ],
      shaderNotes: [
        "Matte PU: high roughness with a soft normal so the perforations read without a plastic highlight.",
      ],
      envMapIntensity: 0.22,
      doubleSided: false,
      referencePbr: {
        version: "1.0",
        sourceImage: "public/images/paddlepower-paddle.jpeg",
        extractor: "forge/stage1_intake/extract_pbr_evidence.py",
        method:
          "crop of the wrap barrel (x 935-1110, y 1500-1890), extracted to five independent channels and downsampled to 128 px; tiled around the barrel",
        verdict: "pass",
        hardLimit:
          "single-image inference; perforation depth is read from shading, not measured",
        usable: true,
        confidence: 0.751,
        estimatedFidelity: 0.751,
        targetThreshold: 0.7,
        maps: {
          albedo: {
            url: "/images/paddle-grip-albedo.jpg",
            colorSpace: "srgb",
            uvOrientation: "y-up, origin bottom-left",
            width: 128,
            height: 286,
            source: "reference-pixel-extraction",
            notes: "Cream PU wrap, median rgb(228,211,182).",
          },
          roughness: {
            url: "/images/paddle-grip-roughness.png",
            colorSpace: "linear",
            uvOrientation: "y-up, origin bottom-left",
            width: 128,
            height: 286,
            source: "reference-pixel-extraction",
            notes: "Extracted roughness, base 0.73.",
          },
          height: {
            url: "/images/paddle-grip-height.png",
            colorSpace: "linear",
            uvOrientation: "y-up, origin bottom-left",
            width: 128,
            height: 286,
            source: "reference-pixel-extraction",
            notes: "Perforation dimples and wrap grain.",
          },
          normal: {
            url: "/images/paddle-grip-normal.png",
            colorSpace: "linear",
            uvOrientation: "y-up, origin bottom-left",
            width: 128,
            height: 286,
            source: "reference-pixel-extraction",
            notes: "From the independent height field, strength 0.274.",
          },
          ao: {
            url: "/images/paddle-grip-ao.png",
            colorSpace: "linear",
            uvOrientation: "y-up, origin bottom-left",
            width: 128,
            height: 286,
            source: "reference-pixel-extraction",
            notes: "Occlusion inside the perforations.",
          },
        },
      },
    },
    options
  )
  materialMap["handleCore"] = createSculptMaterial(
    "handleCore",
    {
      id: "handleCore",
      name: "Handle core (inferred)",
      type: "standard",
      shaderModel: "MeshPhysicalMaterial / PBR",
      baseColor: "#2A2C2E",
      color: "#2A2C2E",
      albedo: {
        dominant: "#2A2C2E",
        secondary: ["#1E2022", "#36393B"],
        samplingNotes:
          "Median RGB per region sampled from the reference (see analysis.md Layer 5).",
      },
      colorVariation: {
        palette: ["#2A2C2E", "#1E2022", "#36393B"],
        pattern: "uniform",
        amplitude: 0.06,
        heightCorrelation: 0.2,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: "uv",
        repeat: [1.0, 1.0],
        anisotropy: 8,
        texelDensityIntent:
          "Object-scale texel density; micro detail must not stretch with component scale.",
      },
      surfaceFrequencyBands: [
        {
          id: "macro",
          frequency: 2.0,
          amplitude: 0.35,
          role: "broad colour and height breakup",
        },
        {
          id: "meso",
          frequency: 12.0,
          amplitude: 0.18,
          role: "visible relief",
        },
        {
          id: "micro",
          frequency: 56.0,
          amplitude: 0.07,
          role: "highlight breakup under grazing light",
        },
      ],
      roughness: {
        base: 0.65,
        variation: 0.08,
        map: "independent-procedural-field",
        localResponse:
          "higher roughness in seams and cavities, lower on wear-polished high points",
      },
      metalness: { base: 0.0, variation: 0.0 },
      normal: {
        pattern: "derived-from-independent-height-field",
        strength: 0.2,
        scale: 40.0,
        space: "tangent",
      },
      bump: { pattern: "none", amplitude: 0.0, scale: 1.0 },
      displacement: {
        pattern: "none",
        amplitude: 0.0,
        scale: 1.0,
        silhouetteAffects: false,
      },
      ambientOcclusion: {
        cavityStrength: 0.35,
        contactShadowBias: 0.35,
        notes:
          "Darken seams, ring edges, perforations, and the rim-to-skin junction.",
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: "#2F2A22" },
      localOverrides: [
        {
          id: "handleCore.inferredOctagon",
          kind: "bevel",
          region: {
            x: 0.45,
            y: 0.715,
            width: 0.1,
            height: 0.21,
            units: "normalized",
          },
          albedo: "#2A2C2E",
          roughness: 0.65,
          note: "Octagonal facets assumed from category convention; the wrap hides the core in every reference pixel.",
          evidenceRef: "public/images/paddlepower-paddle.jpeg",
          confidence: 0.3,
        },
      ],
      shaderNotes: [
        "Never visible in the reference. Present so the wrap has a bed and the explode view has a shaft.",
        "Reference PBR map extraction is deliberately not run for this material: its visible footprint in the reference is too small to yield evidence rather than noise. Its response comes from measured median albedo plus authored roughness/metalness, which is stated here rather than hidden behind a passing gate. Zero visible pixels — fully hidden by the wrap and collar.",
      ],
      envMapIntensity: 0.14,
      doubleSided: false,
      qualityTier: "utility",
    },
    options
  )
  materialMap["hidden"] = createSculptMaterial(
    "hidden",
    {
      id: "hidden",
      name: "Rig root (non-rendering)",
      type: "standard",
      shaderModel: "MeshPhysicalMaterial / PBR",
      baseColor: "#000000",
      color: "#000000",
      albedo: {
        dominant: "#000000",
        secondary: ["#000000", "#000000"],
        samplingNotes:
          "Median RGB per region sampled from the reference (see analysis.md Layer 5).",
      },
      colorVariation: {
        palette: ["#000000", "#000000", "#000000"],
        pattern: "uniform",
        amplitude: 0.06,
        heightCorrelation: 0.2,
      },
      textureResolution: 1024,
      textureProjection: {
        mode: "uv",
        repeat: [1.0, 1.0],
        anisotropy: 8,
        texelDensityIntent:
          "Object-scale texel density; micro detail must not stretch with component scale.",
      },
      surfaceFrequencyBands: [
        {
          id: "macro",
          frequency: 2.0,
          amplitude: 0.35,
          role: "broad colour and height breakup",
        },
        {
          id: "meso",
          frequency: 12.0,
          amplitude: 0.18,
          role: "visible relief",
        },
        {
          id: "micro",
          frequency: 56.0,
          amplitude: 0.07,
          role: "highlight breakup under grazing light",
        },
      ],
      roughness: {
        base: 1.0,
        variation: 0.0,
        map: "independent-procedural-field",
        localResponse:
          "higher roughness in seams and cavities, lower on wear-polished high points",
      },
      metalness: { base: 0.0, variation: 0.0 },
      normal: {
        pattern: "derived-from-independent-height-field",
        strength: 0.05,
        scale: 24.0,
        space: "tangent",
      },
      bump: { pattern: "none", amplitude: 0.0, scale: 1.0 },
      displacement: {
        pattern: "none",
        amplitude: 0.0,
        scale: 1.0,
        silhouetteAffects: false,
      },
      ambientOcclusion: {
        cavityStrength: 0.0,
        contactShadowBias: 0.35,
        notes:
          "Darken seams, ring edges, perforations, and the rim-to-skin junction.",
      },
      wear: { edgeWear: 0.0, scratches: [], chips: [] },
      dirt: { amount: 0.0, cavityBias: 0.0, color: "#2F2A22" },
      localOverrides: [],
      shaderNotes: [
        "Zero-opacity root so the rig hierarchy exists without adding a visible box.",
        "Reference PBR map extraction is deliberately not run for this material: its visible footprint in the reference is too small to yield evidence rather than noise. Its response comes from measured median albedo plus authored roughness/metalness, which is stated here rather than hidden behind a passing gate. Non-rendering rig root.",
      ],
      envMapIntensity: 0.8,
      opacity: { base: 0.0 },
      doubleSided: false,
      qualityTier: "utility",
    },
    options
  )

  const nodes: Record<string, THREE.Object3D> = { root }
  const meshes: Record<string, THREE.Mesh> = {}
  const sockets: Record<string, THREE.Object3D> = {}
  const colliders: Record<string, unknown> = {}
  const destructionGroups: Record<string, THREE.Object3D[]> = {}

  const attachment_root_0 = null
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0)
  const node_root_0 = new THREE.Group()
  node_root_0.name = "Paddle Power paddle (root)__pivot"
  node_root_0.scale.set(1, 1, 1)
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start)
    node_root_0.rotation.set(0.0, 0.0, 0.0)
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0)
    node_root_0.rotation.set(0.0, 0.0, 0.0)
  }
  node_root_0.userData.sculptComponent = {
    level: "macro",
    role: "body",
    importance: 1.0,
    confidence: 0.95,
    materialLayers: ["hidden"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["root.swingPivot"],
    evidenceRefs: ["full-object"],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    surfaceDetail: {
      macroRoughness: 0.2,
      microRoughness: 0.1,
      bumpAmplitude: 0.0,
      normalPattern: "none",
      displacementPattern: "none",
      occlusionPattern: "seam-cavity",
    },
    id: "root",
    name: "Paddle Power paddle (root)",
    primitive: "box",
    parent: null,
    attachment: null,
    topologyClass: "material-only",
    topologyRationale:
      "Not a surface at all: a zero-scale, zero-opacity rig node that exists so the hierarchy has a single motion root with the swing pivot and sweet-spot sockets on it. It contributes no pixels, so it has no albedo to compare against the render.",
    geometryDescriptor: {
      topologyIntent: "zero-scale rig root; carries no visible surface",
      edgeTreatment: { type: "none", bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy: "none",
      normalStrategy: "none",
    },
    dimensions: {
      width: 0.0001,
      height: 0.0001,
      depth: 0.0001,
      units: "meters",
      confidence: 1.0,
    },
    material: "hidden",
    actionProfile: {
      animationRole: "root",
      pivot: {
        mode: "socket",
        localPosition: [0.0, 0.07, 0.0],
        axis: [0, 1, 0],
        confidence: 0.9,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: true,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [
        {
          id: "grip-hand",
          localPosition: [0.0, 0.07, 0.0],
          axis: [0, 1, 0],
          notes:
            "Hand/controller attach point; the swing pivot in the reference grip.",
        },
        {
          id: "sweet-spot",
          localPosition: [0.0, 0.29, 0.0058],
          axis: [0, 0, 1],
          notes:
            "Ball contact point on the front face, at the face plate centroid.",
        },
      ],
      collider: {
        type: "capsule",
        offset: [0, 0.21, 0],
        scale: [0.214, 0.42, 0.016],
        isTrigger: false,
        notes: "Whole-object proxy for a swing arc.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "paddle-root",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
  }
  node_root_0.userData.actionProfile = {
    animationRole: "root",
    pivot: {
      mode: "socket",
      localPosition: [0.0, 0.07, 0.0],
      axis: [0, 1, 0],
      confidence: 0.9,
    },
    transformChannels: {
      translate: true,
      rotate: true,
      scale: true,
      bend: false,
      twist: false,
      detach: true,
      visibility: true,
      materialState: true,
    },
    sockets: [
      {
        id: "grip-hand",
        localPosition: [0.0, 0.07, 0.0],
        axis: [0, 1, 0],
        notes:
          "Hand/controller attach point; the swing pivot in the reference grip.",
      },
      {
        id: "sweet-spot",
        localPosition: [0.0, 0.29, 0.0058],
        axis: [0, 0, 1],
        notes:
          "Ball contact point on the front face, at the face plate centroid.",
      },
    ],
    collider: {
      type: "capsule",
      offset: [0, 0.21, 0],
      scale: [0.214, 0.42, 0.016],
      isTrigger: false,
      notes: "Whole-object proxy for a swing arc.",
    },
    constraints: [],
    destruction: {
      breakable: false,
      fractureGroup: "paddle-root",
      seamRefs: [],
      detachableFragments: [],
      breakImpulse: 0.0,
      debrisMaterial: "base",
    },
  }
  ;(nodes["root"] ?? root).add(node_root_0)
  nodes["root"] = node_root_0
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(
        endpoint_root_0.endRadius,
        endpoint_root_0.baseRadius,
        endpoint_root_0.length,
        16,
        6
      )
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4)
  if (!endpoint_root_0) {
    mesh_root_0Geometry.scale(0.0001, 0.0001, 0.0001)
  }
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["hidden"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  )
  mesh_root_0.name = "Paddle Power paddle (root)"
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint)
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion)
  }
  mesh_root_0.castShadow = options.castShadow ?? true
  mesh_root_0.receiveShadow = options.receiveShadow ?? true
  mesh_root_0.userData.sculptComponent = {
    level: "macro",
    role: "body",
    importance: 1.0,
    confidence: 0.95,
    materialLayers: ["hidden"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["root.swingPivot"],
    evidenceRefs: ["full-object"],
    transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    surfaceDetail: {
      macroRoughness: 0.2,
      microRoughness: 0.1,
      bumpAmplitude: 0.0,
      normalPattern: "none",
      displacementPattern: "none",
      occlusionPattern: "seam-cavity",
    },
    id: "root",
    name: "Paddle Power paddle (root)",
    primitive: "box",
    parent: null,
    attachment: null,
    topologyClass: "material-only",
    topologyRationale:
      "Not a surface at all: a zero-scale, zero-opacity rig node that exists so the hierarchy has a single motion root with the swing pivot and sweet-spot sockets on it. It contributes no pixels, so it has no albedo to compare against the render.",
    geometryDescriptor: {
      topologyIntent: "zero-scale rig root; carries no visible surface",
      edgeTreatment: { type: "none", bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy: "none",
      normalStrategy: "none",
    },
    dimensions: {
      width: 0.0001,
      height: 0.0001,
      depth: 0.0001,
      units: "meters",
      confidence: 1.0,
    },
    material: "hidden",
    actionProfile: {
      animationRole: "root",
      pivot: {
        mode: "socket",
        localPosition: [0.0, 0.07, 0.0],
        axis: [0, 1, 0],
        confidence: 0.9,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: true,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [
        {
          id: "grip-hand",
          localPosition: [0.0, 0.07, 0.0],
          axis: [0, 1, 0],
          notes:
            "Hand/controller attach point; the swing pivot in the reference grip.",
        },
        {
          id: "sweet-spot",
          localPosition: [0.0, 0.29, 0.0058],
          axis: [0, 0, 1],
          notes:
            "Ball contact point on the front face, at the face plate centroid.",
        },
      ],
      collider: {
        type: "capsule",
        offset: [0, 0.21, 0],
        scale: [0.214, 0.42, 0.016],
        isTrigger: false,
        notes: "Whole-object proxy for a swing arc.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "paddle-root",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
  }
  node_root_0.add(mesh_root_0)
  meshes["root"] = mesh_root_0
  colliders["root"] = {
    type: "capsule",
    offset: [0, 0.21, 0],
    scale: [0.214, 0.42, 0.016],
    isTrigger: false,
    notes: "Whole-object proxy for a swing arc.",
  }
  destructionGroups["paddle-root"] ??= []
  destructionGroups["paddle-root"].push(node_root_0)
  const socket_root_grip_hand_0 = new THREE.Object3D()
  socket_root_grip_hand_0.name = "grip-hand"
  socket_root_grip_hand_0.position.set(0.0, 0.07, 0.0)
  socket_root_grip_hand_0.rotation.set(0, 0, 0)
  socket_root_grip_hand_0.userData.socket = {
    id: "grip-hand",
    localPosition: [0.0, 0.07, 0.0],
    axis: [0, 1, 0],
    notes:
      "Hand/controller attach point; the swing pivot in the reference grip.",
  }
  node_root_0.add(socket_root_grip_hand_0)
  sockets["root:grip-hand"] = socket_root_grip_hand_0
  const socket_root_sweet_spot_1 = new THREE.Object3D()
  socket_root_sweet_spot_1.name = "sweet-spot"
  socket_root_sweet_spot_1.position.set(0.0, 0.29, 0.0058)
  socket_root_sweet_spot_1.rotation.set(0, 0, 0)
  socket_root_sweet_spot_1.userData.socket = {
    id: "sweet-spot",
    localPosition: [0.0, 0.29, 0.0058],
    axis: [0, 0, 1],
    notes: "Ball contact point on the front face, at the face plate centroid.",
  }
  node_root_0.add(socket_root_sweet_spot_1)
  sockets["root:sweet-spot"] = socket_root_sweet_spot_1

  const attachment_facePlate_1 = {
    parentId: "root",
    parentSocket: "grip-hand",
    localStart: [0.0, 0.1329, 0.0],
    localEnd: [0.0, 0.42, 0.0],
    contactType: "fused",
    overlap: 0.0135,
    gapTolerance: 0.0002,
    contactNormal: [0, 1, 0],
    evidenceRefs: ["full-object"],
    notes:
      "Throat runs down into the collar; overlap is the collar embed depth.",
  }
  // /* patched by tools/patch_paddle_factory.py */ authored geometryDescriptor form, not an attachment cylinder.
  void makeAttachmentEndpoint(attachment_facePlate_1)
  const endpoint_facePlate_1 = authoredGeometryEndpoint()
  const node_facePlate_1 = new THREE.Group()
  node_facePlate_1.name = "Face plate__pivot"
  node_facePlate_1.scale.set(1, 1, 1)
  if (endpoint_facePlate_1) {
    node_facePlate_1.position.copy(endpoint_facePlate_1.start)
    node_facePlate_1.rotation.set(0.0, 0.0, 0.0)
  } else {
    node_facePlate_1.position.set(0.0, 0.0, -0.0058)
    node_facePlate_1.rotation.set(0.0, 0.0, 0.0)
  }
  node_facePlate_1.userData.sculptComponent = {
    level: "macro",
    role: "body",
    importance: 1.0,
    confidence: 0.9,
    materialLayers: ["faceSkin"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["facePlate.cornerRadiusRatio", "throat.tangentFillet"],
    evidenceRefs: ["full-object"],
    transform: {
      position: [0, 0, -0.0058],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    surfaceDetail: {
      macroRoughness: 0.18,
      microRoughness: 0.09,
      bumpAmplitude: 0.0004,
      normalPattern: "reference-derived tangent normal from the de-lit crop",
      displacementPattern: "none",
      occlusionPattern: "decal-edge cavity",
    },
    id: "facePlate",
    name: "Face plate",
    primitive: "extrude",
    parent: "root",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A constant-thickness composite panel with a flat front and back skin; its form is fully described by one measured 2D outline plus a depth, not by a sculpted volume.",
    geometryDescriptor: {
      topologyIntent: "closed slab lofted from the measured 2D silhouette",
      edgeTreatment: { type: "none", bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy:
        "planar-XY normalized to the profile bounding box; the generated extrude UVs are in local metres and MUST be remapped to 0..1 over the profile bbox before the de-lit face albedo is applied (see assumptions: uv-remap-hand-refinement)",
      normalStrategy: "vertex normals from generated geometry",
      profile2D: {
        points: [
          [0.01945, 0.42],
          [0.05073, 0.41731],
          [0.05899, 0.41462],
          [0.05954, 0.41441],
          [0.06547, 0.41172],
          [0.07025, 0.40903],
          [0.07059, 0.40882],
          [0.07439, 0.40634],
          [0.07834, 0.40344],
          [0.0786, 0.40323],
          [0.08152, 0.40075],
          [0.08435, 0.39806],
          [0.08477, 0.39764],
          [0.0872, 0.39516],
          [0.08988, 0.39206],
          [0.09408, 0.38626],
          [0.09744, 0.38067],
          [0.10011, 0.37508],
          [0.10227, 0.36949],
          [0.10398, 0.3639],
          [0.1052, 0.35811],
          [0.1064, 0.35252],
          [0.10665, 0.34693],
          [0.10681, 0.34134],
          [0.10681, 0.33575],
          [0.10671, 0.32996],
          [0.10666, 0.32437],
          [0.10652, 0.31878],
          [0.1064, 0.31319],
          [0.1064, 0.3076],
          [0.1064, 0.3018],
          [0.10629, 0.29621],
          [0.10626, 0.29063],
          [0.10624, 0.28504],
          [0.10619, 0.27945],
          [0.10619, 0.27365],
          [0.10621, 0.26806],
          [0.10629, 0.26247],
          [0.10636, 0.25689],
          [0.1064, 0.2513],
          [0.10651, 0.2455],
          [0.10671, 0.23991],
          [0.10658, 0.23432],
          [0.10622, 0.22873],
          [0.1056, 0.22314],
          [0.10458, 0.21735],
          [0.10322, 0.21176],
          [0.10135, 0.20617],
          [0.09904, 0.20058],
          [0.09613, 0.19499],
          [0.09234, 0.1892],
          [0.08794, 0.18361],
          [0.08235, 0.17802],
          [0.07508, 0.17243],
          [0.06654, 0.16684],
          [0.06404, 0.16539],
          [0.05972, 0.16291],
          [0.05659, 0.16104],
          [0.05557, 0.16042],
          [0.05174, 0.15794],
          [0.04817, 0.15546],
          [0.04487, 0.15297],
          [0.04202, 0.15049],
          [0.0414, 0.14987],
          [0.03954, 0.148],
          [0.03721, 0.14552],
          [0.0362, 0.14428],
          [0.03519, 0.14304],
          [0.03336, 0.14055],
          [0.03208, 0.13869],
          [0.03169, 0.13807],
          [0.03018, 0.13558],
          [0.02944, 0.13289],
          [-0.02944, 0.13289],
          [-0.03018, 0.13558],
          [-0.03169, 0.13807],
          [-0.03208, 0.13869],
          [-0.03336, 0.14055],
          [-0.03519, 0.14304],
          [-0.0362, 0.14428],
          [-0.03721, 0.14552],
          [-0.03954, 0.148],
          [-0.0414, 0.14987],
          [-0.04202, 0.15049],
          [-0.04487, 0.15297],
          [-0.04817, 0.15546],
          [-0.05174, 0.15794],
          [-0.05557, 0.16042],
          [-0.05659, 0.16104],
          [-0.05972, 0.16291],
          [-0.06404, 0.16539],
          [-0.06654, 0.16684],
          [-0.07508, 0.17243],
          [-0.08235, 0.17802],
          [-0.08794, 0.18361],
          [-0.09234, 0.1892],
          [-0.09613, 0.19499],
          [-0.09904, 0.20058],
          [-0.10135, 0.20617],
          [-0.10322, 0.21176],
          [-0.10458, 0.21735],
          [-0.1056, 0.22314],
          [-0.10622, 0.22873],
          [-0.10658, 0.23432],
          [-0.10671, 0.23991],
          [-0.10651, 0.2455],
          [-0.1064, 0.2513],
          [-0.10636, 0.25689],
          [-0.10629, 0.26247],
          [-0.10621, 0.26806],
          [-0.10619, 0.27365],
          [-0.10619, 0.27945],
          [-0.10624, 0.28504],
          [-0.10626, 0.29063],
          [-0.10629, 0.29621],
          [-0.1064, 0.3018],
          [-0.1064, 0.3076],
          [-0.1064, 0.31319],
          [-0.10652, 0.31878],
          [-0.10666, 0.32437],
          [-0.10671, 0.32996],
          [-0.10681, 0.33575],
          [-0.10681, 0.34134],
          [-0.10665, 0.34693],
          [-0.1064, 0.35252],
          [-0.1052, 0.35811],
          [-0.10398, 0.3639],
          [-0.10227, 0.36949],
          [-0.10011, 0.37508],
          [-0.09744, 0.38067],
          [-0.09408, 0.38626],
          [-0.08988, 0.39206],
          [-0.0872, 0.39516],
          [-0.08477, 0.39764],
          [-0.08435, 0.39806],
          [-0.08152, 0.40075],
          [-0.0786, 0.40323],
          [-0.07834, 0.40344],
          [-0.07439, 0.40634],
          [-0.07059, 0.40882],
          [-0.07025, 0.40903],
          [-0.06547, 0.41172],
          [-0.05954, 0.41441],
          [-0.05899, 0.41462],
          [-0.05073, 0.41731],
          [-0.01945, 0.42],
        ],
        depth: 0.0116,
      },
    },
    dimensions: {
      width: 0.2136,
      height: 0.2871,
      depth: 0.0116,
      units: "meters",
      confidence: 0.62,
    },
    material: "faceSkin",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(59, 71, 71, 1.0)",
      secondaryAlbedo: "rgba(173, 203, 4, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.85,
      evidenceRefs: ["full-object"],
      colorGradient: {
        type: "linear",
        stops: [
          { position: 0.0, color: "rgba(59, 71, 71, 1.0)" },
          { position: 0.55, color: "rgba(173, 203, 4, 1.0)" },
          { position: 1.0, color: "rgba(235, 216, 190, 1.0)" },
        ],
      },
    },
    actionProfile: {
      animationRole: "impact-surface",
      pivot: {
        mode: "center",
        localPosition: [0.0, 0.29, 0.0],
        axis: [0, 1, 0],
        confidence: 0.9,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [
        {
          id: "face-front",
          localPosition: [0.0, 0.29, 0.0058],
          axis: [0, 0, 1],
          notes: "Front striking skin; carries the de-lit reference decal.",
        },
        {
          id: "face-back",
          localPosition: [0.0, 0.29, -0.0058],
          axis: [0, 0, -1],
          notes:
            "Rear skin; mirrored from the front (hidden in the reference).",
        },
      ],
      collider: {
        type: "box",
        offset: [0, 0.29, 0],
        scale: [0.214, 0.262, 0.016],
        isTrigger: false,
        notes: "Flat hit box over the striking face.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "head-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "root",
      parentSocket: "grip-hand",
      localStart: [0.0, 0.1329, 0.0],
      localEnd: [0.0, 0.42, 0.0],
      contactType: "fused",
      overlap: 0.0135,
      gapTolerance: 0.0002,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Throat runs down into the collar; overlap is the collar embed depth.",
    },
  }
  node_facePlate_1.userData.actionProfile = {
    animationRole: "impact-surface",
    pivot: {
      mode: "center",
      localPosition: [0.0, 0.29, 0.0],
      axis: [0, 1, 0],
      confidence: 0.9,
    },
    transformChannels: {
      translate: true,
      rotate: true,
      scale: false,
      bend: false,
      twist: false,
      detach: true,
      visibility: true,
      materialState: true,
    },
    sockets: [
      {
        id: "face-front",
        localPosition: [0.0, 0.29, 0.0058],
        axis: [0, 0, 1],
        notes: "Front striking skin; carries the de-lit reference decal.",
      },
      {
        id: "face-back",
        localPosition: [0.0, 0.29, -0.0058],
        axis: [0, 0, -1],
        notes: "Rear skin; mirrored from the front (hidden in the reference).",
      },
    ],
    collider: {
      type: "box",
      offset: [0, 0.29, 0],
      scale: [0.214, 0.262, 0.016],
      isTrigger: false,
      notes: "Flat hit box over the striking face.",
    },
    constraints: [],
    destruction: {
      breakable: false,
      fractureGroup: "head-assembly",
      seamRefs: [],
      detachableFragments: [],
      breakImpulse: 0.0,
      debrisMaterial: "base",
    },
  }
  ;(nodes["root"] ?? root).add(node_facePlate_1)
  nodes["facePlate"] = node_facePlate_1
  const mesh_facePlate_1Geometry = endpoint_facePlate_1
    ? new THREE.CylinderGeometry(
        endpoint_facePlate_1.endRadius,
        endpoint_facePlate_1.baseRadius,
        endpoint_facePlate_1.length,
        16,
        6
      )
    : buildExtrudeGeometry({
        points: [
          [0.01945, 0.42],
          [0.05073, 0.41731],
          [0.05899, 0.41462],
          [0.05954, 0.41441],
          [0.06547, 0.41172],
          [0.07025, 0.40903],
          [0.07059, 0.40882],
          [0.07439, 0.40634],
          [0.07834, 0.40344],
          [0.0786, 0.40323],
          [0.08152, 0.40075],
          [0.08435, 0.39806],
          [0.08477, 0.39764],
          [0.0872, 0.39516],
          [0.08988, 0.39206],
          [0.09408, 0.38626],
          [0.09744, 0.38067],
          [0.10011, 0.37508],
          [0.10227, 0.36949],
          [0.10398, 0.3639],
          [0.1052, 0.35811],
          [0.1064, 0.35252],
          [0.10665, 0.34693],
          [0.10681, 0.34134],
          [0.10681, 0.33575],
          [0.10671, 0.32996],
          [0.10666, 0.32437],
          [0.10652, 0.31878],
          [0.1064, 0.31319],
          [0.1064, 0.3076],
          [0.1064, 0.3018],
          [0.10629, 0.29621],
          [0.10626, 0.29063],
          [0.10624, 0.28504],
          [0.10619, 0.27945],
          [0.10619, 0.27365],
          [0.10621, 0.26806],
          [0.10629, 0.26247],
          [0.10636, 0.25689],
          [0.1064, 0.2513],
          [0.10651, 0.2455],
          [0.10671, 0.23991],
          [0.10658, 0.23432],
          [0.10622, 0.22873],
          [0.1056, 0.22314],
          [0.10458, 0.21735],
          [0.10322, 0.21176],
          [0.10135, 0.20617],
          [0.09904, 0.20058],
          [0.09613, 0.19499],
          [0.09234, 0.1892],
          [0.08794, 0.18361],
          [0.08235, 0.17802],
          [0.07508, 0.17243],
          [0.06654, 0.16684],
          [0.06404, 0.16539],
          [0.05972, 0.16291],
          [0.05659, 0.16104],
          [0.05557, 0.16042],
          [0.05174, 0.15794],
          [0.04817, 0.15546],
          [0.04487, 0.15297],
          [0.04202, 0.15049],
          [0.0414, 0.14987],
          [0.03954, 0.148],
          [0.03721, 0.14552],
          [0.0362, 0.14428],
          [0.03519, 0.14304],
          [0.03336, 0.14055],
          [0.03208, 0.13869],
          [0.03169, 0.13807],
          [0.03018, 0.13558],
          [0.02944, 0.13289],
          [-0.02944, 0.13289],
          [-0.03018, 0.13558],
          [-0.03169, 0.13807],
          [-0.03208, 0.13869],
          [-0.03336, 0.14055],
          [-0.03519, 0.14304],
          [-0.0362, 0.14428],
          [-0.03721, 0.14552],
          [-0.03954, 0.148],
          [-0.0414, 0.14987],
          [-0.04202, 0.15049],
          [-0.04487, 0.15297],
          [-0.04817, 0.15546],
          [-0.05174, 0.15794],
          [-0.05557, 0.16042],
          [-0.05659, 0.16104],
          [-0.05972, 0.16291],
          [-0.06404, 0.16539],
          [-0.06654, 0.16684],
          [-0.07508, 0.17243],
          [-0.08235, 0.17802],
          [-0.08794, 0.18361],
          [-0.09234, 0.1892],
          [-0.09613, 0.19499],
          [-0.09904, 0.20058],
          [-0.10135, 0.20617],
          [-0.10322, 0.21176],
          [-0.10458, 0.21735],
          [-0.1056, 0.22314],
          [-0.10622, 0.22873],
          [-0.10658, 0.23432],
          [-0.10671, 0.23991],
          [-0.10651, 0.2455],
          [-0.1064, 0.2513],
          [-0.10636, 0.25689],
          [-0.10629, 0.26247],
          [-0.10621, 0.26806],
          [-0.10619, 0.27365],
          [-0.10619, 0.27945],
          [-0.10624, 0.28504],
          [-0.10626, 0.29063],
          [-0.10629, 0.29621],
          [-0.1064, 0.3018],
          [-0.1064, 0.3076],
          [-0.1064, 0.31319],
          [-0.10652, 0.31878],
          [-0.10666, 0.32437],
          [-0.10671, 0.32996],
          [-0.10681, 0.33575],
          [-0.10681, 0.34134],
          [-0.10665, 0.34693],
          [-0.1064, 0.35252],
          [-0.1052, 0.35811],
          [-0.10398, 0.3639],
          [-0.10227, 0.36949],
          [-0.10011, 0.37508],
          [-0.09744, 0.38067],
          [-0.09408, 0.38626],
          [-0.08988, 0.39206],
          [-0.0872, 0.39516],
          [-0.08477, 0.39764],
          [-0.08435, 0.39806],
          [-0.08152, 0.40075],
          [-0.0786, 0.40323],
          [-0.07834, 0.40344],
          [-0.07439, 0.40634],
          [-0.07059, 0.40882],
          [-0.07025, 0.40903],
          [-0.06547, 0.41172],
          [-0.05954, 0.41441],
          [-0.05899, 0.41462],
          [-0.05073, 0.41731],
          [-0.01945, 0.42],
        ],
        depth: 0.0116,
      })
  remapExtrudeUvsToBounds(mesh_facePlate_1Geometry)
  if (!endpoint_facePlate_1) {
    mesh_facePlate_1Geometry.scale(1.0, 1.0, 1.0)
  }
  const mesh_facePlate_1 = new THREE.Mesh(
    mesh_facePlate_1Geometry,
    materialMap["faceSkin"] ??
      new THREE.MeshStandardMaterial({ color: 0x888888 })
  )
  mesh_facePlate_1.name = "Face plate"
  if (endpoint_facePlate_1) {
    mesh_facePlate_1.position.copy(endpoint_facePlate_1.midpoint)
    mesh_facePlate_1.quaternion.copy(endpoint_facePlate_1.quaternion)
  }
  mesh_facePlate_1.castShadow = options.castShadow ?? true
  mesh_facePlate_1.receiveShadow = options.receiveShadow ?? true
  mesh_facePlate_1.userData.sculptComponent = {
    level: "macro",
    role: "body",
    importance: 1.0,
    confidence: 0.9,
    materialLayers: ["faceSkin"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["facePlate.cornerRadiusRatio", "throat.tangentFillet"],
    evidenceRefs: ["full-object"],
    transform: {
      position: [0, 0, -0.0058],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    surfaceDetail: {
      macroRoughness: 0.18,
      microRoughness: 0.09,
      bumpAmplitude: 0.0004,
      normalPattern: "reference-derived tangent normal from the de-lit crop",
      displacementPattern: "none",
      occlusionPattern: "decal-edge cavity",
    },
    id: "facePlate",
    name: "Face plate",
    primitive: "extrude",
    parent: "root",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A constant-thickness composite panel with a flat front and back skin; its form is fully described by one measured 2D outline plus a depth, not by a sculpted volume.",
    geometryDescriptor: {
      topologyIntent: "closed slab lofted from the measured 2D silhouette",
      edgeTreatment: { type: "none", bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy:
        "planar-XY normalized to the profile bounding box; the generated extrude UVs are in local metres and MUST be remapped to 0..1 over the profile bbox before the de-lit face albedo is applied (see assumptions: uv-remap-hand-refinement)",
      normalStrategy: "vertex normals from generated geometry",
      profile2D: {
        points: [
          [0.01945, 0.42],
          [0.05073, 0.41731],
          [0.05899, 0.41462],
          [0.05954, 0.41441],
          [0.06547, 0.41172],
          [0.07025, 0.40903],
          [0.07059, 0.40882],
          [0.07439, 0.40634],
          [0.07834, 0.40344],
          [0.0786, 0.40323],
          [0.08152, 0.40075],
          [0.08435, 0.39806],
          [0.08477, 0.39764],
          [0.0872, 0.39516],
          [0.08988, 0.39206],
          [0.09408, 0.38626],
          [0.09744, 0.38067],
          [0.10011, 0.37508],
          [0.10227, 0.36949],
          [0.10398, 0.3639],
          [0.1052, 0.35811],
          [0.1064, 0.35252],
          [0.10665, 0.34693],
          [0.10681, 0.34134],
          [0.10681, 0.33575],
          [0.10671, 0.32996],
          [0.10666, 0.32437],
          [0.10652, 0.31878],
          [0.1064, 0.31319],
          [0.1064, 0.3076],
          [0.1064, 0.3018],
          [0.10629, 0.29621],
          [0.10626, 0.29063],
          [0.10624, 0.28504],
          [0.10619, 0.27945],
          [0.10619, 0.27365],
          [0.10621, 0.26806],
          [0.10629, 0.26247],
          [0.10636, 0.25689],
          [0.1064, 0.2513],
          [0.10651, 0.2455],
          [0.10671, 0.23991],
          [0.10658, 0.23432],
          [0.10622, 0.22873],
          [0.1056, 0.22314],
          [0.10458, 0.21735],
          [0.10322, 0.21176],
          [0.10135, 0.20617],
          [0.09904, 0.20058],
          [0.09613, 0.19499],
          [0.09234, 0.1892],
          [0.08794, 0.18361],
          [0.08235, 0.17802],
          [0.07508, 0.17243],
          [0.06654, 0.16684],
          [0.06404, 0.16539],
          [0.05972, 0.16291],
          [0.05659, 0.16104],
          [0.05557, 0.16042],
          [0.05174, 0.15794],
          [0.04817, 0.15546],
          [0.04487, 0.15297],
          [0.04202, 0.15049],
          [0.0414, 0.14987],
          [0.03954, 0.148],
          [0.03721, 0.14552],
          [0.0362, 0.14428],
          [0.03519, 0.14304],
          [0.03336, 0.14055],
          [0.03208, 0.13869],
          [0.03169, 0.13807],
          [0.03018, 0.13558],
          [0.02944, 0.13289],
          [-0.02944, 0.13289],
          [-0.03018, 0.13558],
          [-0.03169, 0.13807],
          [-0.03208, 0.13869],
          [-0.03336, 0.14055],
          [-0.03519, 0.14304],
          [-0.0362, 0.14428],
          [-0.03721, 0.14552],
          [-0.03954, 0.148],
          [-0.0414, 0.14987],
          [-0.04202, 0.15049],
          [-0.04487, 0.15297],
          [-0.04817, 0.15546],
          [-0.05174, 0.15794],
          [-0.05557, 0.16042],
          [-0.05659, 0.16104],
          [-0.05972, 0.16291],
          [-0.06404, 0.16539],
          [-0.06654, 0.16684],
          [-0.07508, 0.17243],
          [-0.08235, 0.17802],
          [-0.08794, 0.18361],
          [-0.09234, 0.1892],
          [-0.09613, 0.19499],
          [-0.09904, 0.20058],
          [-0.10135, 0.20617],
          [-0.10322, 0.21176],
          [-0.10458, 0.21735],
          [-0.1056, 0.22314],
          [-0.10622, 0.22873],
          [-0.10658, 0.23432],
          [-0.10671, 0.23991],
          [-0.10651, 0.2455],
          [-0.1064, 0.2513],
          [-0.10636, 0.25689],
          [-0.10629, 0.26247],
          [-0.10621, 0.26806],
          [-0.10619, 0.27365],
          [-0.10619, 0.27945],
          [-0.10624, 0.28504],
          [-0.10626, 0.29063],
          [-0.10629, 0.29621],
          [-0.1064, 0.3018],
          [-0.1064, 0.3076],
          [-0.1064, 0.31319],
          [-0.10652, 0.31878],
          [-0.10666, 0.32437],
          [-0.10671, 0.32996],
          [-0.10681, 0.33575],
          [-0.10681, 0.34134],
          [-0.10665, 0.34693],
          [-0.1064, 0.35252],
          [-0.1052, 0.35811],
          [-0.10398, 0.3639],
          [-0.10227, 0.36949],
          [-0.10011, 0.37508],
          [-0.09744, 0.38067],
          [-0.09408, 0.38626],
          [-0.08988, 0.39206],
          [-0.0872, 0.39516],
          [-0.08477, 0.39764],
          [-0.08435, 0.39806],
          [-0.08152, 0.40075],
          [-0.0786, 0.40323],
          [-0.07834, 0.40344],
          [-0.07439, 0.40634],
          [-0.07059, 0.40882],
          [-0.07025, 0.40903],
          [-0.06547, 0.41172],
          [-0.05954, 0.41441],
          [-0.05899, 0.41462],
          [-0.05073, 0.41731],
          [-0.01945, 0.42],
        ],
        depth: 0.0116,
      },
    },
    dimensions: {
      width: 0.2136,
      height: 0.2871,
      depth: 0.0116,
      units: "meters",
      confidence: 0.62,
    },
    material: "faceSkin",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(59, 71, 71, 1.0)",
      secondaryAlbedo: "rgba(173, 203, 4, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.85,
      evidenceRefs: ["full-object"],
      colorGradient: {
        type: "linear",
        stops: [
          { position: 0.0, color: "rgba(59, 71, 71, 1.0)" },
          { position: 0.55, color: "rgba(173, 203, 4, 1.0)" },
          { position: 1.0, color: "rgba(235, 216, 190, 1.0)" },
        ],
      },
    },
    actionProfile: {
      animationRole: "impact-surface",
      pivot: {
        mode: "center",
        localPosition: [0.0, 0.29, 0.0],
        axis: [0, 1, 0],
        confidence: 0.9,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [
        {
          id: "face-front",
          localPosition: [0.0, 0.29, 0.0058],
          axis: [0, 0, 1],
          notes: "Front striking skin; carries the de-lit reference decal.",
        },
        {
          id: "face-back",
          localPosition: [0.0, 0.29, -0.0058],
          axis: [0, 0, -1],
          notes:
            "Rear skin; mirrored from the front (hidden in the reference).",
        },
      ],
      collider: {
        type: "box",
        offset: [0, 0.29, 0],
        scale: [0.214, 0.262, 0.016],
        isTrigger: false,
        notes: "Flat hit box over the striking face.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "head-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "root",
      parentSocket: "grip-hand",
      localStart: [0.0, 0.1329, 0.0],
      localEnd: [0.0, 0.42, 0.0],
      contactType: "fused",
      overlap: 0.0135,
      gapTolerance: 0.0002,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Throat runs down into the collar; overlap is the collar embed depth.",
    },
  }
  node_facePlate_1.add(mesh_facePlate_1)
  meshes["facePlate"] = mesh_facePlate_1
  colliders["facePlate"] = {
    type: "box",
    offset: [0, 0.29, 0],
    scale: [0.214, 0.262, 0.016],
    isTrigger: false,
    notes: "Flat hit box over the striking face.",
  }
  destructionGroups["head-assembly"] ??= []
  destructionGroups["head-assembly"].push(node_facePlate_1)
  const socket_facePlate_face_front_0 = new THREE.Object3D()
  socket_facePlate_face_front_0.name = "face-front"
  socket_facePlate_face_front_0.position.set(0.0, 0.29, 0.0058)
  socket_facePlate_face_front_0.rotation.set(0, 0, 0)
  socket_facePlate_face_front_0.userData.socket = {
    id: "face-front",
    localPosition: [0.0, 0.29, 0.0058],
    axis: [0, 0, 1],
    notes: "Front striking skin; carries the de-lit reference decal.",
  }
  node_facePlate_1.add(socket_facePlate_face_front_0)
  sockets["facePlate:face-front"] = socket_facePlate_face_front_0
  const socket_facePlate_face_back_1 = new THREE.Object3D()
  socket_facePlate_face_back_1.name = "face-back"
  socket_facePlate_face_back_1.position.set(0.0, 0.29, -0.0058)
  socket_facePlate_face_back_1.rotation.set(0, 0, 0)
  socket_facePlate_face_back_1.userData.socket = {
    id: "face-back",
    localPosition: [0.0, 0.29, -0.0058],
    axis: [0, 0, -1],
    notes: "Rear skin; mirrored from the front (hidden in the reference).",
  }
  node_facePlate_1.add(socket_facePlate_face_back_1)
  sockets["facePlate:face-back"] = socket_facePlate_face_back_1

  const attachment_edgeGuard_2 = {
    parentId: "facePlate",
    parentSocket: "face-front",
    localStart: [0.0, 0.1329, 0.0],
    localEnd: [0.0, 0.42, 0.0],
    contactType: "overlap",
    overlap: 0.0034,
    gapTolerance: 0.0002,
    contactNormal: [1, 0, 0],
    evidenceRefs: ["full-object"],
    notes:
      "Ring overlaps the face plate's outer 3.4 mm on both skins and stands 2.2 mm proud of each.",
  }
  // /* patched by tools/patch_paddle_factory.py */ authored geometryDescriptor form, not an attachment cylinder.
  void makeAttachmentEndpoint(attachment_edgeGuard_2)
  const endpoint_edgeGuard_2 = authoredGeometryEndpoint()
  const node_edgeGuard_2 = new THREE.Group()
  node_edgeGuard_2.name = "Perimeter edge guard__pivot"
  node_edgeGuard_2.scale.set(1, 1, 1)
  if (endpoint_edgeGuard_2) {
    node_edgeGuard_2.position.copy(endpoint_edgeGuard_2.start)
    node_edgeGuard_2.rotation.set(0.0, 0.0, 0.0)
  } else {
    node_edgeGuard_2.position.set(0.0, 0.0, -0.0022000000000000006)
    node_edgeGuard_2.rotation.set(0.0, 0.0, 0.0)
  }
  node_edgeGuard_2.userData.sculptComponent = {
    level: "macro",
    role: "trim",
    importance: 0.85,
    confidence: 0.8,
    materialLayers: ["edgeGuard"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["edgeGuard.beadProfile"],
    evidenceRefs: ["full-object"],
    transform: {
      position: [0.0, 0.0, -0.0022000000000000006],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    surfaceDetail: {
      macroRoughness: 0.26,
      microRoughness: 0.14,
      bumpAmplitude: 0.0003,
      normalPattern: "fine irregular seam stipple along the outer line",
      displacementPattern: "none",
      occlusionPattern: "rim-to-skin cavity",
    },
    id: "edgeGuard",
    name: "Perimeter edge guard",
    primitive: "extrude",
    parent: "facePlate",
    topologyClass: "conforming-shell",
    topologyRationale:
      "A flat band of constant width and thickness wrapping the face plate's rim. It conforms to the plate's outline rather than having a form of its own, and it is built as a ring in the same plane — not as a cross-section swept along a spine, which folded through itself.",
    geometryDescriptor: {
      topologyIntent:
        "extruded ring: the measured outline, with an angle-bisector offset of the same outline as the hole, so the band keeps constant width through every corner",
      edgeTreatment: { type: "none", bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy:
        "planar-XY; the guard carries no map, so UVs are not remapped",
      normalStrategy: "vertex normals from generated geometry",
      profile2D: {
        points: [
          [0.01945, 0.42],
          [0.05073, 0.41731],
          [0.05899, 0.41462],
          [0.05954, 0.41441],
          [0.06547, 0.41172],
          [0.07025, 0.40903],
          [0.07059, 0.40882],
          [0.07439, 0.40634],
          [0.07834, 0.40344],
          [0.0786, 0.40323],
          [0.08152, 0.40075],
          [0.08435, 0.39806],
          [0.08477, 0.39764],
          [0.0872, 0.39516],
          [0.08988, 0.39206],
          [0.09408, 0.38626],
          [0.09744, 0.38067],
          [0.10011, 0.37508],
          [0.10227, 0.36949],
          [0.10398, 0.3639],
          [0.1052, 0.35811],
          [0.1064, 0.35252],
          [0.10665, 0.34693],
          [0.10681, 0.34134],
          [0.10681, 0.33575],
          [0.10671, 0.32996],
          [0.10666, 0.32437],
          [0.10652, 0.31878],
          [0.1064, 0.31319],
          [0.1064, 0.3076],
          [0.1064, 0.3018],
          [0.10629, 0.29621],
          [0.10626, 0.29063],
          [0.10624, 0.28504],
          [0.10619, 0.27945],
          [0.10619, 0.27365],
          [0.10621, 0.26806],
          [0.10629, 0.26247],
          [0.10636, 0.25689],
          [0.1064, 0.2513],
          [0.10651, 0.2455],
          [0.10671, 0.23991],
          [0.10658, 0.23432],
          [0.10622, 0.22873],
          [0.1056, 0.22314],
          [0.10458, 0.21735],
          [0.10322, 0.21176],
          [0.10135, 0.20617],
          [0.09904, 0.20058],
          [0.09613, 0.19499],
          [0.09234, 0.1892],
          [0.08794, 0.18361],
          [0.08235, 0.17802],
          [0.07508, 0.17243],
          [0.06654, 0.16684],
          [0.06404, 0.16539],
          [0.05972, 0.16291],
          [0.05659, 0.16104],
          [0.05557, 0.16042],
          [0.05174, 0.15794],
          [0.04817, 0.15546],
          [0.04487, 0.15297],
          [0.04202, 0.15049],
          [0.0414, 0.14987],
          [0.03954, 0.148],
          [0.03721, 0.14552],
          [0.0362, 0.14428],
          [0.03519, 0.14304],
          [0.03336, 0.14055],
          [0.03208, 0.13869],
          [0.03169, 0.13807],
          [0.03018, 0.13558],
          [0.02944, 0.13289],
          [-0.02944, 0.13289],
          [-0.03018, 0.13558],
          [-0.03169, 0.13807],
          [-0.03208, 0.13869],
          [-0.03336, 0.14055],
          [-0.03519, 0.14304],
          [-0.0362, 0.14428],
          [-0.03721, 0.14552],
          [-0.03954, 0.148],
          [-0.0414, 0.14987],
          [-0.04202, 0.15049],
          [-0.04487, 0.15297],
          [-0.04817, 0.15546],
          [-0.05174, 0.15794],
          [-0.05557, 0.16042],
          [-0.05659, 0.16104],
          [-0.05972, 0.16291],
          [-0.06404, 0.16539],
          [-0.06654, 0.16684],
          [-0.07508, 0.17243],
          [-0.08235, 0.17802],
          [-0.08794, 0.18361],
          [-0.09234, 0.1892],
          [-0.09613, 0.19499],
          [-0.09904, 0.20058],
          [-0.10135, 0.20617],
          [-0.10322, 0.21176],
          [-0.10458, 0.21735],
          [-0.1056, 0.22314],
          [-0.10622, 0.22873],
          [-0.10658, 0.23432],
          [-0.10671, 0.23991],
          [-0.10651, 0.2455],
          [-0.1064, 0.2513],
          [-0.10636, 0.25689],
          [-0.10629, 0.26247],
          [-0.10621, 0.26806],
          [-0.10619, 0.27365],
          [-0.10619, 0.27945],
          [-0.10624, 0.28504],
          [-0.10626, 0.29063],
          [-0.10629, 0.29621],
          [-0.1064, 0.3018],
          [-0.1064, 0.3076],
          [-0.1064, 0.31319],
          [-0.10652, 0.31878],
          [-0.10666, 0.32437],
          [-0.10671, 0.32996],
          [-0.10681, 0.33575],
          [-0.10681, 0.34134],
          [-0.10665, 0.34693],
          [-0.1064, 0.35252],
          [-0.1052, 0.35811],
          [-0.10398, 0.3639],
          [-0.10227, 0.36949],
          [-0.10011, 0.37508],
          [-0.09744, 0.38067],
          [-0.09408, 0.38626],
          [-0.08988, 0.39206],
          [-0.0872, 0.39516],
          [-0.08477, 0.39764],
          [-0.08435, 0.39806],
          [-0.08152, 0.40075],
          [-0.0786, 0.40323],
          [-0.07834, 0.40344],
          [-0.07439, 0.40634],
          [-0.07059, 0.40882],
          [-0.07025, 0.40903],
          [-0.06547, 0.41172],
          [-0.05954, 0.41441],
          [-0.05899, 0.41462],
          [-0.05073, 0.41731],
          [-0.01945, 0.42],
        ],
        holes: [
          [
            [-0.0193, 0.4166],
            [-0.05005, 0.41396],
            [-0.05786, 0.41141],
            [-0.05823, 0.41127],
            [-0.06393, 0.40868],
            [-0.06852, 0.4061],
            [-0.06877, 0.40595],
            [-0.07245, 0.40354],
            [-0.07626, 0.40075],
            [-0.07643, 0.40061],
            [-0.07925, 0.39822],
            [-0.08198, 0.39563],
            [-0.08235, 0.39525],
            [-0.0847, 0.39286],
            [-0.08721, 0.38995],
            [-0.09124, 0.38438],
            [-0.09444, 0.37906],
            [-0.09699, 0.37373],
            [-0.09905, 0.36838],
            [-0.10068, 0.36305],
            [-0.10187, 0.3574],
            [-0.10302, 0.35208],
            [-0.10325, 0.34681],
            [-0.10341, 0.34129],
            [-0.10341, 0.33578],
            [-0.10331, 0.33],
            [-0.10326, 0.32443],
            [-0.10312, 0.31886],
            [-0.103, 0.31323],
            [-0.103, 0.3076],
            [-0.103, 0.30183],
            [-0.10289, 0.29625],
            [-0.10286, 0.29065],
            [-0.10284, 0.28506],
            [-0.10279, 0.27947],
            [-0.10279, 0.27364],
            [-0.10281, 0.26803],
            [-0.10289, 0.26242],
            [-0.10296, 0.25686],
            [-0.103, 0.25126],
            [-0.10311, 0.24541],
            [-0.10331, 0.23989],
            [-0.10318, 0.23447],
            [-0.10283, 0.22903],
            [-0.10223, 0.22362],
            [-0.10125, 0.21805],
            [-0.09995, 0.2127],
            [-0.09816, 0.20736],
            [-0.09595, 0.20202],
            [-0.09319, 0.19671],
            [-0.08958, 0.19119],
            [-0.08539, 0.18587],
            [-0.0801, 0.18058],
            [-0.07311, 0.1752],
            [-0.06475, 0.16974],
            [-0.06234, 0.16833],
            [-0.058, 0.16584],
            [-0.05484, 0.16395],
            [-0.05376, 0.1633],
            [-0.04985, 0.16076],
            [-0.04618, 0.15821],
            [-0.04273, 0.15561],
            [-0.0397, 0.15298],
            [-0.03899, 0.15227],
            [-0.0371, 0.15036],
            [-0.03465, 0.14776],
            [-0.03356, 0.14643],
            [-0.0325, 0.14512],
            [-0.03059, 0.14252],
            [-0.02924, 0.14056],
            [-0.0288, 0.13986],
            [-0.02703, 0.13694],
            [-0.02685, 0.13629],
            [0.02685, 0.13629],
            [0.02703, 0.13694],
            [0.0288, 0.13986],
            [0.02924, 0.14056],
            [0.03059, 0.14252],
            [0.0325, 0.14512],
            [0.03356, 0.14643],
            [0.03465, 0.14776],
            [0.0371, 0.15036],
            [0.03899, 0.15227],
            [0.0397, 0.15298],
            [0.04273, 0.15561],
            [0.04618, 0.15821],
            [0.04985, 0.16076],
            [0.05376, 0.1633],
            [0.05484, 0.16395],
            [0.058, 0.16584],
            [0.06234, 0.16833],
            [0.06475, 0.16974],
            [0.07311, 0.1752],
            [0.0801, 0.18058],
            [0.08539, 0.18587],
            [0.08958, 0.19119],
            [0.09319, 0.19671],
            [0.09595, 0.20202],
            [0.09816, 0.20736],
            [0.09995, 0.2127],
            [0.10125, 0.21805],
            [0.10223, 0.22362],
            [0.10283, 0.22903],
            [0.10318, 0.23447],
            [0.10331, 0.23989],
            [0.10311, 0.24541],
            [0.103, 0.25126],
            [0.10296, 0.25686],
            [0.10289, 0.26242],
            [0.10281, 0.26803],
            [0.10279, 0.27364],
            [0.10279, 0.27947],
            [0.10284, 0.28506],
            [0.10286, 0.29065],
            [0.10289, 0.29625],
            [0.103, 0.30183],
            [0.103, 0.3076],
            [0.103, 0.31323],
            [0.10312, 0.31886],
            [0.10326, 0.32443],
            [0.10331, 0.33],
            [0.10341, 0.33578],
            [0.10341, 0.34129],
            [0.10325, 0.34681],
            [0.10302, 0.35208],
            [0.10187, 0.3574],
            [0.10068, 0.36305],
            [0.09905, 0.36838],
            [0.09699, 0.37373],
            [0.09444, 0.37906],
            [0.09124, 0.38438],
            [0.08721, 0.38995],
            [0.0847, 0.39286],
            [0.08235, 0.39525],
            [0.08198, 0.39563],
            [0.07925, 0.39822],
            [0.07643, 0.40061],
            [0.07626, 0.40075],
            [0.07245, 0.40354],
            [0.06877, 0.40595],
            [0.06852, 0.4061],
            [0.06393, 0.40868],
            [0.05823, 0.41127],
            [0.05786, 0.41141],
            [0.05005, 0.41396],
            [0.0193, 0.4166],
          ],
        ],
        depth: 0.016,
      },
    },
    dimensions: {
      width: 0.2136,
      height: 0.2871,
      depth: 0.016,
      units: "meters",
      confidence: 0.55,
    },
    material: "edgeGuard",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(56, 67, 68, 1.0)",
      secondaryAlbedo: "rgba(65, 75, 77, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.8,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "trim",
      pivot: {
        mode: "center",
        localPosition: [0.0, 0.29, 0.0],
        axis: [0, 1, 0],
        confidence: 0.7,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "box",
        offset: [0, 0.29, 0],
        scale: [0.214, 0.287, 0.016],
        isTrigger: false,
        notes: "Shares the head hit box.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "head-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "facePlate",
      parentSocket: "face-front",
      localStart: [0.0, 0.1329, 0.0],
      localEnd: [0.0, 0.42, 0.0],
      contactType: "overlap",
      overlap: 0.0034,
      gapTolerance: 0.0002,
      contactNormal: [1, 0, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Ring overlaps the face plate's outer 3.4 mm on both skins and stands 2.2 mm proud of each.",
    },
  }
  node_edgeGuard_2.userData.actionProfile = {
    animationRole: "trim",
    pivot: {
      mode: "center",
      localPosition: [0.0, 0.29, 0.0],
      axis: [0, 1, 0],
      confidence: 0.7,
    },
    transformChannels: {
      translate: true,
      rotate: true,
      scale: false,
      bend: false,
      twist: false,
      detach: true,
      visibility: true,
      materialState: true,
    },
    sockets: [],
    collider: {
      type: "box",
      offset: [0, 0.29, 0],
      scale: [0.214, 0.287, 0.016],
      isTrigger: false,
      notes: "Shares the head hit box.",
    },
    constraints: [],
    destruction: {
      breakable: false,
      fractureGroup: "head-assembly",
      seamRefs: [],
      detachableFragments: [],
      breakImpulse: 0.0,
      debrisMaterial: "base",
    },
  }
  ;(nodes["facePlate"] ?? root).add(node_edgeGuard_2)
  nodes["edgeGuard"] = node_edgeGuard_2
  const mesh_edgeGuard_2Geometry = endpoint_edgeGuard_2
    ? new THREE.CylinderGeometry(
        endpoint_edgeGuard_2.endRadius,
        endpoint_edgeGuard_2.baseRadius,
        endpoint_edgeGuard_2.length,
        16,
        6
      )
    : buildExtrudeGeometry({
        points: [
          [0.01945, 0.42],
          [0.05073, 0.41731],
          [0.05899, 0.41462],
          [0.05954, 0.41441],
          [0.06547, 0.41172],
          [0.07025, 0.40903],
          [0.07059, 0.40882],
          [0.07439, 0.40634],
          [0.07834, 0.40344],
          [0.0786, 0.40323],
          [0.08152, 0.40075],
          [0.08435, 0.39806],
          [0.08477, 0.39764],
          [0.0872, 0.39516],
          [0.08988, 0.39206],
          [0.09408, 0.38626],
          [0.09744, 0.38067],
          [0.10011, 0.37508],
          [0.10227, 0.36949],
          [0.10398, 0.3639],
          [0.1052, 0.35811],
          [0.1064, 0.35252],
          [0.10665, 0.34693],
          [0.10681, 0.34134],
          [0.10681, 0.33575],
          [0.10671, 0.32996],
          [0.10666, 0.32437],
          [0.10652, 0.31878],
          [0.1064, 0.31319],
          [0.1064, 0.3076],
          [0.1064, 0.3018],
          [0.10629, 0.29621],
          [0.10626, 0.29063],
          [0.10624, 0.28504],
          [0.10619, 0.27945],
          [0.10619, 0.27365],
          [0.10621, 0.26806],
          [0.10629, 0.26247],
          [0.10636, 0.25689],
          [0.1064, 0.2513],
          [0.10651, 0.2455],
          [0.10671, 0.23991],
          [0.10658, 0.23432],
          [0.10622, 0.22873],
          [0.1056, 0.22314],
          [0.10458, 0.21735],
          [0.10322, 0.21176],
          [0.10135, 0.20617],
          [0.09904, 0.20058],
          [0.09613, 0.19499],
          [0.09234, 0.1892],
          [0.08794, 0.18361],
          [0.08235, 0.17802],
          [0.07508, 0.17243],
          [0.06654, 0.16684],
          [0.06404, 0.16539],
          [0.05972, 0.16291],
          [0.05659, 0.16104],
          [0.05557, 0.16042],
          [0.05174, 0.15794],
          [0.04817, 0.15546],
          [0.04487, 0.15297],
          [0.04202, 0.15049],
          [0.0414, 0.14987],
          [0.03954, 0.148],
          [0.03721, 0.14552],
          [0.0362, 0.14428],
          [0.03519, 0.14304],
          [0.03336, 0.14055],
          [0.03208, 0.13869],
          [0.03169, 0.13807],
          [0.03018, 0.13558],
          [0.02944, 0.13289],
          [-0.02944, 0.13289],
          [-0.03018, 0.13558],
          [-0.03169, 0.13807],
          [-0.03208, 0.13869],
          [-0.03336, 0.14055],
          [-0.03519, 0.14304],
          [-0.0362, 0.14428],
          [-0.03721, 0.14552],
          [-0.03954, 0.148],
          [-0.0414, 0.14987],
          [-0.04202, 0.15049],
          [-0.04487, 0.15297],
          [-0.04817, 0.15546],
          [-0.05174, 0.15794],
          [-0.05557, 0.16042],
          [-0.05659, 0.16104],
          [-0.05972, 0.16291],
          [-0.06404, 0.16539],
          [-0.06654, 0.16684],
          [-0.07508, 0.17243],
          [-0.08235, 0.17802],
          [-0.08794, 0.18361],
          [-0.09234, 0.1892],
          [-0.09613, 0.19499],
          [-0.09904, 0.20058],
          [-0.10135, 0.20617],
          [-0.10322, 0.21176],
          [-0.10458, 0.21735],
          [-0.1056, 0.22314],
          [-0.10622, 0.22873],
          [-0.10658, 0.23432],
          [-0.10671, 0.23991],
          [-0.10651, 0.2455],
          [-0.1064, 0.2513],
          [-0.10636, 0.25689],
          [-0.10629, 0.26247],
          [-0.10621, 0.26806],
          [-0.10619, 0.27365],
          [-0.10619, 0.27945],
          [-0.10624, 0.28504],
          [-0.10626, 0.29063],
          [-0.10629, 0.29621],
          [-0.1064, 0.3018],
          [-0.1064, 0.3076],
          [-0.1064, 0.31319],
          [-0.10652, 0.31878],
          [-0.10666, 0.32437],
          [-0.10671, 0.32996],
          [-0.10681, 0.33575],
          [-0.10681, 0.34134],
          [-0.10665, 0.34693],
          [-0.1064, 0.35252],
          [-0.1052, 0.35811],
          [-0.10398, 0.3639],
          [-0.10227, 0.36949],
          [-0.10011, 0.37508],
          [-0.09744, 0.38067],
          [-0.09408, 0.38626],
          [-0.08988, 0.39206],
          [-0.0872, 0.39516],
          [-0.08477, 0.39764],
          [-0.08435, 0.39806],
          [-0.08152, 0.40075],
          [-0.0786, 0.40323],
          [-0.07834, 0.40344],
          [-0.07439, 0.40634],
          [-0.07059, 0.40882],
          [-0.07025, 0.40903],
          [-0.06547, 0.41172],
          [-0.05954, 0.41441],
          [-0.05899, 0.41462],
          [-0.05073, 0.41731],
          [-0.01945, 0.42],
        ],
        holes: [
          [
            [-0.0193, 0.4166],
            [-0.05005, 0.41396],
            [-0.05786, 0.41141],
            [-0.05823, 0.41127],
            [-0.06393, 0.40868],
            [-0.06852, 0.4061],
            [-0.06877, 0.40595],
            [-0.07245, 0.40354],
            [-0.07626, 0.40075],
            [-0.07643, 0.40061],
            [-0.07925, 0.39822],
            [-0.08198, 0.39563],
            [-0.08235, 0.39525],
            [-0.0847, 0.39286],
            [-0.08721, 0.38995],
            [-0.09124, 0.38438],
            [-0.09444, 0.37906],
            [-0.09699, 0.37373],
            [-0.09905, 0.36838],
            [-0.10068, 0.36305],
            [-0.10187, 0.3574],
            [-0.10302, 0.35208],
            [-0.10325, 0.34681],
            [-0.10341, 0.34129],
            [-0.10341, 0.33578],
            [-0.10331, 0.33],
            [-0.10326, 0.32443],
            [-0.10312, 0.31886],
            [-0.103, 0.31323],
            [-0.103, 0.3076],
            [-0.103, 0.30183],
            [-0.10289, 0.29625],
            [-0.10286, 0.29065],
            [-0.10284, 0.28506],
            [-0.10279, 0.27947],
            [-0.10279, 0.27364],
            [-0.10281, 0.26803],
            [-0.10289, 0.26242],
            [-0.10296, 0.25686],
            [-0.103, 0.25126],
            [-0.10311, 0.24541],
            [-0.10331, 0.23989],
            [-0.10318, 0.23447],
            [-0.10283, 0.22903],
            [-0.10223, 0.22362],
            [-0.10125, 0.21805],
            [-0.09995, 0.2127],
            [-0.09816, 0.20736],
            [-0.09595, 0.20202],
            [-0.09319, 0.19671],
            [-0.08958, 0.19119],
            [-0.08539, 0.18587],
            [-0.0801, 0.18058],
            [-0.07311, 0.1752],
            [-0.06475, 0.16974],
            [-0.06234, 0.16833],
            [-0.058, 0.16584],
            [-0.05484, 0.16395],
            [-0.05376, 0.1633],
            [-0.04985, 0.16076],
            [-0.04618, 0.15821],
            [-0.04273, 0.15561],
            [-0.0397, 0.15298],
            [-0.03899, 0.15227],
            [-0.0371, 0.15036],
            [-0.03465, 0.14776],
            [-0.03356, 0.14643],
            [-0.0325, 0.14512],
            [-0.03059, 0.14252],
            [-0.02924, 0.14056],
            [-0.0288, 0.13986],
            [-0.02703, 0.13694],
            [-0.02685, 0.13629],
            [0.02685, 0.13629],
            [0.02703, 0.13694],
            [0.0288, 0.13986],
            [0.02924, 0.14056],
            [0.03059, 0.14252],
            [0.0325, 0.14512],
            [0.03356, 0.14643],
            [0.03465, 0.14776],
            [0.0371, 0.15036],
            [0.03899, 0.15227],
            [0.0397, 0.15298],
            [0.04273, 0.15561],
            [0.04618, 0.15821],
            [0.04985, 0.16076],
            [0.05376, 0.1633],
            [0.05484, 0.16395],
            [0.058, 0.16584],
            [0.06234, 0.16833],
            [0.06475, 0.16974],
            [0.07311, 0.1752],
            [0.0801, 0.18058],
            [0.08539, 0.18587],
            [0.08958, 0.19119],
            [0.09319, 0.19671],
            [0.09595, 0.20202],
            [0.09816, 0.20736],
            [0.09995, 0.2127],
            [0.10125, 0.21805],
            [0.10223, 0.22362],
            [0.10283, 0.22903],
            [0.10318, 0.23447],
            [0.10331, 0.23989],
            [0.10311, 0.24541],
            [0.103, 0.25126],
            [0.10296, 0.25686],
            [0.10289, 0.26242],
            [0.10281, 0.26803],
            [0.10279, 0.27364],
            [0.10279, 0.27947],
            [0.10284, 0.28506],
            [0.10286, 0.29065],
            [0.10289, 0.29625],
            [0.103, 0.30183],
            [0.103, 0.3076],
            [0.103, 0.31323],
            [0.10312, 0.31886],
            [0.10326, 0.32443],
            [0.10331, 0.33],
            [0.10341, 0.33578],
            [0.10341, 0.34129],
            [0.10325, 0.34681],
            [0.10302, 0.35208],
            [0.10187, 0.3574],
            [0.10068, 0.36305],
            [0.09905, 0.36838],
            [0.09699, 0.37373],
            [0.09444, 0.37906],
            [0.09124, 0.38438],
            [0.08721, 0.38995],
            [0.0847, 0.39286],
            [0.08235, 0.39525],
            [0.08198, 0.39563],
            [0.07925, 0.39822],
            [0.07643, 0.40061],
            [0.07626, 0.40075],
            [0.07245, 0.40354],
            [0.06877, 0.40595],
            [0.06852, 0.4061],
            [0.06393, 0.40868],
            [0.05823, 0.41127],
            [0.05786, 0.41141],
            [0.05005, 0.41396],
            [0.0193, 0.4166],
          ],
        ],
        depth: 0.016,
      })
  if (!endpoint_edgeGuard_2) {
    mesh_edgeGuard_2Geometry.scale(1.0, 1.0, 1.0)
  }
  const mesh_edgeGuard_2 = new THREE.Mesh(
    mesh_edgeGuard_2Geometry,
    materialMap["edgeGuard"] ??
      new THREE.MeshStandardMaterial({ color: 0x888888 })
  )
  mesh_edgeGuard_2.name = "Perimeter edge guard"
  if (endpoint_edgeGuard_2) {
    mesh_edgeGuard_2.position.copy(endpoint_edgeGuard_2.midpoint)
    mesh_edgeGuard_2.quaternion.copy(endpoint_edgeGuard_2.quaternion)
  }
  mesh_edgeGuard_2.castShadow = options.castShadow ?? true
  mesh_edgeGuard_2.receiveShadow = options.receiveShadow ?? true
  mesh_edgeGuard_2.userData.sculptComponent = {
    level: "macro",
    role: "trim",
    importance: 0.85,
    confidence: 0.8,
    materialLayers: ["edgeGuard"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["edgeGuard.beadProfile"],
    evidenceRefs: ["full-object"],
    transform: {
      position: [0.0, 0.0, -0.0022000000000000006],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    surfaceDetail: {
      macroRoughness: 0.26,
      microRoughness: 0.14,
      bumpAmplitude: 0.0003,
      normalPattern: "fine irregular seam stipple along the outer line",
      displacementPattern: "none",
      occlusionPattern: "rim-to-skin cavity",
    },
    id: "edgeGuard",
    name: "Perimeter edge guard",
    primitive: "extrude",
    parent: "facePlate",
    topologyClass: "conforming-shell",
    topologyRationale:
      "A flat band of constant width and thickness wrapping the face plate's rim. It conforms to the plate's outline rather than having a form of its own, and it is built as a ring in the same plane — not as a cross-section swept along a spine, which folded through itself.",
    geometryDescriptor: {
      topologyIntent:
        "extruded ring: the measured outline, with an angle-bisector offset of the same outline as the hole, so the band keeps constant width through every corner",
      edgeTreatment: { type: "none", bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy:
        "planar-XY; the guard carries no map, so UVs are not remapped",
      normalStrategy: "vertex normals from generated geometry",
      profile2D: {
        points: [
          [0.01945, 0.42],
          [0.05073, 0.41731],
          [0.05899, 0.41462],
          [0.05954, 0.41441],
          [0.06547, 0.41172],
          [0.07025, 0.40903],
          [0.07059, 0.40882],
          [0.07439, 0.40634],
          [0.07834, 0.40344],
          [0.0786, 0.40323],
          [0.08152, 0.40075],
          [0.08435, 0.39806],
          [0.08477, 0.39764],
          [0.0872, 0.39516],
          [0.08988, 0.39206],
          [0.09408, 0.38626],
          [0.09744, 0.38067],
          [0.10011, 0.37508],
          [0.10227, 0.36949],
          [0.10398, 0.3639],
          [0.1052, 0.35811],
          [0.1064, 0.35252],
          [0.10665, 0.34693],
          [0.10681, 0.34134],
          [0.10681, 0.33575],
          [0.10671, 0.32996],
          [0.10666, 0.32437],
          [0.10652, 0.31878],
          [0.1064, 0.31319],
          [0.1064, 0.3076],
          [0.1064, 0.3018],
          [0.10629, 0.29621],
          [0.10626, 0.29063],
          [0.10624, 0.28504],
          [0.10619, 0.27945],
          [0.10619, 0.27365],
          [0.10621, 0.26806],
          [0.10629, 0.26247],
          [0.10636, 0.25689],
          [0.1064, 0.2513],
          [0.10651, 0.2455],
          [0.10671, 0.23991],
          [0.10658, 0.23432],
          [0.10622, 0.22873],
          [0.1056, 0.22314],
          [0.10458, 0.21735],
          [0.10322, 0.21176],
          [0.10135, 0.20617],
          [0.09904, 0.20058],
          [0.09613, 0.19499],
          [0.09234, 0.1892],
          [0.08794, 0.18361],
          [0.08235, 0.17802],
          [0.07508, 0.17243],
          [0.06654, 0.16684],
          [0.06404, 0.16539],
          [0.05972, 0.16291],
          [0.05659, 0.16104],
          [0.05557, 0.16042],
          [0.05174, 0.15794],
          [0.04817, 0.15546],
          [0.04487, 0.15297],
          [0.04202, 0.15049],
          [0.0414, 0.14987],
          [0.03954, 0.148],
          [0.03721, 0.14552],
          [0.0362, 0.14428],
          [0.03519, 0.14304],
          [0.03336, 0.14055],
          [0.03208, 0.13869],
          [0.03169, 0.13807],
          [0.03018, 0.13558],
          [0.02944, 0.13289],
          [-0.02944, 0.13289],
          [-0.03018, 0.13558],
          [-0.03169, 0.13807],
          [-0.03208, 0.13869],
          [-0.03336, 0.14055],
          [-0.03519, 0.14304],
          [-0.0362, 0.14428],
          [-0.03721, 0.14552],
          [-0.03954, 0.148],
          [-0.0414, 0.14987],
          [-0.04202, 0.15049],
          [-0.04487, 0.15297],
          [-0.04817, 0.15546],
          [-0.05174, 0.15794],
          [-0.05557, 0.16042],
          [-0.05659, 0.16104],
          [-0.05972, 0.16291],
          [-0.06404, 0.16539],
          [-0.06654, 0.16684],
          [-0.07508, 0.17243],
          [-0.08235, 0.17802],
          [-0.08794, 0.18361],
          [-0.09234, 0.1892],
          [-0.09613, 0.19499],
          [-0.09904, 0.20058],
          [-0.10135, 0.20617],
          [-0.10322, 0.21176],
          [-0.10458, 0.21735],
          [-0.1056, 0.22314],
          [-0.10622, 0.22873],
          [-0.10658, 0.23432],
          [-0.10671, 0.23991],
          [-0.10651, 0.2455],
          [-0.1064, 0.2513],
          [-0.10636, 0.25689],
          [-0.10629, 0.26247],
          [-0.10621, 0.26806],
          [-0.10619, 0.27365],
          [-0.10619, 0.27945],
          [-0.10624, 0.28504],
          [-0.10626, 0.29063],
          [-0.10629, 0.29621],
          [-0.1064, 0.3018],
          [-0.1064, 0.3076],
          [-0.1064, 0.31319],
          [-0.10652, 0.31878],
          [-0.10666, 0.32437],
          [-0.10671, 0.32996],
          [-0.10681, 0.33575],
          [-0.10681, 0.34134],
          [-0.10665, 0.34693],
          [-0.1064, 0.35252],
          [-0.1052, 0.35811],
          [-0.10398, 0.3639],
          [-0.10227, 0.36949],
          [-0.10011, 0.37508],
          [-0.09744, 0.38067],
          [-0.09408, 0.38626],
          [-0.08988, 0.39206],
          [-0.0872, 0.39516],
          [-0.08477, 0.39764],
          [-0.08435, 0.39806],
          [-0.08152, 0.40075],
          [-0.0786, 0.40323],
          [-0.07834, 0.40344],
          [-0.07439, 0.40634],
          [-0.07059, 0.40882],
          [-0.07025, 0.40903],
          [-0.06547, 0.41172],
          [-0.05954, 0.41441],
          [-0.05899, 0.41462],
          [-0.05073, 0.41731],
          [-0.01945, 0.42],
        ],
        holes: [
          [
            [-0.0193, 0.4166],
            [-0.05005, 0.41396],
            [-0.05786, 0.41141],
            [-0.05823, 0.41127],
            [-0.06393, 0.40868],
            [-0.06852, 0.4061],
            [-0.06877, 0.40595],
            [-0.07245, 0.40354],
            [-0.07626, 0.40075],
            [-0.07643, 0.40061],
            [-0.07925, 0.39822],
            [-0.08198, 0.39563],
            [-0.08235, 0.39525],
            [-0.0847, 0.39286],
            [-0.08721, 0.38995],
            [-0.09124, 0.38438],
            [-0.09444, 0.37906],
            [-0.09699, 0.37373],
            [-0.09905, 0.36838],
            [-0.10068, 0.36305],
            [-0.10187, 0.3574],
            [-0.10302, 0.35208],
            [-0.10325, 0.34681],
            [-0.10341, 0.34129],
            [-0.10341, 0.33578],
            [-0.10331, 0.33],
            [-0.10326, 0.32443],
            [-0.10312, 0.31886],
            [-0.103, 0.31323],
            [-0.103, 0.3076],
            [-0.103, 0.30183],
            [-0.10289, 0.29625],
            [-0.10286, 0.29065],
            [-0.10284, 0.28506],
            [-0.10279, 0.27947],
            [-0.10279, 0.27364],
            [-0.10281, 0.26803],
            [-0.10289, 0.26242],
            [-0.10296, 0.25686],
            [-0.103, 0.25126],
            [-0.10311, 0.24541],
            [-0.10331, 0.23989],
            [-0.10318, 0.23447],
            [-0.10283, 0.22903],
            [-0.10223, 0.22362],
            [-0.10125, 0.21805],
            [-0.09995, 0.2127],
            [-0.09816, 0.20736],
            [-0.09595, 0.20202],
            [-0.09319, 0.19671],
            [-0.08958, 0.19119],
            [-0.08539, 0.18587],
            [-0.0801, 0.18058],
            [-0.07311, 0.1752],
            [-0.06475, 0.16974],
            [-0.06234, 0.16833],
            [-0.058, 0.16584],
            [-0.05484, 0.16395],
            [-0.05376, 0.1633],
            [-0.04985, 0.16076],
            [-0.04618, 0.15821],
            [-0.04273, 0.15561],
            [-0.0397, 0.15298],
            [-0.03899, 0.15227],
            [-0.0371, 0.15036],
            [-0.03465, 0.14776],
            [-0.03356, 0.14643],
            [-0.0325, 0.14512],
            [-0.03059, 0.14252],
            [-0.02924, 0.14056],
            [-0.0288, 0.13986],
            [-0.02703, 0.13694],
            [-0.02685, 0.13629],
            [0.02685, 0.13629],
            [0.02703, 0.13694],
            [0.0288, 0.13986],
            [0.02924, 0.14056],
            [0.03059, 0.14252],
            [0.0325, 0.14512],
            [0.03356, 0.14643],
            [0.03465, 0.14776],
            [0.0371, 0.15036],
            [0.03899, 0.15227],
            [0.0397, 0.15298],
            [0.04273, 0.15561],
            [0.04618, 0.15821],
            [0.04985, 0.16076],
            [0.05376, 0.1633],
            [0.05484, 0.16395],
            [0.058, 0.16584],
            [0.06234, 0.16833],
            [0.06475, 0.16974],
            [0.07311, 0.1752],
            [0.0801, 0.18058],
            [0.08539, 0.18587],
            [0.08958, 0.19119],
            [0.09319, 0.19671],
            [0.09595, 0.20202],
            [0.09816, 0.20736],
            [0.09995, 0.2127],
            [0.10125, 0.21805],
            [0.10223, 0.22362],
            [0.10283, 0.22903],
            [0.10318, 0.23447],
            [0.10331, 0.23989],
            [0.10311, 0.24541],
            [0.103, 0.25126],
            [0.10296, 0.25686],
            [0.10289, 0.26242],
            [0.10281, 0.26803],
            [0.10279, 0.27364],
            [0.10279, 0.27947],
            [0.10284, 0.28506],
            [0.10286, 0.29065],
            [0.10289, 0.29625],
            [0.103, 0.30183],
            [0.103, 0.3076],
            [0.103, 0.31323],
            [0.10312, 0.31886],
            [0.10326, 0.32443],
            [0.10331, 0.33],
            [0.10341, 0.33578],
            [0.10341, 0.34129],
            [0.10325, 0.34681],
            [0.10302, 0.35208],
            [0.10187, 0.3574],
            [0.10068, 0.36305],
            [0.09905, 0.36838],
            [0.09699, 0.37373],
            [0.09444, 0.37906],
            [0.09124, 0.38438],
            [0.08721, 0.38995],
            [0.0847, 0.39286],
            [0.08235, 0.39525],
            [0.08198, 0.39563],
            [0.07925, 0.39822],
            [0.07643, 0.40061],
            [0.07626, 0.40075],
            [0.07245, 0.40354],
            [0.06877, 0.40595],
            [0.06852, 0.4061],
            [0.06393, 0.40868],
            [0.05823, 0.41127],
            [0.05786, 0.41141],
            [0.05005, 0.41396],
            [0.0193, 0.4166],
          ],
        ],
        depth: 0.016,
      },
    },
    dimensions: {
      width: 0.2136,
      height: 0.2871,
      depth: 0.016,
      units: "meters",
      confidence: 0.55,
    },
    material: "edgeGuard",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(56, 67, 68, 1.0)",
      secondaryAlbedo: "rgba(65, 75, 77, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.8,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "trim",
      pivot: {
        mode: "center",
        localPosition: [0.0, 0.29, 0.0],
        axis: [0, 1, 0],
        confidence: 0.7,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "box",
        offset: [0, 0.29, 0],
        scale: [0.214, 0.287, 0.016],
        isTrigger: false,
        notes: "Shares the head hit box.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "head-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "facePlate",
      parentSocket: "face-front",
      localStart: [0.0, 0.1329, 0.0],
      localEnd: [0.0, 0.42, 0.0],
      contactType: "overlap",
      overlap: 0.0034,
      gapTolerance: 0.0002,
      contactNormal: [1, 0, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Ring overlaps the face plate's outer 3.4 mm on both skins and stands 2.2 mm proud of each.",
    },
  }
  node_edgeGuard_2.add(mesh_edgeGuard_2)
  meshes["edgeGuard"] = mesh_edgeGuard_2
  colliders["edgeGuard"] = {
    type: "box",
    offset: [0, 0.29, 0],
    scale: [0.214, 0.287, 0.016],
    isTrigger: false,
    notes: "Shares the head hit box.",
  }
  destructionGroups["head-assembly"] ??= []
  destructionGroups["head-assembly"].push(node_edgeGuard_2)

  const attachment_handleCore_3 = {
    parentId: "root",
    parentSocket: "grip-hand",
    localStart: [0.0, 0.028, 0.0],
    localEnd: [0.0, 0.135, 0.0],
    contactType: "socket",
    overlap: 0.015,
    gapTolerance: 0.0002,
    contactNormal: [0, 1, 0],
    evidenceRefs: ["full-object"],
    notes:
      "Runs up inside the collar; fully hidden by wrap and collar in the reference.",
    baseRadius: 0.0175,
    endRadius: 0.0175,
  }
  const endpoint_handleCore_3 = makeAttachmentEndpoint(attachment_handleCore_3)
  const node_handleCore_3 = new THREE.Group()
  node_handleCore_3.name = "Handle core__pivot"
  node_handleCore_3.scale.set(1, 1, 1)
  if (endpoint_handleCore_3) {
    node_handleCore_3.position.copy(endpoint_handleCore_3.start)
    node_handleCore_3.rotation.set(0.0, 0.0, 0.0)
  } else {
    node_handleCore_3.position.set(0.0, 0.0815, 0.0)
    node_handleCore_3.rotation.set(0.0, 0.0, 0.0)
  }
  node_handleCore_3.userData.sculptComponent = {
    level: "macro",
    role: "handle",
    importance: 0.5,
    confidence: 0.45,
    materialLayers: ["handleCore"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["handleCore.inferredOctagon"],
    evidenceRefs: ["full-object"],
    transform: { position: [0, 0.0815, 0], rotation: [0, 0, 0] },
    surfaceDetail: {
      macroRoughness: 0.2,
      microRoughness: 0.1,
      bumpAmplitude: 0.0,
      normalPattern: "none",
      displacementPattern: "none",
      occlusionPattern: "seam-cavity",
    },
    id: "handleCore",
    name: "Handle core",
    primitive: "cylinder",
    parent: "root",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A straight turned shaft; a single revolved solid with no sculpted variation.",
    geometryDescriptor: {
      topologyIntent: "straight shaft under the wrap",
      edgeTreatment: { type: "chamfer", bevelRadius: 0.0008, segments: 1 },
      deformationStack: [],
      uvStrategy: "cylindrical",
      normalStrategy: "vertex normals from generated geometry",
    },
    dimensions: {
      width: 0.035,
      height: 0.107,
      depth: 0.035,
      units: "meters",
      confidence: 0.35,
    },
    material: "handleCore",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(42, 44, 46, 1.0)",
      secondaryAlbedo: "rgba(30, 32, 34, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.3,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "handle",
      pivot: {
        mode: "socket",
        localPosition: [0.0, 0.0, 0.0],
        axis: [0, 1, 0],
        confidence: 0.6,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [
        {
          id: "wrap-bed",
          localPosition: [0, 0, 0],
          axis: [0, 1, 0],
          notes: "Surface the overwrap is wound onto.",
        },
        {
          id: "butt-socket",
          localPosition: [0, -0.0535, 0],
          axis: [0, -1, 0],
          notes: "Distal end the butt cap seats into.",
        },
      ],
      collider: {
        type: "capsule",
        offset: [0, 0.0815, 0],
        scale: [0.035, 0.107, 0.035],
        isTrigger: false,
        notes: "Grip collision proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "handle-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "root",
      parentSocket: "grip-hand",
      localStart: [0.0, 0.028, 0.0],
      localEnd: [0.0, 0.135, 0.0],
      contactType: "socket",
      overlap: 0.015,
      gapTolerance: 0.0002,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Runs up inside the collar; fully hidden by wrap and collar in the reference.",
      baseRadius: 0.0175,
      endRadius: 0.0175,
    },
  }
  node_handleCore_3.userData.actionProfile = {
    animationRole: "handle",
    pivot: {
      mode: "socket",
      localPosition: [0.0, 0.0, 0.0],
      axis: [0, 1, 0],
      confidence: 0.6,
    },
    transformChannels: {
      translate: true,
      rotate: true,
      scale: false,
      bend: false,
      twist: false,
      detach: true,
      visibility: true,
      materialState: true,
    },
    sockets: [
      {
        id: "wrap-bed",
        localPosition: [0, 0, 0],
        axis: [0, 1, 0],
        notes: "Surface the overwrap is wound onto.",
      },
      {
        id: "butt-socket",
        localPosition: [0, -0.0535, 0],
        axis: [0, -1, 0],
        notes: "Distal end the butt cap seats into.",
      },
    ],
    collider: {
      type: "capsule",
      offset: [0, 0.0815, 0],
      scale: [0.035, 0.107, 0.035],
      isTrigger: false,
      notes: "Grip collision proxy.",
    },
    constraints: [],
    destruction: {
      breakable: false,
      fractureGroup: "handle-assembly",
      seamRefs: [],
      detachableFragments: [],
      breakImpulse: 0.0,
      debrisMaterial: "base",
    },
  }
  ;(nodes["root"] ?? root).add(node_handleCore_3)
  nodes["handleCore"] = node_handleCore_3
  const mesh_handleCore_3Geometry = endpoint_handleCore_3
    ? new THREE.CylinderGeometry(
        endpoint_handleCore_3.endRadius,
        endpoint_handleCore_3.baseRadius,
        endpoint_handleCore_3.length,
        16,
        6
      )
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8)
  if (!endpoint_handleCore_3) {
    mesh_handleCore_3Geometry.scale(0.035, 0.107, 0.035)
  }
  const mesh_handleCore_3 = new THREE.Mesh(
    mesh_handleCore_3Geometry,
    materialMap["handleCore"] ??
      new THREE.MeshStandardMaterial({ color: 0x888888 })
  )
  mesh_handleCore_3.name = "Handle core"
  if (endpoint_handleCore_3) {
    mesh_handleCore_3.position.copy(endpoint_handleCore_3.midpoint)
    mesh_handleCore_3.quaternion.copy(endpoint_handleCore_3.quaternion)
  }
  mesh_handleCore_3.castShadow = options.castShadow ?? true
  mesh_handleCore_3.receiveShadow = options.receiveShadow ?? true
  mesh_handleCore_3.userData.sculptComponent = {
    level: "macro",
    role: "handle",
    importance: 0.5,
    confidence: 0.45,
    materialLayers: ["handleCore"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["handleCore.inferredOctagon"],
    evidenceRefs: ["full-object"],
    transform: { position: [0, 0.0815, 0], rotation: [0, 0, 0] },
    surfaceDetail: {
      macroRoughness: 0.2,
      microRoughness: 0.1,
      bumpAmplitude: 0.0,
      normalPattern: "none",
      displacementPattern: "none",
      occlusionPattern: "seam-cavity",
    },
    id: "handleCore",
    name: "Handle core",
    primitive: "cylinder",
    parent: "root",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A straight turned shaft; a single revolved solid with no sculpted variation.",
    geometryDescriptor: {
      topologyIntent: "straight shaft under the wrap",
      edgeTreatment: { type: "chamfer", bevelRadius: 0.0008, segments: 1 },
      deformationStack: [],
      uvStrategy: "cylindrical",
      normalStrategy: "vertex normals from generated geometry",
    },
    dimensions: {
      width: 0.035,
      height: 0.107,
      depth: 0.035,
      units: "meters",
      confidence: 0.35,
    },
    material: "handleCore",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(42, 44, 46, 1.0)",
      secondaryAlbedo: "rgba(30, 32, 34, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.3,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "handle",
      pivot: {
        mode: "socket",
        localPosition: [0.0, 0.0, 0.0],
        axis: [0, 1, 0],
        confidence: 0.6,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [
        {
          id: "wrap-bed",
          localPosition: [0, 0, 0],
          axis: [0, 1, 0],
          notes: "Surface the overwrap is wound onto.",
        },
        {
          id: "butt-socket",
          localPosition: [0, -0.0535, 0],
          axis: [0, -1, 0],
          notes: "Distal end the butt cap seats into.",
        },
      ],
      collider: {
        type: "capsule",
        offset: [0, 0.0815, 0],
        scale: [0.035, 0.107, 0.035],
        isTrigger: false,
        notes: "Grip collision proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "handle-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "root",
      parentSocket: "grip-hand",
      localStart: [0.0, 0.028, 0.0],
      localEnd: [0.0, 0.135, 0.0],
      contactType: "socket",
      overlap: 0.015,
      gapTolerance: 0.0002,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Runs up inside the collar; fully hidden by wrap and collar in the reference.",
      baseRadius: 0.0175,
      endRadius: 0.0175,
    },
  }
  node_handleCore_3.add(mesh_handleCore_3)
  meshes["handleCore"] = mesh_handleCore_3
  colliders["handleCore"] = {
    type: "capsule",
    offset: [0, 0.0815, 0],
    scale: [0.035, 0.107, 0.035],
    isTrigger: false,
    notes: "Grip collision proxy.",
  }
  destructionGroups["handle-assembly"] ??= []
  destructionGroups["handle-assembly"].push(node_handleCore_3)
  const socket_handleCore_wrap_bed_0 = new THREE.Object3D()
  socket_handleCore_wrap_bed_0.name = "wrap-bed"
  socket_handleCore_wrap_bed_0.position.set(0.0, 0.0, 0.0)
  socket_handleCore_wrap_bed_0.rotation.set(0, 0, 0)
  socket_handleCore_wrap_bed_0.userData.socket = {
    id: "wrap-bed",
    localPosition: [0, 0, 0],
    axis: [0, 1, 0],
    notes: "Surface the overwrap is wound onto.",
  }
  node_handleCore_3.add(socket_handleCore_wrap_bed_0)
  sockets["handleCore:wrap-bed"] = socket_handleCore_wrap_bed_0
  const socket_handleCore_butt_socket_1 = new THREE.Object3D()
  socket_handleCore_butt_socket_1.name = "butt-socket"
  socket_handleCore_butt_socket_1.position.set(0.0, -0.0535, 0.0)
  socket_handleCore_butt_socket_1.rotation.set(0, 0, 0)
  socket_handleCore_butt_socket_1.userData.socket = {
    id: "butt-socket",
    localPosition: [0, -0.0535, 0],
    axis: [0, -1, 0],
    notes: "Distal end the butt cap seats into.",
  }
  node_handleCore_3.add(socket_handleCore_butt_socket_1)
  sockets["handleCore:butt-socket"] = socket_handleCore_butt_socket_1

  const attachment_collarRingLower_4 = {
    parentId: "handleCore",
    parentSocket: "wrap-bed",
    localStart: [0.0, 0.092, 0.0],
    localEnd: [0.0, 0.0966, 0.0],
    contactType: "socket",
    overlap: 0.003,
    gapTolerance: 0.0001,
    contactNormal: [0, 1, 0],
    evidenceRefs: ["full-object"],
    notes:
      "Ring seats around the shaft; span and radii are the measured ring band, expressed in the handle core's local frame.",
    baseRadius: 0.0271,
    endRadius: 0.0271,
  }
  const endpoint_collarRingLower_4 = makeAttachmentEndpoint(
    attachment_collarRingLower_4
  )
  const node_collarRingLower_4 = new THREE.Group()
  node_collarRingLower_4.name = "Collar ring \u2014 lower black__pivot"
  node_collarRingLower_4.scale.set(1, 1, 1)
  if (endpoint_collarRingLower_4) {
    node_collarRingLower_4.position.copy(endpoint_collarRingLower_4.start)
    node_collarRingLower_4.rotation.set(0.0, 0.0, 0.0)
  } else {
    node_collarRingLower_4.position.set(0.0, 0.0408, 0.0)
    node_collarRingLower_4.rotation.set(0.0, 0.0, 0.0)
  }
  node_collarRingLower_4.userData.sculptComponent = {
    level: "meso",
    role: "hardware",
    importance: 0.6,
    confidence: 0.85,
    materialLayers: ["collarPolymer"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["collarRings.blackPair"],
    evidenceRefs: ["full-object"],
    transform: { position: [0, 0.0408, 0], rotation: [0, 0, 0] },
    surfaceDetail: {
      macroRoughness: 0.2,
      microRoughness: 0.1,
      bumpAmplitude: 0.0,
      normalPattern: "none",
      displacementPattern: "none",
      occlusionPattern: "seam-cavity",
    },
    id: "collarRingLower",
    name: "Collar ring — lower black",
    primitive: "cylinder",
    parent: "handleCore",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A discrete turned ring sitting on the shaft; a separate manufactured part.",
    geometryDescriptor: {
      topologyIntent: "thin revolved ring",
      edgeTreatment: { type: "chamfer", bevelRadius: 0.0004, segments: 1 },
      deformationStack: [],
      uvStrategy: "cylindrical",
      normalStrategy: "vertex normals from generated geometry",
    },
    dimensions: {
      width: 0.0542,
      height: 0.0046,
      depth: 0.0542,
      units: "meters",
      confidence: 0.8,
    },
    material: "collarPolymer",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(26, 29, 33, 1.0)",
      secondaryAlbedo: "rgba(38, 41, 45, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.85,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "hardware",
      pivot: {
        mode: "center",
        localPosition: [0, 0, 0],
        axis: [0, 1, 0],
        confidence: 0.85,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "cylinder",
        offset: [0, 0.1223, 0],
        scale: [0.0542, 0.0046, 0.0542],
        isTrigger: false,
        notes: "Ring proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "collar-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "handleCore",
      parentSocket: "wrap-bed",
      localStart: [0.0, 0.092, 0.0],
      localEnd: [0.0, 0.0966, 0.0],
      contactType: "socket",
      overlap: 0.003,
      gapTolerance: 0.0001,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Ring seats around the shaft; span and radii are the measured ring band, expressed in the handle core's local frame.",
      baseRadius: 0.0271,
      endRadius: 0.0271,
    },
  }
  node_collarRingLower_4.userData.actionProfile = {
    animationRole: "hardware",
    pivot: {
      mode: "center",
      localPosition: [0, 0, 0],
      axis: [0, 1, 0],
      confidence: 0.85,
    },
    transformChannels: {
      translate: true,
      rotate: true,
      scale: false,
      bend: false,
      twist: false,
      detach: true,
      visibility: true,
      materialState: true,
    },
    sockets: [],
    collider: {
      type: "cylinder",
      offset: [0, 0.1223, 0],
      scale: [0.0542, 0.0046, 0.0542],
      isTrigger: false,
      notes: "Ring proxy.",
    },
    constraints: [],
    destruction: {
      breakable: false,
      fractureGroup: "collar-assembly",
      seamRefs: [],
      detachableFragments: [],
      breakImpulse: 0.0,
      debrisMaterial: "base",
    },
  }
  ;(nodes["handleCore"] ?? root).add(node_collarRingLower_4)
  nodes["collarRingLower"] = node_collarRingLower_4
  const mesh_collarRingLower_4Geometry = endpoint_collarRingLower_4
    ? new THREE.CylinderGeometry(
        endpoint_collarRingLower_4.endRadius,
        endpoint_collarRingLower_4.baseRadius,
        endpoint_collarRingLower_4.length,
        16,
        6
      )
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8)
  if (!endpoint_collarRingLower_4) {
    mesh_collarRingLower_4Geometry.scale(0.0542, 0.0046, 0.0542)
  }
  const mesh_collarRingLower_4 = new THREE.Mesh(
    mesh_collarRingLower_4Geometry,
    materialMap["collarPolymer"] ??
      new THREE.MeshStandardMaterial({ color: 0x888888 })
  )
  mesh_collarRingLower_4.name = "Collar ring \u2014 lower black"
  if (endpoint_collarRingLower_4) {
    mesh_collarRingLower_4.position.copy(endpoint_collarRingLower_4.midpoint)
    mesh_collarRingLower_4.quaternion.copy(
      endpoint_collarRingLower_4.quaternion
    )
  }
  mesh_collarRingLower_4.castShadow = options.castShadow ?? true
  mesh_collarRingLower_4.receiveShadow = options.receiveShadow ?? true
  mesh_collarRingLower_4.userData.sculptComponent = {
    level: "meso",
    role: "hardware",
    importance: 0.6,
    confidence: 0.85,
    materialLayers: ["collarPolymer"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["collarRings.blackPair"],
    evidenceRefs: ["full-object"],
    transform: { position: [0, 0.0408, 0], rotation: [0, 0, 0] },
    surfaceDetail: {
      macroRoughness: 0.2,
      microRoughness: 0.1,
      bumpAmplitude: 0.0,
      normalPattern: "none",
      displacementPattern: "none",
      occlusionPattern: "seam-cavity",
    },
    id: "collarRingLower",
    name: "Collar ring — lower black",
    primitive: "cylinder",
    parent: "handleCore",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A discrete turned ring sitting on the shaft; a separate manufactured part.",
    geometryDescriptor: {
      topologyIntent: "thin revolved ring",
      edgeTreatment: { type: "chamfer", bevelRadius: 0.0004, segments: 1 },
      deformationStack: [],
      uvStrategy: "cylindrical",
      normalStrategy: "vertex normals from generated geometry",
    },
    dimensions: {
      width: 0.0542,
      height: 0.0046,
      depth: 0.0542,
      units: "meters",
      confidence: 0.8,
    },
    material: "collarPolymer",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(26, 29, 33, 1.0)",
      secondaryAlbedo: "rgba(38, 41, 45, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.85,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "hardware",
      pivot: {
        mode: "center",
        localPosition: [0, 0, 0],
        axis: [0, 1, 0],
        confidence: 0.85,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "cylinder",
        offset: [0, 0.1223, 0],
        scale: [0.0542, 0.0046, 0.0542],
        isTrigger: false,
        notes: "Ring proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "collar-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "handleCore",
      parentSocket: "wrap-bed",
      localStart: [0.0, 0.092, 0.0],
      localEnd: [0.0, 0.0966, 0.0],
      contactType: "socket",
      overlap: 0.003,
      gapTolerance: 0.0001,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Ring seats around the shaft; span and radii are the measured ring band, expressed in the handle core's local frame.",
      baseRadius: 0.0271,
      endRadius: 0.0271,
    },
  }
  node_collarRingLower_4.add(mesh_collarRingLower_4)
  meshes["collarRingLower"] = mesh_collarRingLower_4
  colliders["collarRingLower"] = {
    type: "cylinder",
    offset: [0, 0.1223, 0],
    scale: [0.0542, 0.0046, 0.0542],
    isTrigger: false,
    notes: "Ring proxy.",
  }
  destructionGroups["collar-assembly"] ??= []
  destructionGroups["collar-assembly"].push(node_collarRingLower_4)

  const attachment_collarRingGold_5 = {
    parentId: "handleCore",
    parentSocket: "wrap-bed",
    localStart: [0.0, 0.097, 0.0],
    localEnd: [0.0, 0.1028, 0.0],
    contactType: "socket",
    overlap: 0.003,
    gapTolerance: 0.0001,
    contactNormal: [0, 1, 0],
    evidenceRefs: ["full-object"],
    notes:
      "Ring seats around the shaft; span and radii are the measured ring band, expressed in the handle core's local frame.",
    baseRadius: 0.0286,
    endRadius: 0.0286,
  }
  const endpoint_collarRingGold_5 = makeAttachmentEndpoint(
    attachment_collarRingGold_5
  )
  const node_collarRingGold_5 = new THREE.Group()
  node_collarRingGold_5.name = "Collar ring \u2014 gold__pivot"
  node_collarRingGold_5.scale.set(1, 1, 1)
  if (endpoint_collarRingGold_5) {
    node_collarRingGold_5.position.copy(endpoint_collarRingGold_5.start)
    node_collarRingGold_5.rotation.set(0.0, 0.0, 0.0)
  } else {
    node_collarRingGold_5.position.set(0.0, 0.0464, 0.0)
    node_collarRingGold_5.rotation.set(0.0, 0.0, 0.0)
  }
  node_collarRingGold_5.userData.sculptComponent = {
    level: "meso",
    role: "hardware",
    importance: 0.8,
    confidence: 0.9,
    materialLayers: ["collarGold"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["collarRingGold.metalBand"],
    evidenceRefs: ["full-object"],
    transform: { position: [0, 0.0464, 0], rotation: [0, 0, 0] },
    surfaceDetail: {
      macroRoughness: 0.1,
      microRoughness: 0.06,
      bumpAmplitude: 0.0,
      normalPattern: "circumferential turn lines",
      displacementPattern: "none",
      occlusionPattern: "ring-edge cavity",
    },
    id: "collarRingGold",
    name: "Collar ring — gold",
    primitive: "cylinder",
    parent: "handleCore",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A discrete turned metal ring; the only metal part, manufactured separately.",
    geometryDescriptor: {
      topologyIntent: "thin revolved metal ring",
      edgeTreatment: { type: "chamfer", bevelRadius: 0.0004, segments: 1 },
      deformationStack: [],
      uvStrategy: "cylindrical",
      normalStrategy: "vertex normals from generated geometry",
    },
    dimensions: {
      width: 0.0572,
      height: 0.0058,
      depth: 0.0572,
      units: "meters",
      confidence: 0.85,
    },
    material: "collarGold",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(182, 153, 92, 1.0)",
      secondaryAlbedo: "rgba(224, 206, 166, 1.0)",
      materialClass: "metal",
      materialClassConfidence: 0.8,
      evidenceRefs: ["full-object"],
      colorGradient: {
        type: "linear",
        stops: [
          { position: 0.0, color: "rgba(140, 116, 68, 1.0)" },
          { position: 0.5, color: "rgba(191, 163, 100, 1.0)" },
          { position: 1.0, color: "rgba(224, 206, 166, 1.0)" },
        ],
      },
    },
    actionProfile: {
      animationRole: "hardware",
      pivot: {
        mode: "center",
        localPosition: [0, 0, 0],
        axis: [0, 1, 0],
        confidence: 0.9,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "cylinder",
        offset: [0, 0.1279, 0],
        scale: [0.0572, 0.0058, 0.0572],
        isTrigger: false,
        notes: "Ring proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "collar-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "handleCore",
      parentSocket: "wrap-bed",
      localStart: [0.0, 0.097, 0.0],
      localEnd: [0.0, 0.1028, 0.0],
      contactType: "socket",
      overlap: 0.003,
      gapTolerance: 0.0001,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Ring seats around the shaft; span and radii are the measured ring band, expressed in the handle core's local frame.",
      baseRadius: 0.0286,
      endRadius: 0.0286,
    },
  }
  node_collarRingGold_5.userData.actionProfile = {
    animationRole: "hardware",
    pivot: {
      mode: "center",
      localPosition: [0, 0, 0],
      axis: [0, 1, 0],
      confidence: 0.9,
    },
    transformChannels: {
      translate: true,
      rotate: true,
      scale: false,
      bend: false,
      twist: false,
      detach: true,
      visibility: true,
      materialState: true,
    },
    sockets: [],
    collider: {
      type: "cylinder",
      offset: [0, 0.1279, 0],
      scale: [0.0572, 0.0058, 0.0572],
      isTrigger: false,
      notes: "Ring proxy.",
    },
    constraints: [],
    destruction: {
      breakable: false,
      fractureGroup: "collar-assembly",
      seamRefs: [],
      detachableFragments: [],
      breakImpulse: 0.0,
      debrisMaterial: "base",
    },
  }
  ;(nodes["handleCore"] ?? root).add(node_collarRingGold_5)
  nodes["collarRingGold"] = node_collarRingGold_5
  const mesh_collarRingGold_5Geometry = endpoint_collarRingGold_5
    ? new THREE.CylinderGeometry(
        endpoint_collarRingGold_5.endRadius,
        endpoint_collarRingGold_5.baseRadius,
        endpoint_collarRingGold_5.length,
        16,
        6
      )
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8)
  if (!endpoint_collarRingGold_5) {
    mesh_collarRingGold_5Geometry.scale(0.0572, 0.0058, 0.0572)
  }
  const mesh_collarRingGold_5 = new THREE.Mesh(
    mesh_collarRingGold_5Geometry,
    materialMap["collarGold"] ??
      new THREE.MeshStandardMaterial({ color: 0x888888 })
  )
  mesh_collarRingGold_5.name = "Collar ring \u2014 gold"
  if (endpoint_collarRingGold_5) {
    mesh_collarRingGold_5.position.copy(endpoint_collarRingGold_5.midpoint)
    mesh_collarRingGold_5.quaternion.copy(endpoint_collarRingGold_5.quaternion)
  }
  mesh_collarRingGold_5.castShadow = options.castShadow ?? true
  mesh_collarRingGold_5.receiveShadow = options.receiveShadow ?? true
  mesh_collarRingGold_5.userData.sculptComponent = {
    level: "meso",
    role: "hardware",
    importance: 0.8,
    confidence: 0.9,
    materialLayers: ["collarGold"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["collarRingGold.metalBand"],
    evidenceRefs: ["full-object"],
    transform: { position: [0, 0.0464, 0], rotation: [0, 0, 0] },
    surfaceDetail: {
      macroRoughness: 0.1,
      microRoughness: 0.06,
      bumpAmplitude: 0.0,
      normalPattern: "circumferential turn lines",
      displacementPattern: "none",
      occlusionPattern: "ring-edge cavity",
    },
    id: "collarRingGold",
    name: "Collar ring — gold",
    primitive: "cylinder",
    parent: "handleCore",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A discrete turned metal ring; the only metal part, manufactured separately.",
    geometryDescriptor: {
      topologyIntent: "thin revolved metal ring",
      edgeTreatment: { type: "chamfer", bevelRadius: 0.0004, segments: 1 },
      deformationStack: [],
      uvStrategy: "cylindrical",
      normalStrategy: "vertex normals from generated geometry",
    },
    dimensions: {
      width: 0.0572,
      height: 0.0058,
      depth: 0.0572,
      units: "meters",
      confidence: 0.85,
    },
    material: "collarGold",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(182, 153, 92, 1.0)",
      secondaryAlbedo: "rgba(224, 206, 166, 1.0)",
      materialClass: "metal",
      materialClassConfidence: 0.8,
      evidenceRefs: ["full-object"],
      colorGradient: {
        type: "linear",
        stops: [
          { position: 0.0, color: "rgba(140, 116, 68, 1.0)" },
          { position: 0.5, color: "rgba(191, 163, 100, 1.0)" },
          { position: 1.0, color: "rgba(224, 206, 166, 1.0)" },
        ],
      },
    },
    actionProfile: {
      animationRole: "hardware",
      pivot: {
        mode: "center",
        localPosition: [0, 0, 0],
        axis: [0, 1, 0],
        confidence: 0.9,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "cylinder",
        offset: [0, 0.1279, 0],
        scale: [0.0572, 0.0058, 0.0572],
        isTrigger: false,
        notes: "Ring proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "collar-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "handleCore",
      parentSocket: "wrap-bed",
      localStart: [0.0, 0.097, 0.0],
      localEnd: [0.0, 0.1028, 0.0],
      contactType: "socket",
      overlap: 0.003,
      gapTolerance: 0.0001,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Ring seats around the shaft; span and radii are the measured ring band, expressed in the handle core's local frame.",
      baseRadius: 0.0286,
      endRadius: 0.0286,
    },
  }
  node_collarRingGold_5.add(mesh_collarRingGold_5)
  meshes["collarRingGold"] = mesh_collarRingGold_5
  colliders["collarRingGold"] = {
    type: "cylinder",
    offset: [0, 0.1279, 0],
    scale: [0.0572, 0.0058, 0.0572],
    isTrigger: false,
    notes: "Ring proxy.",
  }
  destructionGroups["collar-assembly"] ??= []
  destructionGroups["collar-assembly"].push(node_collarRingGold_5)

  const attachment_collarRingUpper_6 = {
    parentId: "handleCore",
    parentSocket: "wrap-bed",
    localStart: [0.0, 0.1032, 0.0],
    localEnd: [0.0, 0.1074, 0.0],
    contactType: "socket",
    overlap: 0.003,
    gapTolerance: 0.0001,
    contactNormal: [0, 1, 0],
    evidenceRefs: ["full-object"],
    notes:
      "Ring seats around the shaft; span and radii are the measured ring band, expressed in the handle core's local frame.",
    baseRadius: 0.0296,
    endRadius: 0.0296,
  }
  const endpoint_collarRingUpper_6 = makeAttachmentEndpoint(
    attachment_collarRingUpper_6
  )
  const node_collarRingUpper_6 = new THREE.Group()
  node_collarRingUpper_6.name = "Collar ring \u2014 upper black__pivot"
  node_collarRingUpper_6.scale.set(1, 1, 1)
  if (endpoint_collarRingUpper_6) {
    node_collarRingUpper_6.position.copy(endpoint_collarRingUpper_6.start)
    node_collarRingUpper_6.rotation.set(0.0, 0.0, 0.0)
  } else {
    node_collarRingUpper_6.position.set(0.0, 0.0518, 0.0)
    node_collarRingUpper_6.rotation.set(0.0, 0.0, 0.0)
  }
  node_collarRingUpper_6.userData.sculptComponent = {
    level: "meso",
    role: "hardware",
    importance: 0.6,
    confidence: 0.85,
    materialLayers: ["collarPolymer"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["collarRings.blackPair"],
    evidenceRefs: ["full-object"],
    transform: { position: [0, 0.0518, 0], rotation: [0, 0, 0] },
    surfaceDetail: {
      macroRoughness: 0.2,
      microRoughness: 0.1,
      bumpAmplitude: 0.0,
      normalPattern: "none",
      displacementPattern: "none",
      occlusionPattern: "seam-cavity",
    },
    id: "collarRingUpper",
    name: "Collar ring — upper black",
    primitive: "cylinder",
    parent: "handleCore",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A discrete turned ring sitting on the shaft; a separate manufactured part.",
    geometryDescriptor: {
      topologyIntent: "thin revolved ring",
      edgeTreatment: { type: "chamfer", bevelRadius: 0.0004, segments: 1 },
      deformationStack: [],
      uvStrategy: "cylindrical",
      normalStrategy: "vertex normals from generated geometry",
    },
    dimensions: {
      width: 0.0592,
      height: 0.0042,
      depth: 0.0592,
      units: "meters",
      confidence: 0.8,
    },
    material: "collarPolymer",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(26, 29, 33, 1.0)",
      secondaryAlbedo: "rgba(38, 41, 45, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.85,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "hardware",
      pivot: {
        mode: "center",
        localPosition: [0, 0, 0],
        axis: [0, 1, 0],
        confidence: 0.85,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "cylinder",
        offset: [0, 0.1333, 0],
        scale: [0.0592, 0.0042, 0.0592],
        isTrigger: false,
        notes: "Ring proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "collar-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "handleCore",
      parentSocket: "wrap-bed",
      localStart: [0.0, 0.1032, 0.0],
      localEnd: [0.0, 0.1074, 0.0],
      contactType: "socket",
      overlap: 0.003,
      gapTolerance: 0.0001,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Ring seats around the shaft; span and radii are the measured ring band, expressed in the handle core's local frame.",
      baseRadius: 0.0296,
      endRadius: 0.0296,
    },
  }
  node_collarRingUpper_6.userData.actionProfile = {
    animationRole: "hardware",
    pivot: {
      mode: "center",
      localPosition: [0, 0, 0],
      axis: [0, 1, 0],
      confidence: 0.85,
    },
    transformChannels: {
      translate: true,
      rotate: true,
      scale: false,
      bend: false,
      twist: false,
      detach: true,
      visibility: true,
      materialState: true,
    },
    sockets: [],
    collider: {
      type: "cylinder",
      offset: [0, 0.1333, 0],
      scale: [0.0592, 0.0042, 0.0592],
      isTrigger: false,
      notes: "Ring proxy.",
    },
    constraints: [],
    destruction: {
      breakable: false,
      fractureGroup: "collar-assembly",
      seamRefs: [],
      detachableFragments: [],
      breakImpulse: 0.0,
      debrisMaterial: "base",
    },
  }
  ;(nodes["handleCore"] ?? root).add(node_collarRingUpper_6)
  nodes["collarRingUpper"] = node_collarRingUpper_6
  const mesh_collarRingUpper_6Geometry = endpoint_collarRingUpper_6
    ? new THREE.CylinderGeometry(
        endpoint_collarRingUpper_6.endRadius,
        endpoint_collarRingUpper_6.baseRadius,
        endpoint_collarRingUpper_6.length,
        16,
        6
      )
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8)
  if (!endpoint_collarRingUpper_6) {
    mesh_collarRingUpper_6Geometry.scale(0.0592, 0.0042, 0.0592)
  }
  const mesh_collarRingUpper_6 = new THREE.Mesh(
    mesh_collarRingUpper_6Geometry,
    materialMap["collarPolymer"] ??
      new THREE.MeshStandardMaterial({ color: 0x888888 })
  )
  mesh_collarRingUpper_6.name = "Collar ring \u2014 upper black"
  if (endpoint_collarRingUpper_6) {
    mesh_collarRingUpper_6.position.copy(endpoint_collarRingUpper_6.midpoint)
    mesh_collarRingUpper_6.quaternion.copy(
      endpoint_collarRingUpper_6.quaternion
    )
  }
  mesh_collarRingUpper_6.castShadow = options.castShadow ?? true
  mesh_collarRingUpper_6.receiveShadow = options.receiveShadow ?? true
  mesh_collarRingUpper_6.userData.sculptComponent = {
    level: "meso",
    role: "hardware",
    importance: 0.6,
    confidence: 0.85,
    materialLayers: ["collarPolymer"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["collarRings.blackPair"],
    evidenceRefs: ["full-object"],
    transform: { position: [0, 0.0518, 0], rotation: [0, 0, 0] },
    surfaceDetail: {
      macroRoughness: 0.2,
      microRoughness: 0.1,
      bumpAmplitude: 0.0,
      normalPattern: "none",
      displacementPattern: "none",
      occlusionPattern: "seam-cavity",
    },
    id: "collarRingUpper",
    name: "Collar ring — upper black",
    primitive: "cylinder",
    parent: "handleCore",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A discrete turned ring sitting on the shaft; a separate manufactured part.",
    geometryDescriptor: {
      topologyIntent: "thin revolved ring",
      edgeTreatment: { type: "chamfer", bevelRadius: 0.0004, segments: 1 },
      deformationStack: [],
      uvStrategy: "cylindrical",
      normalStrategy: "vertex normals from generated geometry",
    },
    dimensions: {
      width: 0.0592,
      height: 0.0042,
      depth: 0.0592,
      units: "meters",
      confidence: 0.8,
    },
    material: "collarPolymer",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(26, 29, 33, 1.0)",
      secondaryAlbedo: "rgba(38, 41, 45, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.85,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "hardware",
      pivot: {
        mode: "center",
        localPosition: [0, 0, 0],
        axis: [0, 1, 0],
        confidence: 0.85,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "cylinder",
        offset: [0, 0.1333, 0],
        scale: [0.0592, 0.0042, 0.0592],
        isTrigger: false,
        notes: "Ring proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "collar-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "handleCore",
      parentSocket: "wrap-bed",
      localStart: [0.0, 0.1032, 0.0],
      localEnd: [0.0, 0.1074, 0.0],
      contactType: "socket",
      overlap: 0.003,
      gapTolerance: 0.0001,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Ring seats around the shaft; span and radii are the measured ring band, expressed in the handle core's local frame.",
      baseRadius: 0.0296,
      endRadius: 0.0296,
    },
  }
  node_collarRingUpper_6.add(mesh_collarRingUpper_6)
  meshes["collarRingUpper"] = mesh_collarRingUpper_6
  colliders["collarRingUpper"] = {
    type: "cylinder",
    offset: [0, 0.1333, 0],
    scale: [0.0592, 0.0042, 0.0592],
    isTrigger: false,
    notes: "Ring proxy.",
  }
  destructionGroups["collar-assembly"] ??= []
  destructionGroups["collar-assembly"].push(node_collarRingUpper_6)

  const attachment_gripWrap_7 = {
    parentId: "handleCore",
    parentSocket: "wrap-bed",
    localStart: [0.0, -0.0521, 0.0],
    localEnd: [0.0, 0.0382, 0.0],
    contactType: "overlap",
    overlap: 0.002,
    gapTolerance: 0.0001,
    contactNormal: [0, 1, 0],
    evidenceRefs: ["full-object"],
    notes: "Wound directly onto the shaft; no gap.",
  }
  // /* patched by tools/patch_paddle_factory.py */ authored geometryDescriptor form, not an attachment cylinder.
  void makeAttachmentEndpoint(attachment_gripWrap_7)
  const endpoint_gripWrap_7 = authoredGeometryEndpoint()
  const node_gripWrap_7 = new THREE.Group()
  node_gripWrap_7.name = "Grip overwrap__pivot"
  node_gripWrap_7.scale.set(1, 1, 1)
  if (endpoint_gripWrap_7) {
    node_gripWrap_7.position.copy(endpoint_gripWrap_7.start)
    node_gripWrap_7.rotation.set(0.0, 0.0, 0.0)
  } else {
    node_gripWrap_7.position.set(0.0, -0.028, 0.0)
    node_gripWrap_7.rotation.set(0.0, 0.0, 0.0)
  }
  node_gripWrap_7.userData.sculptComponent = {
    level: "macro",
    role: "grip",
    importance: 0.85,
    confidence: 0.8,
    materialLayers: ["gripWrap"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["gripWrap.terminalSeam"],
    evidenceRefs: ["full-object"],
    transform: {
      position: [0.0, -0.028, 0.0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    surfaceDetail: {
      macroRoughness: 0.3,
      microRoughness: 0.22,
      bumpAmplitude: 0.0006,
      normalPattern:
        "sparse round perforation dimples (dark-pixel fraction 0.036)",
      displacementPattern: "none",
      occlusionPattern: "perforation cavity",
    },
    id: "gripWrap",
    name: "Grip overwrap",
    primitive: "lathe",
    parent: "handleCore",
    topologyClass: "conforming-shell",
    topologyRationale:
      "A thin wrap that takes the shaft's form rather than having its own volume; its radius profile is measured off the silhouette, not sculpted.",
    geometryDescriptor: {
      topologyIntent:
        "revolved shell over the shaft, tapering out into the collar",
      edgeTreatment: { type: "none", bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy: "cylindrical (u around, v along the barrel)",
      normalStrategy: "vertex normals from generated geometry",
      latheProfile: {
        points: [
          [0.02018, 0.0294],
          [0.01946, 0.0335],
          [0.01935, 0.0501],
          [0.01935, 0.0708],
          [0.01966, 0.0915],
          [0.01998, 0.1021],
          [0.02122, 0.1081],
          [0.02246, 0.1143],
          [0.02443, 0.1184],
          [0.02546, 0.1201],
        ],
        segments: 32,
      },
      latheProfileEvidence:
        "Radii read directly off mask rows y_img 1462/1470/1490/1520/1549/1600/1700/1800/1880/1900, converted at S = 0.42 m / 2029 px. Replaces the hand-smoothed first profile.",
    },
    dimensions: {
      width: 0.05,
      height: 0.0903,
      depth: 0.05,
      units: "meters",
      confidence: 0.85,
    },
    material: "gripWrap",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(228, 211, 182, 1.0)",
      secondaryAlbedo: "rgba(200, 182, 152, 1.0)",
      materialClass: "fabric",
      materialClassConfidence: 0.75,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "grip",
      pivot: {
        mode: "socket",
        localPosition: [0.0, 0.07, 0.0],
        axis: [0, 1, 0],
        confidence: 0.85,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [
        {
          id: "hand-center",
          localPosition: [0.0, 0.07, 0.0],
          axis: [0, 1, 0],
          notes: "Where a hand closes on the wrap.",
        },
      ],
      collider: {
        type: "capsule",
        offset: [0, 0.0745, 0],
        scale: [0.05, 0.0903, 0.05],
        isTrigger: false,
        notes: "Hand contact proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "handle-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "handleCore",
      parentSocket: "wrap-bed",
      localStart: [0.0, -0.0521, 0.0],
      localEnd: [0.0, 0.0382, 0.0],
      contactType: "overlap",
      overlap: 0.002,
      gapTolerance: 0.0001,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes: "Wound directly onto the shaft; no gap.",
    },
  }
  node_gripWrap_7.userData.actionProfile = {
    animationRole: "grip",
    pivot: {
      mode: "socket",
      localPosition: [0.0, 0.07, 0.0],
      axis: [0, 1, 0],
      confidence: 0.85,
    },
    transformChannels: {
      translate: true,
      rotate: true,
      scale: false,
      bend: false,
      twist: false,
      detach: true,
      visibility: true,
      materialState: true,
    },
    sockets: [
      {
        id: "hand-center",
        localPosition: [0.0, 0.07, 0.0],
        axis: [0, 1, 0],
        notes: "Where a hand closes on the wrap.",
      },
    ],
    collider: {
      type: "capsule",
      offset: [0, 0.0745, 0],
      scale: [0.05, 0.0903, 0.05],
      isTrigger: false,
      notes: "Hand contact proxy.",
    },
    constraints: [],
    destruction: {
      breakable: false,
      fractureGroup: "handle-assembly",
      seamRefs: [],
      detachableFragments: [],
      breakImpulse: 0.0,
      debrisMaterial: "base",
    },
  }
  ;(nodes["handleCore"] ?? root).add(node_gripWrap_7)
  nodes["gripWrap"] = node_gripWrap_7
  const mesh_gripWrap_7Geometry = endpoint_gripWrap_7
    ? new THREE.CylinderGeometry(
        endpoint_gripWrap_7.endRadius,
        endpoint_gripWrap_7.baseRadius,
        endpoint_gripWrap_7.length,
        16,
        6
      )
    : buildLatheGeometry({
        points: [
          [0.02018, 0.0294],
          [0.01946, 0.0335],
          [0.01935, 0.0501],
          [0.01935, 0.0708],
          [0.01966, 0.0915],
          [0.01998, 0.1021],
          [0.02122, 0.1081],
          [0.02246, 0.1143],
          [0.02443, 0.1184],
          [0.02546, 0.1201],
        ],
        segments: 32,
      })
  if (!endpoint_gripWrap_7) {
    mesh_gripWrap_7Geometry.scale(1.0, 1.0, 1.0)
  }
  const mesh_gripWrap_7 = new THREE.Mesh(
    mesh_gripWrap_7Geometry,
    materialMap["gripWrap"] ??
      new THREE.MeshStandardMaterial({ color: 0x888888 })
  )
  mesh_gripWrap_7.name = "Grip overwrap"
  if (endpoint_gripWrap_7) {
    mesh_gripWrap_7.position.copy(endpoint_gripWrap_7.midpoint)
    mesh_gripWrap_7.quaternion.copy(endpoint_gripWrap_7.quaternion)
  }
  mesh_gripWrap_7.castShadow = options.castShadow ?? true
  mesh_gripWrap_7.receiveShadow = options.receiveShadow ?? true
  mesh_gripWrap_7.userData.sculptComponent = {
    level: "macro",
    role: "grip",
    importance: 0.85,
    confidence: 0.8,
    materialLayers: ["gripWrap"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["gripWrap.terminalSeam"],
    evidenceRefs: ["full-object"],
    transform: {
      position: [0.0, -0.028, 0.0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    surfaceDetail: {
      macroRoughness: 0.3,
      microRoughness: 0.22,
      bumpAmplitude: 0.0006,
      normalPattern:
        "sparse round perforation dimples (dark-pixel fraction 0.036)",
      displacementPattern: "none",
      occlusionPattern: "perforation cavity",
    },
    id: "gripWrap",
    name: "Grip overwrap",
    primitive: "lathe",
    parent: "handleCore",
    topologyClass: "conforming-shell",
    topologyRationale:
      "A thin wrap that takes the shaft's form rather than having its own volume; its radius profile is measured off the silhouette, not sculpted.",
    geometryDescriptor: {
      topologyIntent:
        "revolved shell over the shaft, tapering out into the collar",
      edgeTreatment: { type: "none", bevelRadius: 0.0, segments: 1 },
      deformationStack: [],
      uvStrategy: "cylindrical (u around, v along the barrel)",
      normalStrategy: "vertex normals from generated geometry",
      latheProfile: {
        points: [
          [0.02018, 0.0294],
          [0.01946, 0.0335],
          [0.01935, 0.0501],
          [0.01935, 0.0708],
          [0.01966, 0.0915],
          [0.01998, 0.1021],
          [0.02122, 0.1081],
          [0.02246, 0.1143],
          [0.02443, 0.1184],
          [0.02546, 0.1201],
        ],
        segments: 32,
      },
      latheProfileEvidence:
        "Radii read directly off mask rows y_img 1462/1470/1490/1520/1549/1600/1700/1800/1880/1900, converted at S = 0.42 m / 2029 px. Replaces the hand-smoothed first profile.",
    },
    dimensions: {
      width: 0.05,
      height: 0.0903,
      depth: 0.05,
      units: "meters",
      confidence: 0.85,
    },
    material: "gripWrap",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(228, 211, 182, 1.0)",
      secondaryAlbedo: "rgba(200, 182, 152, 1.0)",
      materialClass: "fabric",
      materialClassConfidence: 0.75,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "grip",
      pivot: {
        mode: "socket",
        localPosition: [0.0, 0.07, 0.0],
        axis: [0, 1, 0],
        confidence: 0.85,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [
        {
          id: "hand-center",
          localPosition: [0.0, 0.07, 0.0],
          axis: [0, 1, 0],
          notes: "Where a hand closes on the wrap.",
        },
      ],
      collider: {
        type: "capsule",
        offset: [0, 0.0745, 0],
        scale: [0.05, 0.0903, 0.05],
        isTrigger: false,
        notes: "Hand contact proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "handle-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "handleCore",
      parentSocket: "wrap-bed",
      localStart: [0.0, -0.0521, 0.0],
      localEnd: [0.0, 0.0382, 0.0],
      contactType: "overlap",
      overlap: 0.002,
      gapTolerance: 0.0001,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes: "Wound directly onto the shaft; no gap.",
    },
  }
  node_gripWrap_7.add(mesh_gripWrap_7)
  meshes["gripWrap"] = mesh_gripWrap_7
  colliders["gripWrap"] = {
    type: "capsule",
    offset: [0, 0.0745, 0],
    scale: [0.05, 0.0903, 0.05],
    isTrigger: false,
    notes: "Hand contact proxy.",
  }
  destructionGroups["handle-assembly"] ??= []
  destructionGroups["handle-assembly"].push(node_gripWrap_7)
  const socket_gripWrap_hand_center_0 = new THREE.Object3D()
  socket_gripWrap_hand_center_0.name = "hand-center"
  socket_gripWrap_hand_center_0.position.set(0.0, 0.07, 0.0)
  socket_gripWrap_hand_center_0.rotation.set(0, 0, 0)
  socket_gripWrap_hand_center_0.userData.socket = {
    id: "hand-center",
    localPosition: [0.0, 0.07, 0.0],
    axis: [0, 1, 0],
    notes: "Where a hand closes on the wrap.",
  }
  node_gripWrap_7.add(socket_gripWrap_hand_center_0)
  sockets["gripWrap:hand-center"] = socket_gripWrap_hand_center_0

  const attachment_gripWrapHelix_8 = {
    parentId: "gripWrap",
    parentSocket: "hand-center",
    localStart: [0.0, -0.036, 0.0],
    localEnd: [0.0, 0.046, 0.0],
    contactType: "overlap",
    overlap: 0.0009,
    gapTolerance: 0.0001,
    contactNormal: [0, 1, 0],
    evidenceRefs: ["full-object"],
    notes:
      "Ridge sits on the wrap surface; rides with its parent when exploded.",
  }
  // /* patched by tools/patch_paddle_factory.py */ authored geometryDescriptor form, not an attachment cylinder.
  void makeAttachmentEndpoint(attachment_gripWrapHelix_8)
  const endpoint_gripWrapHelix_8 = authoredGeometryEndpoint()
  const node_gripWrapHelix_8 = new THREE.Group()
  node_gripWrapHelix_8.name = "Overwrap ridge helix__pivot"
  node_gripWrapHelix_8.scale.set(1, 1, 1)
  if (endpoint_gripWrapHelix_8) {
    node_gripWrapHelix_8.position.copy(endpoint_gripWrapHelix_8.start)
    node_gripWrapHelix_8.rotation.set(0.0, 0.0, 0.0)
  } else {
    node_gripWrapHelix_8.position.set(0.0, 0.0, 0.0)
    node_gripWrapHelix_8.rotation.set(0.0, 0.0, 0.0)
  }
  node_gripWrapHelix_8.userData.sculptComponent = {
    level: "micro",
    role: "trim",
    importance: 0.5,
    confidence: 0.7,
    materialLayers: ["gripWrap"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["gripWrap.helixRidge"],
    evidenceRefs: ["full-object"],
    transform: {
      position: [0.0, 0.0, 0.0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    surfaceDetail: {
      macroRoughness: 0.3,
      microRoughness: 0.22,
      bumpAmplitude: 0.0004,
      normalPattern: "same wrap grain as the host surface",
      displacementPattern: "none",
      occlusionPattern: "ridge-root cavity",
    },
    id: "gripWrapHelix",
    name: "Overwrap ridge helix",
    primitive: "tube",
    parent: "gripWrap",
    topologyClass: "surface-relief",
    topologyRationale:
      "A raised ridge riding on the wrap surface; relief on a host surface, not an independent volume.",
    geometryDescriptor: {
      topologyIntent: "swept ridge following the overwrap helix",
      edgeTreatment: { type: "fillet", bevelRadius: 0.0004, segments: 1 },
      deformationStack: [],
      uvStrategy: "tube-parametric",
      normalStrategy: "vertex normals from generated geometry",
      tubePath: {
        points: [
          [0.02015, 0.034, 0.0],
          [0.01745, 0.03462, 0.01007],
          [0.01007, 0.03524, 0.01745],
          [0.0, 0.03586, 0.02015],
          [-0.01008, 0.03648, 0.01745],
          [-0.01745, 0.03711, 0.01007],
          [-0.02015, 0.03773, 0.0],
          [-0.01745, 0.03835, -0.01008],
          [-0.01007, 0.03897, -0.01745],
          [-0.0, 0.03959, -0.02015],
          [0.01008, 0.04021, -0.01745],
          [0.01745, 0.04083, -0.01008],
          [0.02015, 0.04145, -0.0],
          [0.01745, 0.04208, 0.01007],
          [0.01007, 0.0427, 0.01745],
          [0.0, 0.04332, 0.02015],
          [-0.01008, 0.04394, 0.01745],
          [-0.01745, 0.04456, 0.01008],
          [-0.02015, 0.04518, 0.0],
          [-0.01745, 0.0458, -0.01008],
          [-0.01007, 0.04642, -0.01745],
          [-0.0, 0.04705, -0.02015],
          [0.01007, 0.04767, -0.01745],
          [0.01745, 0.04829, -0.01007],
          [0.02015, 0.04891, -0.0],
          [0.01745, 0.04953, 0.01008],
          [0.01008, 0.05015, 0.01745],
          [0.0, 0.05077, 0.02015],
          [-0.01008, 0.05139, 0.01745],
          [-0.01745, 0.05202, 0.01008],
          [-0.02015, 0.05264, 0.0],
          [-0.01745, 0.05326, -0.01007],
          [-0.01007, 0.05388, -0.01745],
          [-0.0, 0.0545, -0.02015],
          [0.01007, 0.05512, -0.01745],
          [0.01745, 0.05574, -0.01008],
          [0.02015, 0.05636, -0.0],
          [0.01745, 0.05698, 0.01007],
          [0.01007, 0.05761, 0.01745],
          [-0.0, 0.05823, 0.02015],
          [-0.01008, 0.05885, 0.01745],
          [-0.01745, 0.05947, 0.01008],
          [-0.02015, 0.06009, 0.0],
          [-0.01745, 0.06071, -0.01007],
          [-0.01008, 0.06133, -0.01745],
          [-0.0, 0.06195, -0.02015],
          [0.01008, 0.06258, -0.01745],
          [0.01745, 0.0632, -0.01008],
          [0.02015, 0.06382, -0.0],
          [0.01745, 0.06444, 0.01007],
          [0.01007, 0.06506, 0.01745],
          [-0.0, 0.06568, 0.02015],
          [-0.01007, 0.0663, 0.01745],
          [-0.01745, 0.06692, 0.01008],
          [-0.02015, 0.06755, 0.0],
          [-0.01745, 0.06817, -0.01008],
          [-0.01007, 0.06879, -0.01745],
          [-0.0, 0.06941, -0.02015],
          [0.01007, 0.07003, -0.01745],
          [0.01745, 0.07065, -0.01008],
          [0.02015, 0.07127, -0.0],
          [0.01745, 0.07189, 0.01007],
          [0.01008, 0.07252, 0.01745],
          [-0.0, 0.07314, 0.02015],
          [-0.01008, 0.07376, 0.01745],
          [-0.01745, 0.07438, 0.01008],
          [-0.02015, 0.075, 0.0],
          [-0.01745, 0.07562, -0.01007],
          [-0.01008, 0.07624, -0.01745],
          [-0.0, 0.07686, -0.02015],
          [0.01007, 0.07748, -0.01745],
          [0.01745, 0.07811, -0.01008],
          [0.02015, 0.07873, -0.0],
          [0.01745, 0.07935, 0.01007],
          [0.01008, 0.07997, 0.01745],
          [-0.0, 0.08059, 0.02015],
          [-0.01008, 0.08121, 0.01745],
          [-0.01745, 0.08183, 0.01008],
          [-0.02015, 0.08245, -0.0],
          [-0.01745, 0.08308, -0.01008],
          [-0.01007, 0.0837, -0.01745],
          [-0.0, 0.08432, -0.02015],
          [0.01007, 0.08494, -0.01745],
          [0.01745, 0.08556, -0.01007],
          [0.02015, 0.08618, -0.0],
          [0.01745, 0.0868, 0.01007],
          [0.01008, 0.08742, 0.01745],
          [-0.0, 0.08805, 0.02015],
          [-0.01007, 0.08867, 0.01745],
          [-0.01745, 0.08929, 0.01008],
          [-0.02015, 0.08991, 0.0],
          [-0.01745, 0.09053, -0.01008],
          [-0.01007, 0.09115, -0.01745],
          [-0.0, 0.09177, -0.02015],
          [0.01007, 0.09239, -0.01745],
          [0.01745, 0.09302, -0.01007],
          [0.02015, 0.09364, -0.0],
          [0.01745, 0.09426, 0.01008],
          [0.01008, 0.09488, 0.01745],
          [0.0, 0.0955, 0.02015],
          [-0.01008, 0.09612, 0.01745],
          [-0.01745, 0.09674, 0.01008],
          [-0.02015, 0.09736, -0.0],
          [-0.01745, 0.09798, -0.01007],
          [-0.01008, 0.09861, -0.01745],
          [-0.0, 0.09923, -0.02015],
          [0.01007, 0.09985, -0.01745],
          [0.01757, 0.10047, -0.01015],
          [0.02048, 0.10109, -0.0],
          [0.0179, 0.10171, 0.01033],
          [0.01042, 0.10233, 0.01806],
          [0.0, 0.10295, 0.02104],
          [-0.01061, 0.10358, 0.01838],
          [-0.01854, 0.1042, 0.0107],
          [-0.0216, 0.10482, 0.0],
          [-0.01886, 0.10544, -0.01089],
          [-0.01098, 0.10606, -0.01903],
          [-0.0, 0.10668, -0.02215],
          [0.01117, 0.1073, -0.01935],
          [0.01951, 0.10792, -0.01126],
          [0.02271, 0.10855, -0.0],
          [0.01983, 0.10917, 0.01145],
          [0.01154, 0.10979, 0.01999],
          [0.0, 0.11041, 0.02327],
          [-0.01173, 0.11103, 0.02032],
          [-0.02048, 0.11165, 0.01182],
          [-0.02383, 0.11227, -0.0],
          [-0.0208, 0.11289, -0.01201],
          [-0.0121, 0.11352, -0.02096],
          [-0.0, 0.11414, -0.02439],
          [0.01229, 0.11476, -0.02128],
          [0.02145, 0.11538, -0.01238],
          [0.02495, 0.116, -0.0],
        ],
        radius: 0.0011,
        radialSegments: 6,
        closed: false,
      },
    },
    dimensions: {
      width: 0.0022,
      height: 0.082,
      depth: 0.0022,
      units: "meters",
      confidence: 0.6,
    },
    material: "gripWrap",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(222, 205, 176, 1.0)",
      secondaryAlbedo: "rgba(238, 224, 198, 1.0)",
      materialClass: "fabric",
      materialClassConfidence: 0.7,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "trim",
      pivot: {
        mode: "center",
        localPosition: [0, 0.075, 0],
        axis: [0, 1, 0],
        confidence: 0.6,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "capsule",
        offset: [0, 0.075, 0],
        scale: [0.042, 0.082, 0.042],
        isTrigger: false,
        notes: "Shares the grip proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "handle-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "gripWrap",
      parentSocket: "hand-center",
      localStart: [0.0, -0.036, 0.0],
      localEnd: [0.0, 0.046, 0.0],
      contactType: "overlap",
      overlap: 0.0009,
      gapTolerance: 0.0001,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Ridge sits on the wrap surface; rides with its parent when exploded.",
    },
    explodeWithParent: true,
  }
  node_gripWrapHelix_8.userData.actionProfile = {
    animationRole: "trim",
    pivot: {
      mode: "center",
      localPosition: [0, 0.075, 0],
      axis: [0, 1, 0],
      confidence: 0.6,
    },
    transformChannels: {
      translate: true,
      rotate: true,
      scale: false,
      bend: false,
      twist: false,
      detach: true,
      visibility: true,
      materialState: true,
    },
    sockets: [],
    collider: {
      type: "capsule",
      offset: [0, 0.075, 0],
      scale: [0.042, 0.082, 0.042],
      isTrigger: false,
      notes: "Shares the grip proxy.",
    },
    constraints: [],
    destruction: {
      breakable: false,
      fractureGroup: "handle-assembly",
      seamRefs: [],
      detachableFragments: [],
      breakImpulse: 0.0,
      debrisMaterial: "base",
    },
  }
  ;(nodes["gripWrap"] ?? root).add(node_gripWrapHelix_8)
  nodes["gripWrapHelix"] = node_gripWrapHelix_8
  const mesh_gripWrapHelix_8Geometry = endpoint_gripWrapHelix_8
    ? new THREE.CylinderGeometry(
        endpoint_gripWrapHelix_8.endRadius,
        endpoint_gripWrapHelix_8.baseRadius,
        endpoint_gripWrapHelix_8.length,
        16,
        6
      )
    : buildTubeGeometry({
        points: [
          [0.02015, 0.034, 0.0],
          [0.01745, 0.03462, 0.01007],
          [0.01007, 0.03524, 0.01745],
          [0.0, 0.03586, 0.02015],
          [-0.01008, 0.03648, 0.01745],
          [-0.01745, 0.03711, 0.01007],
          [-0.02015, 0.03773, 0.0],
          [-0.01745, 0.03835, -0.01008],
          [-0.01007, 0.03897, -0.01745],
          [-0.0, 0.03959, -0.02015],
          [0.01008, 0.04021, -0.01745],
          [0.01745, 0.04083, -0.01008],
          [0.02015, 0.04145, -0.0],
          [0.01745, 0.04208, 0.01007],
          [0.01007, 0.0427, 0.01745],
          [0.0, 0.04332, 0.02015],
          [-0.01008, 0.04394, 0.01745],
          [-0.01745, 0.04456, 0.01008],
          [-0.02015, 0.04518, 0.0],
          [-0.01745, 0.0458, -0.01008],
          [-0.01007, 0.04642, -0.01745],
          [-0.0, 0.04705, -0.02015],
          [0.01007, 0.04767, -0.01745],
          [0.01745, 0.04829, -0.01007],
          [0.02015, 0.04891, -0.0],
          [0.01745, 0.04953, 0.01008],
          [0.01008, 0.05015, 0.01745],
          [0.0, 0.05077, 0.02015],
          [-0.01008, 0.05139, 0.01745],
          [-0.01745, 0.05202, 0.01008],
          [-0.02015, 0.05264, 0.0],
          [-0.01745, 0.05326, -0.01007],
          [-0.01007, 0.05388, -0.01745],
          [-0.0, 0.0545, -0.02015],
          [0.01007, 0.05512, -0.01745],
          [0.01745, 0.05574, -0.01008],
          [0.02015, 0.05636, -0.0],
          [0.01745, 0.05698, 0.01007],
          [0.01007, 0.05761, 0.01745],
          [-0.0, 0.05823, 0.02015],
          [-0.01008, 0.05885, 0.01745],
          [-0.01745, 0.05947, 0.01008],
          [-0.02015, 0.06009, 0.0],
          [-0.01745, 0.06071, -0.01007],
          [-0.01008, 0.06133, -0.01745],
          [-0.0, 0.06195, -0.02015],
          [0.01008, 0.06258, -0.01745],
          [0.01745, 0.0632, -0.01008],
          [0.02015, 0.06382, -0.0],
          [0.01745, 0.06444, 0.01007],
          [0.01007, 0.06506, 0.01745],
          [-0.0, 0.06568, 0.02015],
          [-0.01007, 0.0663, 0.01745],
          [-0.01745, 0.06692, 0.01008],
          [-0.02015, 0.06755, 0.0],
          [-0.01745, 0.06817, -0.01008],
          [-0.01007, 0.06879, -0.01745],
          [-0.0, 0.06941, -0.02015],
          [0.01007, 0.07003, -0.01745],
          [0.01745, 0.07065, -0.01008],
          [0.02015, 0.07127, -0.0],
          [0.01745, 0.07189, 0.01007],
          [0.01008, 0.07252, 0.01745],
          [-0.0, 0.07314, 0.02015],
          [-0.01008, 0.07376, 0.01745],
          [-0.01745, 0.07438, 0.01008],
          [-0.02015, 0.075, 0.0],
          [-0.01745, 0.07562, -0.01007],
          [-0.01008, 0.07624, -0.01745],
          [-0.0, 0.07686, -0.02015],
          [0.01007, 0.07748, -0.01745],
          [0.01745, 0.07811, -0.01008],
          [0.02015, 0.07873, -0.0],
          [0.01745, 0.07935, 0.01007],
          [0.01008, 0.07997, 0.01745],
          [-0.0, 0.08059, 0.02015],
          [-0.01008, 0.08121, 0.01745],
          [-0.01745, 0.08183, 0.01008],
          [-0.02015, 0.08245, -0.0],
          [-0.01745, 0.08308, -0.01008],
          [-0.01007, 0.0837, -0.01745],
          [-0.0, 0.08432, -0.02015],
          [0.01007, 0.08494, -0.01745],
          [0.01745, 0.08556, -0.01007],
          [0.02015, 0.08618, -0.0],
          [0.01745, 0.0868, 0.01007],
          [0.01008, 0.08742, 0.01745],
          [-0.0, 0.08805, 0.02015],
          [-0.01007, 0.08867, 0.01745],
          [-0.01745, 0.08929, 0.01008],
          [-0.02015, 0.08991, 0.0],
          [-0.01745, 0.09053, -0.01008],
          [-0.01007, 0.09115, -0.01745],
          [-0.0, 0.09177, -0.02015],
          [0.01007, 0.09239, -0.01745],
          [0.01745, 0.09302, -0.01007],
          [0.02015, 0.09364, -0.0],
          [0.01745, 0.09426, 0.01008],
          [0.01008, 0.09488, 0.01745],
          [0.0, 0.0955, 0.02015],
          [-0.01008, 0.09612, 0.01745],
          [-0.01745, 0.09674, 0.01008],
          [-0.02015, 0.09736, -0.0],
          [-0.01745, 0.09798, -0.01007],
          [-0.01008, 0.09861, -0.01745],
          [-0.0, 0.09923, -0.02015],
          [0.01007, 0.09985, -0.01745],
          [0.01757, 0.10047, -0.01015],
          [0.02048, 0.10109, -0.0],
          [0.0179, 0.10171, 0.01033],
          [0.01042, 0.10233, 0.01806],
          [0.0, 0.10295, 0.02104],
          [-0.01061, 0.10358, 0.01838],
          [-0.01854, 0.1042, 0.0107],
          [-0.0216, 0.10482, 0.0],
          [-0.01886, 0.10544, -0.01089],
          [-0.01098, 0.10606, -0.01903],
          [-0.0, 0.10668, -0.02215],
          [0.01117, 0.1073, -0.01935],
          [0.01951, 0.10792, -0.01126],
          [0.02271, 0.10855, -0.0],
          [0.01983, 0.10917, 0.01145],
          [0.01154, 0.10979, 0.01999],
          [0.0, 0.11041, 0.02327],
          [-0.01173, 0.11103, 0.02032],
          [-0.02048, 0.11165, 0.01182],
          [-0.02383, 0.11227, -0.0],
          [-0.0208, 0.11289, -0.01201],
          [-0.0121, 0.11352, -0.02096],
          [-0.0, 0.11414, -0.02439],
          [0.01229, 0.11476, -0.02128],
          [0.02145, 0.11538, -0.01238],
          [0.02495, 0.116, -0.0],
        ],
        radius: 0.0011,
        radialSegments: 6,
        closed: false,
      })
  if (!endpoint_gripWrapHelix_8) {
    mesh_gripWrapHelix_8Geometry.scale(1.0, 1.0, 1.0)
  }
  const mesh_gripWrapHelix_8 = new THREE.Mesh(
    mesh_gripWrapHelix_8Geometry,
    materialMap["gripWrap"] ??
      new THREE.MeshStandardMaterial({ color: 0x888888 })
  )
  mesh_gripWrapHelix_8.name = "Overwrap ridge helix"
  if (endpoint_gripWrapHelix_8) {
    mesh_gripWrapHelix_8.position.copy(endpoint_gripWrapHelix_8.midpoint)
    mesh_gripWrapHelix_8.quaternion.copy(endpoint_gripWrapHelix_8.quaternion)
  }
  mesh_gripWrapHelix_8.castShadow = options.castShadow ?? true
  mesh_gripWrapHelix_8.receiveShadow = options.receiveShadow ?? true
  mesh_gripWrapHelix_8.userData.sculptComponent = {
    level: "micro",
    role: "trim",
    importance: 0.5,
    confidence: 0.7,
    materialLayers: ["gripWrap"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["gripWrap.helixRidge"],
    evidenceRefs: ["full-object"],
    transform: {
      position: [0.0, 0.0, 0.0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    surfaceDetail: {
      macroRoughness: 0.3,
      microRoughness: 0.22,
      bumpAmplitude: 0.0004,
      normalPattern: "same wrap grain as the host surface",
      displacementPattern: "none",
      occlusionPattern: "ridge-root cavity",
    },
    id: "gripWrapHelix",
    name: "Overwrap ridge helix",
    primitive: "tube",
    parent: "gripWrap",
    topologyClass: "surface-relief",
    topologyRationale:
      "A raised ridge riding on the wrap surface; relief on a host surface, not an independent volume.",
    geometryDescriptor: {
      topologyIntent: "swept ridge following the overwrap helix",
      edgeTreatment: { type: "fillet", bevelRadius: 0.0004, segments: 1 },
      deformationStack: [],
      uvStrategy: "tube-parametric",
      normalStrategy: "vertex normals from generated geometry",
      tubePath: {
        points: [
          [0.02015, 0.034, 0.0],
          [0.01745, 0.03462, 0.01007],
          [0.01007, 0.03524, 0.01745],
          [0.0, 0.03586, 0.02015],
          [-0.01008, 0.03648, 0.01745],
          [-0.01745, 0.03711, 0.01007],
          [-0.02015, 0.03773, 0.0],
          [-0.01745, 0.03835, -0.01008],
          [-0.01007, 0.03897, -0.01745],
          [-0.0, 0.03959, -0.02015],
          [0.01008, 0.04021, -0.01745],
          [0.01745, 0.04083, -0.01008],
          [0.02015, 0.04145, -0.0],
          [0.01745, 0.04208, 0.01007],
          [0.01007, 0.0427, 0.01745],
          [0.0, 0.04332, 0.02015],
          [-0.01008, 0.04394, 0.01745],
          [-0.01745, 0.04456, 0.01008],
          [-0.02015, 0.04518, 0.0],
          [-0.01745, 0.0458, -0.01008],
          [-0.01007, 0.04642, -0.01745],
          [-0.0, 0.04705, -0.02015],
          [0.01007, 0.04767, -0.01745],
          [0.01745, 0.04829, -0.01007],
          [0.02015, 0.04891, -0.0],
          [0.01745, 0.04953, 0.01008],
          [0.01008, 0.05015, 0.01745],
          [0.0, 0.05077, 0.02015],
          [-0.01008, 0.05139, 0.01745],
          [-0.01745, 0.05202, 0.01008],
          [-0.02015, 0.05264, 0.0],
          [-0.01745, 0.05326, -0.01007],
          [-0.01007, 0.05388, -0.01745],
          [-0.0, 0.0545, -0.02015],
          [0.01007, 0.05512, -0.01745],
          [0.01745, 0.05574, -0.01008],
          [0.02015, 0.05636, -0.0],
          [0.01745, 0.05698, 0.01007],
          [0.01007, 0.05761, 0.01745],
          [-0.0, 0.05823, 0.02015],
          [-0.01008, 0.05885, 0.01745],
          [-0.01745, 0.05947, 0.01008],
          [-0.02015, 0.06009, 0.0],
          [-0.01745, 0.06071, -0.01007],
          [-0.01008, 0.06133, -0.01745],
          [-0.0, 0.06195, -0.02015],
          [0.01008, 0.06258, -0.01745],
          [0.01745, 0.0632, -0.01008],
          [0.02015, 0.06382, -0.0],
          [0.01745, 0.06444, 0.01007],
          [0.01007, 0.06506, 0.01745],
          [-0.0, 0.06568, 0.02015],
          [-0.01007, 0.0663, 0.01745],
          [-0.01745, 0.06692, 0.01008],
          [-0.02015, 0.06755, 0.0],
          [-0.01745, 0.06817, -0.01008],
          [-0.01007, 0.06879, -0.01745],
          [-0.0, 0.06941, -0.02015],
          [0.01007, 0.07003, -0.01745],
          [0.01745, 0.07065, -0.01008],
          [0.02015, 0.07127, -0.0],
          [0.01745, 0.07189, 0.01007],
          [0.01008, 0.07252, 0.01745],
          [-0.0, 0.07314, 0.02015],
          [-0.01008, 0.07376, 0.01745],
          [-0.01745, 0.07438, 0.01008],
          [-0.02015, 0.075, 0.0],
          [-0.01745, 0.07562, -0.01007],
          [-0.01008, 0.07624, -0.01745],
          [-0.0, 0.07686, -0.02015],
          [0.01007, 0.07748, -0.01745],
          [0.01745, 0.07811, -0.01008],
          [0.02015, 0.07873, -0.0],
          [0.01745, 0.07935, 0.01007],
          [0.01008, 0.07997, 0.01745],
          [-0.0, 0.08059, 0.02015],
          [-0.01008, 0.08121, 0.01745],
          [-0.01745, 0.08183, 0.01008],
          [-0.02015, 0.08245, -0.0],
          [-0.01745, 0.08308, -0.01008],
          [-0.01007, 0.0837, -0.01745],
          [-0.0, 0.08432, -0.02015],
          [0.01007, 0.08494, -0.01745],
          [0.01745, 0.08556, -0.01007],
          [0.02015, 0.08618, -0.0],
          [0.01745, 0.0868, 0.01007],
          [0.01008, 0.08742, 0.01745],
          [-0.0, 0.08805, 0.02015],
          [-0.01007, 0.08867, 0.01745],
          [-0.01745, 0.08929, 0.01008],
          [-0.02015, 0.08991, 0.0],
          [-0.01745, 0.09053, -0.01008],
          [-0.01007, 0.09115, -0.01745],
          [-0.0, 0.09177, -0.02015],
          [0.01007, 0.09239, -0.01745],
          [0.01745, 0.09302, -0.01007],
          [0.02015, 0.09364, -0.0],
          [0.01745, 0.09426, 0.01008],
          [0.01008, 0.09488, 0.01745],
          [0.0, 0.0955, 0.02015],
          [-0.01008, 0.09612, 0.01745],
          [-0.01745, 0.09674, 0.01008],
          [-0.02015, 0.09736, -0.0],
          [-0.01745, 0.09798, -0.01007],
          [-0.01008, 0.09861, -0.01745],
          [-0.0, 0.09923, -0.02015],
          [0.01007, 0.09985, -0.01745],
          [0.01757, 0.10047, -0.01015],
          [0.02048, 0.10109, -0.0],
          [0.0179, 0.10171, 0.01033],
          [0.01042, 0.10233, 0.01806],
          [0.0, 0.10295, 0.02104],
          [-0.01061, 0.10358, 0.01838],
          [-0.01854, 0.1042, 0.0107],
          [-0.0216, 0.10482, 0.0],
          [-0.01886, 0.10544, -0.01089],
          [-0.01098, 0.10606, -0.01903],
          [-0.0, 0.10668, -0.02215],
          [0.01117, 0.1073, -0.01935],
          [0.01951, 0.10792, -0.01126],
          [0.02271, 0.10855, -0.0],
          [0.01983, 0.10917, 0.01145],
          [0.01154, 0.10979, 0.01999],
          [0.0, 0.11041, 0.02327],
          [-0.01173, 0.11103, 0.02032],
          [-0.02048, 0.11165, 0.01182],
          [-0.02383, 0.11227, -0.0],
          [-0.0208, 0.11289, -0.01201],
          [-0.0121, 0.11352, -0.02096],
          [-0.0, 0.11414, -0.02439],
          [0.01229, 0.11476, -0.02128],
          [0.02145, 0.11538, -0.01238],
          [0.02495, 0.116, -0.0],
        ],
        radius: 0.0011,
        radialSegments: 6,
        closed: false,
      },
    },
    dimensions: {
      width: 0.0022,
      height: 0.082,
      depth: 0.0022,
      units: "meters",
      confidence: 0.6,
    },
    material: "gripWrap",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(222, 205, 176, 1.0)",
      secondaryAlbedo: "rgba(238, 224, 198, 1.0)",
      materialClass: "fabric",
      materialClassConfidence: 0.7,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "trim",
      pivot: {
        mode: "center",
        localPosition: [0, 0.075, 0],
        axis: [0, 1, 0],
        confidence: 0.6,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "capsule",
        offset: [0, 0.075, 0],
        scale: [0.042, 0.082, 0.042],
        isTrigger: false,
        notes: "Shares the grip proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "handle-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "gripWrap",
      parentSocket: "hand-center",
      localStart: [0.0, -0.036, 0.0],
      localEnd: [0.0, 0.046, 0.0],
      contactType: "overlap",
      overlap: 0.0009,
      gapTolerance: 0.0001,
      contactNormal: [0, 1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Ridge sits on the wrap surface; rides with its parent when exploded.",
    },
    explodeWithParent: true,
  }
  node_gripWrapHelix_8.add(mesh_gripWrapHelix_8)
  meshes["gripWrapHelix"] = mesh_gripWrapHelix_8
  colliders["gripWrapHelix"] = {
    type: "capsule",
    offset: [0, 0.075, 0],
    scale: [0.042, 0.082, 0.042],
    isTrigger: false,
    notes: "Shares the grip proxy.",
  }
  destructionGroups["handle-assembly"] ??= []
  destructionGroups["handle-assembly"].push(node_gripWrapHelix_8)

  const attachment_buttCap_9 = {
    parentId: "handleCore",
    parentSocket: "butt-socket",
    localStart: [0.0, -0.0535, 0.0],
    localEnd: [0.0, -0.0235, 0.0],
    contactType: "socket",
    overlap: 0.006,
    gapTolerance: 0.0001,
    contactNormal: [0, -1, 0],
    evidenceRefs: ["full-object"],
    notes:
      "Seats over the shaft end; the flare is the measured 187 -> 217 px widening.",
  }
  // /* patched by tools/patch_paddle_factory.py */ authored geometryDescriptor form, not an attachment cylinder.
  void makeAttachmentEndpoint(attachment_buttCap_9)
  const endpoint_buttCap_9 = authoredGeometryEndpoint()
  const node_buttCap_9 = new THREE.Group()
  node_buttCap_9.name = "Butt cap__pivot"
  node_buttCap_9.scale.set(1, 1, 1)
  if (endpoint_buttCap_9) {
    node_buttCap_9.position.copy(endpoint_buttCap_9.start)
    node_buttCap_9.rotation.set(0.0, 0.0, 0.0)
  } else {
    node_buttCap_9.position.set(0.0, -0.028, 0.0)
    node_buttCap_9.rotation.set(0.0, 0.0, 0.0)
  }
  node_buttCap_9.userData.sculptComponent = {
    level: "macro",
    role: "hardware",
    importance: 0.6,
    confidence: 0.75,
    materialLayers: ["gripWrap"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["buttCap.flangeFlare"],
    evidenceRefs: ["full-object"],
    transform: {
      position: [0.0, -0.028, 0.0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    surfaceDetail: {
      macroRoughness: 0.2,
      microRoughness: 0.1,
      bumpAmplitude: 0.0,
      normalPattern: "none",
      displacementPattern: "none",
      occlusionPattern: "seam-cavity",
    },
    id: "buttCap",
    name: "Butt cap",
    primitive: "lathe",
    parent: "handleCore",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A separate moulded end piece with its own flared volume, seated on the shaft end rather than conforming to it.",
    geometryDescriptor: {
      topologyIntent: "revolved flared flange closing the shaft end",
      edgeTreatment: { type: "fillet", bevelRadius: 0.0012, segments: 2 },
      deformationStack: [],
      uvStrategy: "cylindrical",
      normalStrategy: "vertex normals from generated geometry",
      latheProfile: {
        points: [
          [0.0002, 0.0],
          [0.01076, 0.0002],
          [0.01687, 0.0014],
          [0.02008, 0.0035],
          [0.02153, 0.0066],
          [0.02267, 0.0108],
          [0.02236, 0.017],
          [0.02111, 0.0232],
          [0.02018, 0.0294],
          [0.0195, 0.03],
        ],
        segments: 32,
      },
    },
    dimensions: {
      width: 0.0453,
      height: 0.03,
      depth: 0.0453,
      units: "meters",
      confidence: 0.7,
    },
    material: "gripWrap",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(222, 206, 178, 1.0)",
      secondaryAlbedo: "rgba(196, 180, 152, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.6,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "hardware",
      pivot: {
        mode: "center",
        localPosition: [0, 0.015, 0],
        axis: [0, 1, 0],
        confidence: 0.7,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "cylinder",
        offset: [0, 0.015, 0],
        scale: [0.0453, 0.03, 0.0453],
        isTrigger: false,
        notes: "Butt flange proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "handle-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "handleCore",
      parentSocket: "butt-socket",
      localStart: [0.0, -0.0535, 0.0],
      localEnd: [0.0, -0.0235, 0.0],
      contactType: "socket",
      overlap: 0.006,
      gapTolerance: 0.0001,
      contactNormal: [0, -1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Seats over the shaft end; the flare is the measured 187 -> 217 px widening.",
    },
  }
  node_buttCap_9.userData.actionProfile = {
    animationRole: "hardware",
    pivot: {
      mode: "center",
      localPosition: [0, 0.015, 0],
      axis: [0, 1, 0],
      confidence: 0.7,
    },
    transformChannels: {
      translate: true,
      rotate: true,
      scale: false,
      bend: false,
      twist: false,
      detach: true,
      visibility: true,
      materialState: true,
    },
    sockets: [],
    collider: {
      type: "cylinder",
      offset: [0, 0.015, 0],
      scale: [0.0453, 0.03, 0.0453],
      isTrigger: false,
      notes: "Butt flange proxy.",
    },
    constraints: [],
    destruction: {
      breakable: false,
      fractureGroup: "handle-assembly",
      seamRefs: [],
      detachableFragments: [],
      breakImpulse: 0.0,
      debrisMaterial: "base",
    },
  }
  ;(nodes["handleCore"] ?? root).add(node_buttCap_9)
  nodes["buttCap"] = node_buttCap_9
  const mesh_buttCap_9Geometry = endpoint_buttCap_9
    ? new THREE.CylinderGeometry(
        endpoint_buttCap_9.endRadius,
        endpoint_buttCap_9.baseRadius,
        endpoint_buttCap_9.length,
        16,
        6
      )
    : buildLatheGeometry({
        points: [
          [0.0002, 0.0],
          [0.01076, 0.0002],
          [0.01687, 0.0014],
          [0.02008, 0.0035],
          [0.02153, 0.0066],
          [0.02267, 0.0108],
          [0.02236, 0.017],
          [0.02111, 0.0232],
          [0.02018, 0.0294],
          [0.0195, 0.03],
        ],
        segments: 32,
      })
  if (!endpoint_buttCap_9) {
    mesh_buttCap_9Geometry.scale(1.0, 1.0, 1.0)
  }
  const mesh_buttCap_9 = new THREE.Mesh(
    mesh_buttCap_9Geometry,
    materialMap["gripWrap"] ??
      new THREE.MeshStandardMaterial({ color: 0x888888 })
  )
  mesh_buttCap_9.name = "Butt cap"
  if (endpoint_buttCap_9) {
    mesh_buttCap_9.position.copy(endpoint_buttCap_9.midpoint)
    mesh_buttCap_9.quaternion.copy(endpoint_buttCap_9.quaternion)
  }
  mesh_buttCap_9.castShadow = options.castShadow ?? true
  mesh_buttCap_9.receiveShadow = options.receiveShadow ?? true
  mesh_buttCap_9.userData.sculptComponent = {
    level: "macro",
    role: "hardware",
    importance: 0.6,
    confidence: 0.75,
    materialLayers: ["gripWrap"],
    deformations: [],
    joints: [],
    seams: [],
    localFeatures: ["buttCap.flangeFlare"],
    evidenceRefs: ["full-object"],
    transform: {
      position: [0.0, -0.028, 0.0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    surfaceDetail: {
      macroRoughness: 0.2,
      microRoughness: 0.1,
      bumpAmplitude: 0.0,
      normalPattern: "none",
      displacementPattern: "none",
      occlusionPattern: "seam-cavity",
    },
    id: "buttCap",
    name: "Butt cap",
    primitive: "lathe",
    parent: "handleCore",
    topologyClass: "assembled-solid",
    topologyRationale:
      "A separate moulded end piece with its own flared volume, seated on the shaft end rather than conforming to it.",
    geometryDescriptor: {
      topologyIntent: "revolved flared flange closing the shaft end",
      edgeTreatment: { type: "fillet", bevelRadius: 0.0012, segments: 2 },
      deformationStack: [],
      uvStrategy: "cylindrical",
      normalStrategy: "vertex normals from generated geometry",
      latheProfile: {
        points: [
          [0.0002, 0.0],
          [0.01076, 0.0002],
          [0.01687, 0.0014],
          [0.02008, 0.0035],
          [0.02153, 0.0066],
          [0.02267, 0.0108],
          [0.02236, 0.017],
          [0.02111, 0.0232],
          [0.02018, 0.0294],
          [0.0195, 0.03],
        ],
        segments: 32,
      },
    },
    dimensions: {
      width: 0.0453,
      height: 0.03,
      depth: 0.0453,
      units: "meters",
      confidence: 0.7,
    },
    material: "gripWrap",
    colorMaterialRecipe: {
      dominantAlbedo: "rgba(222, 206, 178, 1.0)",
      secondaryAlbedo: "rgba(196, 180, 152, 1.0)",
      materialClass: "plastic",
      materialClassConfidence: 0.6,
      evidenceRefs: ["full-object"],
    },
    actionProfile: {
      animationRole: "hardware",
      pivot: {
        mode: "center",
        localPosition: [0, 0.015, 0],
        axis: [0, 1, 0],
        confidence: 0.7,
      },
      transformChannels: {
        translate: true,
        rotate: true,
        scale: false,
        bend: false,
        twist: false,
        detach: true,
        visibility: true,
        materialState: true,
      },
      sockets: [],
      collider: {
        type: "cylinder",
        offset: [0, 0.015, 0],
        scale: [0.0453, 0.03, 0.0453],
        isTrigger: false,
        notes: "Butt flange proxy.",
      },
      constraints: [],
      destruction: {
        breakable: false,
        fractureGroup: "handle-assembly",
        seamRefs: [],
        detachableFragments: [],
        breakImpulse: 0.0,
        debrisMaterial: "base",
      },
    },
    attachment: {
      parentId: "handleCore",
      parentSocket: "butt-socket",
      localStart: [0.0, -0.0535, 0.0],
      localEnd: [0.0, -0.0235, 0.0],
      contactType: "socket",
      overlap: 0.006,
      gapTolerance: 0.0001,
      contactNormal: [0, -1, 0],
      evidenceRefs: ["full-object"],
      notes:
        "Seats over the shaft end; the flare is the measured 187 -> 217 px widening.",
    },
  }
  node_buttCap_9.add(mesh_buttCap_9)
  meshes["buttCap"] = mesh_buttCap_9
  colliders["buttCap"] = {
    type: "cylinder",
    offset: [0, 0.015, 0],
    scale: [0.0453, 0.03, 0.0453],
    isTrigger: false,
    notes: "Butt flange proxy.",
  }
  destructionGroups["handle-assembly"] ??= []
  destructionGroups["handle-assembly"].push(node_buttCap_9)

  root.userData.sculptRuntime = {
    nodes,
    meshes,
    sockets,
    colliders,
    destructionGroups,
  } satisfies ProceduralModelRuntime
  root.userData.lookDevTargets = {
    qualityPriority: "reference-fidelity",
    materialPass: {
      albedoPaletteRequired: true,
      roughnessVariationRequired: true,
      normalOrBumpRequired: true,
      localOverridesRequired: true,
      minimumTextureResolution: 1024,
      preferredTextureResolution: 2048,
      independentMapChannels: [
        "albedo",
        "roughness",
        "height",
        "normal",
        "ambient-occlusion",
      ],
      requiredSurfaceFrequencyBands: ["macro", "meso", "micro"],
      geometryReliefRequiredWhenSilhouetteAffected: true,
      referencePbrExtraction: {
        requiredWhenSourceImagePresent: true,
        targetThreshold: 0.7,
        stopOnLowConfidence: true,
        script: "forge/stage1_intake/extract_pbr_evidence.py",
        acceptedLimitation:
          "single-image extraction is reference-derived inference, not exact photogrammetry",
      },
      mustAvoid: [
        "single flat albedo per material",
        "uniform roughness",
        "albedo texture reused as roughness/height/normal/AO",
        "single-frequency random noise",
        "plastic-looking smooth bark, stone, cloth, foliage, or aged material",
        "local color/detail described only in prose without material masks",
        "claiming exact PBR recovery when confidence is below the target threshold",
      ],
    },
    lightingPass: {
      requiredTerms: [
        "key light",
        "fill light",
        "rim or environment light",
        "exposure",
        "tone mapping",
        "background",
        "contact shadow",
      ],
      mustAvoid: [
        "ambient-only lighting",
        "flat value range",
        "missing contact shadow",
        "reference lighting copied without separating material readability",
      ],
    },
    screenshotReview: [
      "Compare albedo palette and local color zones.",
      "Compare roughness/normal/bump response under light.",
      "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.",
      "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.",
      "Capture a neutral-light render to verify material readability without reference lighting.",
      "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.",
      "Capture a reference-matched render from the same camera framing as the source.",
    ],
  }
  root.userData.actionReadiness = {
    note: "Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.",
  }
  return root
}

export function createPaddlePowerPickleballPaddleLookDevLights(
  mode: "neutral" | "grazing" | "reference" = "neutral"
): THREE.Group {
  const lights = new THREE.Group()
  lights.name = "Paddle Power Pickleball Paddle look-dev lights"
  const hemi = new THREE.HemisphereLight(
    mode === "reference" ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === "grazing" ? 0.28 : mode === "reference" ? 0.72 : 0.85
  )
  lights.add(hemi)
  const key = new THREE.DirectionalLight(
    mode === "reference" ? 0xffcf8a : 0xfff4e8,
    mode === "grazing" ? 4.2 : mode === "reference" ? 2.6 : 2.15
  )
  if (mode === "grazing") key.position.set(7.5, 1.1, 4.0)
  else if (mode === "reference") key.position.set(-4.5, 7.5, 5.0)
  else key.position.set(-4.0, 6.0, 5.5)
  key.castShadow = true
  key.shadow.mapSize.set(4096, 4096)
  key.shadow.bias = -0.00025
  key.shadow.normalBias = 0.018
  key.shadow.radius = 7
  key.shadow.blurSamples = 24
  key.shadow.camera.near = 0.5
  key.shadow.camera.far = 30
  key.shadow.camera.left = -2.6
  key.shadow.camera.right = 2.6
  key.shadow.camera.top = 2.6
  key.shadow.camera.bottom = -2.6
  key.shadow.camera.updateProjectionMatrix()
  lights.add(key)
  const fill = new THREE.DirectionalLight(
    0xa8c4ff,
    mode === "grazing" ? 0.12 : 0.42
  )
  fill.position.set(4.0, 3.0, 3.5)
  lights.add(fill)
  const rim = new THREE.DirectionalLight(
    0xfff1c4,
    mode === "grazing" ? 0.28 : 0.85
  )
  rim.position.set(0.5, 4.5, -6.0)
  lights.add(rim)
  lights.userData.reviewMode = mode
  lights.userData.lightingFromPhoto = [
    "key: soft large source from the upper right; measured as a 10-level edge-guard value difference left vs right, and as the only directional cue in an otherwise flat frame",
    "fill: broad and near-frontal — the face plate shows no falloff top to bottom",
    "rim: none visible; the silhouette separates on background value, not on a rim highlight",
    "background: pure white studio sweep, no cast shadow in frame",
    "review renders must ALSO be captured under neutral light so material readability is judged independently of this reference lighting",
    "exposure and tone mapping: ACES filmic at exposure 1.0 — the reference is a white-sweep product shot with no clipped highlight, so the render must not blow out the cream grip",
    "contact shadow: a soft ground shadow under the butt cap when the paddle is staged upright; the reference frame has none, so it is a staging choice, and ambient occlusion carries the part-to-part darkening instead",
  ]
  lights.userData.lookDevTargets = {
    qualityPriority: "reference-fidelity",
    materialPass: {
      albedoPaletteRequired: true,
      roughnessVariationRequired: true,
      normalOrBumpRequired: true,
      localOverridesRequired: true,
      minimumTextureResolution: 1024,
      preferredTextureResolution: 2048,
      independentMapChannels: [
        "albedo",
        "roughness",
        "height",
        "normal",
        "ambient-occlusion",
      ],
      requiredSurfaceFrequencyBands: ["macro", "meso", "micro"],
      geometryReliefRequiredWhenSilhouetteAffected: true,
      referencePbrExtraction: {
        requiredWhenSourceImagePresent: true,
        targetThreshold: 0.7,
        stopOnLowConfidence: true,
        script: "forge/stage1_intake/extract_pbr_evidence.py",
        acceptedLimitation:
          "single-image extraction is reference-derived inference, not exact photogrammetry",
      },
      mustAvoid: [
        "single flat albedo per material",
        "uniform roughness",
        "albedo texture reused as roughness/height/normal/AO",
        "single-frequency random noise",
        "plastic-looking smooth bark, stone, cloth, foliage, or aged material",
        "local color/detail described only in prose without material masks",
        "claiming exact PBR recovery when confidence is below the target threshold",
      ],
    },
    lightingPass: {
      requiredTerms: [
        "key light",
        "fill light",
        "rim or environment light",
        "exposure",
        "tone mapping",
        "background",
        "contact shadow",
      ],
      mustAvoid: [
        "ambient-only lighting",
        "flat value range",
        "missing contact shadow",
        "reference lighting copied without separating material readability",
      ],
    },
    screenshotReview: [
      "Compare albedo palette and local color zones.",
      "Compare roughness/normal/bump response under light.",
      "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.",
      "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.",
      "Capture a neutral-light render to verify material readability without reference lighting.",
      "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.",
      "Capture a reference-matched render from the same camera framing as the source.",
    ],
  }
  return lights
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createPaddlePowerPickleballPaddleEnvironment(
  renderer: THREE.WebGLRenderer
): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  return texture
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function framePaddlePowerPickleballPaddleCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {}
): void {
  const box = new THREE.Box3().setFromObject(object)
  if (box.isEmpty()) return
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const margin = options.margin ?? 1.15
  const maxDim = Math.max(size.x, size.y, size.z) * margin
  const fov = (camera.fov * Math.PI) / 180
  // distance so the largest object dimension fits vertically in the frame
  const distance = maxDim / 2 / Math.tan(fov / 2)
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el)
  )
  camera.position.copy(center).addScaledVector(dir, distance)
  camera.near = Math.max(0.01, distance - maxDim)
  camera.far = distance + maxDim * 2
  camera.lookAt(center)
  camera.updateProjectionMatrix()
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createPaddlePowerPickleballPaddlePresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: {
    dof?: boolean
    bloom?: boolean
    bloomStrength?: number
    dofFocus?: number
    dofAperture?: number
  } = {}
): EffectComposer {
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  if (options.dof) {
    composer.addPass(
      new BokehPass(scene, camera, {
        focus: options.dofFocus ?? 10.0,
        aperture: options.dofAperture ?? 0.0002,
        maxblur: 0.01,
      })
    )
  }
  if (options.bloom) {
    const size = new THREE.Vector2()
    renderer.getSize(size)
    composer.addPass(
      new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85)
    )
  }
  return composer
}

export function configurePaddlePowerPickleballPaddleRenderer(
  renderer: THREE.WebGLRenderer
): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
}

export function createPaddlePowerPickleballPaddleInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.minDistance = 1.0
  controls.maxDistance = 8.0
  controls.autoRotate = false
  return controls
}
