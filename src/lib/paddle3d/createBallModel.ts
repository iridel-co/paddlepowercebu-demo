import * as THREE from "three"

import { runSliced } from "./cooperative"

import type {
  ProceduralModelOptions,
  ProceduralModelRuntime,
} from "./createPaddleModel"
import { shallowCopyNode } from "./instancing"

/**
 * Procedural indoor pickleball, reconstructed from `public/images/pickleball-ball.png`.
 *
 * Measured off the reference (673 px frame, ball radius 264 px): the visible holes are
 * 47 px in radius, a hole:ball radius ratio of 0.178. That is a regulation indoor ball —
 * 74 mm diameter, 26 holes of ~13 mm — so the hole set here is the canonical 26-direction
 * cube family (6 face + 12 edge + 8 corner), not an arbitrary distribution.
 *
 * Authored in metres with the origin at the ball centre, matching the paddle factory's units
 * (`createPaddleModel.ts`, 0.42 m tall) so the two can share one scene at true relative scale.
 *
 * Approximations, stated rather than hidden:
 * - The reference shows one hemisphere. The rear hole layout is the symmetric completion of
 *   the cube family, which is what a real ball uses, but it is not observed evidence.
 * - The perforations are alpha-cut on the shell rather than boolean-subtracted, with a bore
 *   wall and a rim torus modelled per hole. The silhouette through a hole is therefore exact;
 *   the cut edge is texture-resolution limited (1024x512 equirect, ~0.35 deg/texel) and is
 *   covered by the rim torus at every hole.
 * - The bore interiors read greener than the body in the reference (rgb 102,176,44 vs
 *   155,192,52). That is thin-wall translucency; it is carried here as a separate measured
 *   bore albedo rather than by a transmission solve.
 */

/** Regulation indoor ball: 74 mm diameter. */
export const BALL_RADIUS = 0.037
/** Wall thickness, from the visible bore depth at the reference's rim holes. */
export const BALL_SHELL_THICKNESS = 0.0016
/** 13.2 mm hole diameter — the measured 0.178 of the ball radius. */
export const BALL_HOLE_RADIUS = BALL_RADIUS * 0.178

const HOLE_ANGLE = Math.asin(BALL_HOLE_RADIUS / BALL_RADIUS)

/** Measured medians off the reference, per region. */
const BODY_ALBEDO = "#86b21f"
const BORE_ALBEDO = "#66b02c"
const CAVITY_ALBEDO = "#5c9c26"

/**
 * The 26 hole axes of a regulation indoor ball: the cube's 6 face, 12 edge and 8 corner
 * directions. Deterministic and symmetric — no seeded scatter, because a moulded ball's
 * pattern is not random.
 */
function holeDirections(): THREE.Vector3[] {
  const directions: THREE.Vector3[] = []
  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      for (const z of [-1, 0, 1]) {
        if (x === 0 && y === 0 && z === 0) continue
        directions.push(new THREE.Vector3(x, y, z).normalize())
      }
    }
  }
  return directions
}

/**
 * Equirectangular alpha mask with one circular cut per hole axis.
 *
 * Built as a `DataTexture` rather than a canvas so the factory also runs where there is no
 * DOM. The direction reconstruction below mirrors `THREE.SphereGeometry`'s own vertex/UV
 * mapping exactly — get it wrong and the cuts land off-axis from the bore walls.
 */
function createPerforationAlphaMap(
  directions: THREE.Vector3[],
  registerWork: (work: Promise<void>) => void
): THREE.Texture {
  const width = 1024
  const height = 512
  const data = new Uint8Array(width * height * 4)
  // One-texel feather so `alphaTest` lands the edge on the true circle instead of
  // quantising it to the texel grid.
  const feather = (Math.PI / height) * 1.5
  const axes = directions.map((d) => [d.x, d.y, d.z] as const)

  /* 26 axis tests plus an acos per texel over half a million texels — the
     single most expensive line item in the ball build, and it used to run
     inline. The loop body is unchanged; `runSliced` spreads the rows across
     the task queue and the texture re-uploads once the mask is complete.
     Until then the data is all zeros — fully cut away by `alphaTest` — which
     is why callers gate visibility on the registered promise. */
  const fillRow = (y: number) => {
    // SphereGeometry uvs are (u, 1 - v), and theta runs from the +Y pole.
    const theta = ((y + 0.5) / height) * Math.PI
    const sinTheta = Math.sin(theta)
    const dy = Math.cos(theta)
    for (let x = 0; x < width; x += 1) {
      const phi = ((x + 0.5) / width) * Math.PI * 2
      const dx = -Math.cos(phi) * sinTheta
      const dz = Math.sin(phi) * sinTheta
      let maxDot = -1
      for (let i = 0; i < axes.length; i += 1) {
        const axis = axes[i]
        const dot = dx * axis[0] + dy * axis[1] + dz * axis[2]
        if (dot > maxDot) maxDot = dot
      }
      const angle = Math.acos(Math.min(1, Math.max(-1, maxDot)))
      const alpha = Math.min(
        1,
        Math.max(0, (angle - HOLE_ANGLE) / feather + 0.5)
      )
      const value = Math.round(alpha * 255)
      const offset = (y * width + x) * 4
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
      data[offset + 3] = 255
    }
  }

  const texture = new THREE.DataTexture(data, width, height)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true
  registerWork(
    runSliced(height, fillRow).then(() => {
      texture.needsUpdate = true
    })
  )
  return texture
}

function hash2(x: number, y: number, seed: number): number {
  let value =
    Math.imul(x + seed * 17, 374761393) ^ Math.imul(y + seed * 31, 668265263)
  value = Math.imul(value ^ (value >>> 13), 1274126177)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

/**
 * Fine moulded-plastic grain. Tiny on purpose: the reference is a smooth injection-moulded
 * surface whose only micro detail is a slight breakup of the specular highlight.
 */
function createGrainBumpMap(): THREE.Texture {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const coarse = hash2(x >> 2, y >> 2, 7)
      const fine = hash2(x, y, 91)
      const value = Math.round((coarse * 0.55 + fine * 0.45) * 255)
      const offset = (y * size + x) * 4
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
      data[offset + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(6, 3)
  texture.needsUpdate = true
  return texture
}

/**
 * Builds the ball.
 *
 * Structure (every part named, so the model is explodable and click-pickable):
 *   Pickleball
 *     └ shellOuter · shellInner
 *     └ Perforations
 *         └ bore.00 … bore.25 · rim.00 … rim.25
 */
export type PickleballOptions = ProceduralModelOptions & {
  /** True cuts the holes clean through the ball; false (default) closes them as cavities. */
  hollow?: boolean
}

export function createPickleballModel(
  options: PickleballOptions = {}
): THREE.Group {
  const hollow = options.hollow ?? false
  const root = new THREE.Group()
  root.name = "Pickleball"

  const directions = holeDirections()
  /* Same contract as the paddle: sliced texture work registers here and the
     aggregate rides on shared `userData`, so scenes and viewers can hold the
     ball invisible until the perforation mask is real (a maskless ball with
     `alphaTest` renders as no ball at all). */
  const textureWork: Promise<void>[] = []
  const alphaMap = createPerforationAlphaMap(directions, (work) =>
    textureWork.push(work)
  )
  const bumpMap = createGrainBumpMap()

  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(BODY_ALBEDO),
    roughness: 0.5,
    metalness: 0,
    // Kept low deliberately: the reference's highlight stays a saturated green (its brightest
    // decile is rgb 207,250,77), so a broad white clearcoat/env specular is wrong — it drove
    // the render's blue channel to 97 against the reference's 52.
    clearcoat: 0.08,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.18,
    alphaMap,
    alphaTest: 0.5,
    bumpMap,
    bumpScale: 0.00004,
    wireframe: options.wireframe ?? false,
  })

  // The cavity floor seen through each hole.
  //
  // The 26 cube-family axes are antipodal — every hole has an exact opposite of the same
  // angular radius — so an inner shell cut by the same mask makes every hole see straight
  // through to the background, which is not what the reference shows. `hollow` therefore
  // defaults false: the inner shell is solid, and a hole reads as a bore ring plus a floor
  // 1.6 mm down, matching the reference's holes. Set `hollow: true` for a wiffle-ball
  // silhouette you can see through.
  const innerMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hollow ? BORE_ALBEDO : CAVITY_ALBEDO),
    roughness: 0.85,
    metalness: 0,
    envMapIntensity: hollow ? 0.35 : 0.25,
    side: hollow ? THREE.BackSide : THREE.FrontSide,
    alphaMap: hollow ? alphaMap : null,
    alphaTest: hollow ? 0.5 : 0,
    wireframe: options.wireframe ?? false,
  })

  const boreMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(BORE_ALBEDO),
    roughness: 0.78,
    metalness: 0,
    envMapIntensity: 0.4,
    side: THREE.DoubleSide,
    wireframe: options.wireframe ?? false,
  })

  // Same response as the shell but uncut — the rim rounds the alpha edge, so it must not
  // carry the alpha map that produced that edge.
  const rimMaterial = shellMaterial.clone()
  rimMaterial.alphaMap = null
  rimMaterial.alphaTest = 0

  const castShadow = options.castShadow ?? true
  const receiveShadow = options.receiveShadow ?? true

  const shellOuter = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 128, 64),
    shellMaterial
  )
  shellOuter.name = "shellOuter"
  shellOuter.castShadow = castShadow
  shellOuter.receiveShadow = receiveShadow
  root.add(shellOuter)

  const shellInner = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS - BALL_SHELL_THICKNESS, 96, 48),
    innerMaterial
  )
  shellInner.name = "shellInner"
  shellInner.receiveShadow = receiveShadow
  root.add(shellInner)

  const perforations = new THREE.Group()
  perforations.name = "Perforations"
  root.add(perforations)

  // One bore + rim geometry, reused across all 26 holes — only the transform differs.
  const boreGeometry = new THREE.CylinderGeometry(
    BALL_HOLE_RADIUS,
    BALL_HOLE_RADIUS,
    BALL_SHELL_THICKNESS * 1.6,
    32,
    1,
    true
  )

  const up = new THREE.Vector3(0, 1, 0)
  const forward = new THREE.Vector3(0, 0, 1)
  // The shell surface at a hole's rim sits at R*cos(a) along that hole's axis, not at R —
  // place the bore and rim against that, or both stand proud of the ball.
  const rimDepth = BALL_RADIUS * Math.cos(HOLE_ANGLE)
  const boreLength = BALL_SHELL_THICKNESS * 1.6
  const rimTube = BALL_SHELL_THICKNESS * 0.3
  // Sunk almost entirely below the surface: it rounds the moulded lip and hides the alpha
  // cut's texel edge without breaking the silhouette. A proud, coarsely tessellated torus
  // put visible flat tabs on the ball's outline at every near-limb hole.
  const rimGeometry = new THREE.TorusGeometry(
    BALL_RADIUS * Math.sin(HOLE_ANGLE),
    rimTube,
    12,
    48
  )
  const meshes: Record<string, THREE.Mesh> = {
    shellOuter,
    shellInner,
  }
  const sockets: Record<string, THREE.Object3D> = {}

  directions.forEach((direction, index) => {
    const id = String(index).padStart(2, "0")

    const bore = new THREE.Mesh(boreGeometry, boreMaterial)
    bore.name = `bore.${id}`
    bore.quaternion.setFromUnitVectors(up, direction)
    bore.position.copy(direction).multiplyScalar(rimDepth - boreLength * 0.5)
    // Relief that belongs to the shell: an explode must not scatter the bores away
    // from the holes they line.
    bore.userData.explodeWithParent = true
    perforations.add(bore)
    meshes[bore.name] = bore

    const rim = new THREE.Mesh(rimGeometry, rimMaterial)
    rim.name = `rim.${id}`
    rim.quaternion.setFromUnitVectors(forward, direction)
    rim.position.copy(direction).multiplyScalar(rimDepth - rimTube * 0.85)
    rim.castShadow = castShadow
    rim.userData.explodeWithParent = true
    perforations.add(rim)
    meshes[rim.name] = rim

    // Contact/spawn anchors: a hole axis is the only meaningful surface frame on a sphere.
    const socket = new THREE.Object3D()
    socket.name = `holeAxis.${id}`
    socket.position.copy(direction).multiplyScalar(BALL_RADIUS)
    socket.quaternion.setFromUnitVectors(up, direction)
    root.add(socket)
    sockets[socket.name] = socket
  })

  const runtime: ProceduralModelRuntime = {
    nodes: { root, perforations },
    meshes,
    sockets,
    colliders: {
      body: { type: "sphere", radius: BALL_RADIUS, center: [0, 0, 0] },
    },
    destructionGroups: {
      shell: [shellOuter, shellInner],
      holes: [perforations],
    },
  }
  root.userData.sculptRuntime = runtime
  root.userData.reconstructionEvidence = {
    reference: "public/images/pickleball-ball.png",
    measuredHoleRatio: 0.178,
    holeCount: directions.length,
    holeLayout: "cube-family 6 face + 12 edge + 8 corner (regulation indoor)",
    approximationNotes: [
      "Rear hemisphere hole layout is the symmetric completion of the visible set, not observed.",
      "Perforations are alpha-cut with modelled bore walls and rim tori, not boolean subtraction.",
      "Bore albedo carries the reference's thin-wall translucency as a measured colour, not transmission.",
    ],
  }

  root.userData.texturesComplete = Promise.all(textureWork).then(() => {})
  return root
}

/**
 * Build the default ball once, then hand every caller a lightweight copy.
 *
 * The factory above is not cheap: it rasterises a 1024x512 perforation mask
 * texel by texel (26 axis tests per texel), a 256x256 grain map, a 128x64
 * sphere, and 54 bore/rim meshes. The page stands up two ball viewers — the
 * one riding the Coming Soon list and the one crossing the net in Locations —
 * and each paid that in full, along with a second upload of both generated
 * textures.
 *
 * Only the default build is cached, since that is the only one the site
 * renders. Anything asking for non-default options (the `/ball-3d` review page
 * turning on `wireframe` or `hollow`, say) gets its own model and owns it
 * outright — `disposePickleballModel` is still the right teardown there.
 */
let ballPrototype: THREE.Group | null = null

export function instantiatePickleballModel(
  options: PickleballOptions = {}
): THREE.Group {
  if (Object.keys(options).length > 0) return createPickleballModel(options)
  ballPrototype ??= createPickleballModel()
  return shallowCopyNode(ballPrototype) as THREE.Group
}

/**
 * Frees the geometries, materials and generated textures this factory owns.
 *
 * Only ever call this on a model from `createPickleballModel` — a copy from
 * `instantiatePickleballModel` shares all of them with the cached prototype,
 * so tearing one down would strip the GPU resources from every other ball on
 * the page. Use `disposeInstance` for those.
 */
export function disposePickleballModel(root: THREE.Group): void {
  const disposed = new Set<unknown>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    if (!disposed.has(object.geometry)) {
      disposed.add(object.geometry)
      object.geometry.dispose()
    }
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]
    for (const material of materials) {
      if (disposed.has(material)) continue
      disposed.add(material)
      if (material instanceof THREE.MeshPhysicalMaterial) {
        material.alphaMap?.dispose()
        material.bumpMap?.dispose()
      }
      material.dispose()
    }
  })
}
