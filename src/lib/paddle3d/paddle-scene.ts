import * as THREE from "three"

import { instantiatePickleballModel } from "./createBallModel"
import { createPaddlePowerPickleballPaddleModel } from "./createPaddleModel"
import { disposeInstance, shallowCopyNode } from "./instancing"

/**
 * Shared scene setup for the procedural Paddle Power paddle.
 *
 * The model is authored in metres with the origin at the butt-cap bottom, so it stands in
 * +Y from 0 to 0.42 and is bilaterally symmetric about X. `frameHeight` below matches the
 * reference photo's framing (the subject fills 99% of a square frame), which is what makes a
 * render directly comparable to `public/images/paddlepower-paddle.jpeg`.
 */

export const PADDLE_LENGTH = 0.42
export const PADDLE_CENTER_Y = PADDLE_LENGTH / 2

export type PaddleSceneOptions = {
  /** Review renders use the white studio sweep; the site viewer uses null for transparent. */
  background?: THREE.ColorRepresentation | null
  /** 'reference' matches the photo's key/fill; 'neutral' judges material readability alone. */
  lighting?: "neutral" | "reference"
  /** Vertical world height the camera frames. Defaults to the reference framing. */
  frameHeight?: number
  /** Also stage the procedural pickleball beside the paddle face. */
  ball?: boolean
  /**
   * Fires once every albedo map has landed and the measured response is on the
   * materials — i.e. the first frame that is worth showing. Also fires if the
   * maps give up arriving, so a caller gating visibility on it can't hang.
   */
  onReady?: () => void
}

export type PaddleScene = {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  model: THREE.Group
  /** Present only when `ball` was requested. */
  ball: THREE.Group | null
  /** Orbit the model about its long axis, in degrees. 0 is the reference front view. */
  setAzimuth: (degrees: number) => void
  resize: (width: number, height: number) => void
  dispose: () => void
}

/**
 * Lighting from the reference photo, per `lightingFromPhoto` in the sculpt spec.
 *
 * The generated factory ships `createPaddlePowerPickleballPaddleLookDevLights`, but its
 * 'reference' preset is a warm tungsten key (0xffcf8a over a 0xfff0d6 hemisphere) tuned for a
 * scene an order of magnitude larger. This reference is a neutral white studio sweep, and that
 * warm preset pushed the measured slate face (rgb 59,71,71) visibly olive. These lights carry
 * the measurement instead: a neutral key from the upper right — the only directional cue in the
 * photo, seen as a ~10-level edge-guard value difference left vs right — over a broad frontal
 * fill, with no rim (the reference separates on background value, not on a rim highlight).
 */
function createReferenceLights(mode: "reference" | "neutral"): THREE.Group {
  const lights = new THREE.Group()
  lights.name = "Paddle reference lighting"

  lights.add(
    new THREE.HemisphereLight(
      0xf4f6f8,
      0x4a5055,
      mode === "neutral" ? 1.5 : 0.12
    )
  )

  const key = new THREE.DirectionalLight(
    0xfffaf2,
    mode === "neutral" ? 0.9 : 0.55
  )
  key.position.set(0.9, 1.5, 1.6)
  key.castShadow = false
  lights.add(key)

  // Raised after the structural review: the stronger key left a vertical sheen gradient
  // across the face plate that the reference's broad frontal fill does not have.
  const fill = new THREE.DirectionalLight(0xf2f6ff, 0.22)
  fill.position.set(-0.6, 0.2, 2.0)
  lights.add(fill)

  // The albedo maps are de-lit but not perfectly (de-light confidence 0.594), so a soft
  // back light keeps the rear-facing rim from crushing to black on orbit views.
  const back = new THREE.DirectionalLight(0xeef2f6, 0.1)
  back.position.set(-0.5, 0.6, -1.8)
  lights.add(back)

  lights.userData.reviewMode = mode
  return lights
}

/**
 * A studio softbox environment, built in code so nothing is fetched at runtime.
 *
 * Required, not decorative: the gold collar ring is the model's only metalness-1.0 surface, and a
 * fully metallic material has no diffuse response — it shows only what it reflects. With no
 * environment it rendered at median rgb(58,51,35) against the reference's measured rgb(182,153,92),
 * near-black except for one specular hotspot. This gives it a bright neutral surround to reflect,
 * matching the white sweep the reference was shot on.
 */
function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const size = 256
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d")!
  const gradient = context.createLinearGradient(0, 0, 0, size)
  gradient.addColorStop(0, "#ffffff")
  gradient.addColorStop(0.45, "#eef1f4")
  gradient.addColorStop(0.55, "#c9ced4")
  gradient.addColorStop(1, "#6f757c")
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  // A bright upper-right patch standing in for the key softbox, so the metal's highlight sits
  // where the reference's does rather than wrapping evenly.
  context.fillStyle = "#ffffff"
  context.beginPath()
  context.ellipse(
    size * 0.68,
    size * 0.2,
    size * 0.22,
    size * 0.14,
    0,
    0,
    Math.PI * 2
  )
  context.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.mapping = THREE.EquirectangularReflectionMapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()
  const environment = pmrem.fromEquirectangular(texture).texture
  pmrem.dispose()
  texture.dispose()
  return environment
}

/**
 * Median colour and roughness measured off the reference photo, per material.
 *
 * These are already in the sculpt spec, but they never reach the render on their own:
 * `createSculptMaterial` in the generated factory sets `color: 0xffffff` and `roughness: 1`
 * whenever a texture set exists, delegating both entirely to its procedural maps. For the one
 * metal that was fatal — a fully rough metal reflects the whole environment and washes out, so
 * the gold ring rendered rgb(207,199,175) against the measured rgb(182,153,92).
 *
 * Three.js multiplies `color` into `map` and `roughness` into `roughnessMap`, so re-applying the
 * measurement here composes with the generated maps instead of replacing them. The colour factor
 * is derived from each map's own average at runtime, so it stays correct if the maps are
 * regenerated. Sources: analysis.md Layer 5 / 6, median RGB per sampled region.
 */
const MEASURED_RESPONSE: Record<
  string,
  {
    albedo: [number, number, number]
    roughness: number
    envMapIntensity: number
  }
> = {
  faceSkin: { albedo: [59, 71, 71], roughness: 0.62, envMapIntensity: 0.14 },
  edgeGuard: { albedo: [56, 67, 68], roughness: 0.7, envMapIntensity: 0.14 },
  collarPolymer: {
    albedo: [26, 29, 33],
    roughness: 0.34,
    envMapIntensity: 0.2,
  },
  // The one metal: its entire appearance is environment reflection, so it needs an order more
  // environment than the dielectrics around it.
  collarGold: {
    albedo: [182, 153, 92],
    roughness: 0.22,
    envMapIntensity: 0.95,
  },
  gripWrap: { albedo: [228, 211, 182], roughness: 0.84, envMapIntensity: 1.15 },
  handleCore: { albedo: [42, 44, 46], roughness: 0.65, envMapIntensity: 0.14 },
}

function averageMapColor(
  map: THREE.Texture | null
): [number, number, number] | null {
  const image = map?.image as CanvasImageSource | undefined
  if (!image || typeof document === "undefined") return null
  const canvas = document.createElement("canvas")
  canvas.width = 8
  canvas.height = 8
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) return null
  try {
    context.drawImage(image, 0, 0, 8, 8)
  } catch {
    return null
  }
  const data = context.getImageData(0, 0, 8, 8).data
  let r = 0
  let g = 0
  let b = 0
  for (let i = 0; i < 64; i += 1) {
    r += data[i * 4]
    g += data[i * 4 + 1]
    b += data[i * 4 + 2]
  }
  return [r / 64, g / 64, b / 64]
}

/**
 * Returns true while some material's albedo map is still loading.
 *
 * Roughness and env intensity land on the first pass, but the colour factor is
 * derived from the map's own average, and the maps are fetched asynchronously —
 * on the first pass `material.map.image` is still undefined, so the caller
 * re-runs this until every map has arrived. Without that the measured albedo
 * never reached the render at all.
 */
function applyMeasuredResponse(model: THREE.Group): boolean {
  const done = new Set<string>()
  let pending = false
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const material = object.material
    if (
      Array.isArray(material) ||
      !(material instanceof THREE.MeshPhysicalMaterial)
    )
      return
    const id = (
      material.userData?.sculptMaterial as { id?: string } | undefined
    )?.id
    if (!id || done.has(id)) return
    done.add(id)
    const measured = MEASURED_RESPONSE[id]
    if (!measured) return

    material.roughness = measured.roughness
    material.envMapIntensity = measured.envMapIntensity
    /* A procedural map whose sliced bake hasn't landed yet is a blank canvas —
       averaging it would read [0,0,0] and lock in a wrong colour factor
       forever. Treat it like a fetch still in flight and poll again. */
    const stillBaking = material.map?.userData?.pendingFill === true
    const average = stillBaking ? null : averageMapColor(material.map)
    if (!average && material.map) pending = true
    if (average) {
      // Divide out what the map already carries so the product lands on the measurement.
      material.color.setRGB(
        Math.min(1, measured.albedo[0] / Math.max(1, average[0])),
        Math.min(1, measured.albedo[1] / Math.max(1, average[1])),
        Math.min(1, measured.albedo[2] / Math.max(1, average[2])),
        THREE.SRGBColorSpace
      )
    }
    material.needsUpdate = true
  })
  return pending
}

/**
 * Build the paddle once, then hand every scene a lightweight copy of it — see
 * `instancing.ts` for why the copy is hand-rolled rather than `clone()`.
 *
 * The prototype is never disposed: it is the cache, and it lives for the
 * lifetime of the page.
 */
let paddlePrototype: THREE.Group | null = null

function instantiatePaddleModel(): THREE.Group {
  paddlePrototype ??= createPaddlePowerPickleballPaddleModel()
  return shallowCopyNode(paddlePrototype) as THREE.Group
}

export function createPaddleScene(
  options: PaddleSceneOptions & { renderer?: THREE.WebGLRenderer } = {}
): PaddleScene {
  const {
    background = null,
    lighting = "reference",
    frameHeight = PADDLE_LENGTH / 0.99,
    ball: withBall = false,
  } = options

  const scene = new THREE.Scene()
  scene.background = background === null ? null : new THREE.Color(background)
  if (options.renderer)
    scene.environment = createStudioEnvironment(options.renderer)

  const model = instantiatePaddleModel()
  // Re-runs until the async albedo maps are in hand — see applyMeasuredResponse.
  // Capped so a map that never arrives can't leave a timer running forever.
  let measureTimer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0
  let notifiedReady = false
  /* The procedural bakes run in slices after the model is built (see
     cooperative.ts), so "measured maps applied" no longer implies "textures
     finished". Ready waits for both — the viewers hold their canvases at
     opacity 0 until this fires, which is what keeps a half-baked paddle or an
     unperforated ball from ever being painted. */
  const textureCompletions: Promise<unknown>[] = []
  if (model.userData.texturesComplete)
    textureCompletions.push(model.userData.texturesComplete)
  const notifyReady = () => {
    if (notifiedReady) return
    notifiedReady = true
    void Promise.all(textureCompletions).then(() => options.onReady?.())
  }
  const measure = () => {
    measureTimer = null
    // The cap is generous on purpose: it exists so a map that never arrives
    // can't leave a timer running, not as a deadline. Hitting it still reports
    // ready — an untextured paddle beats a paddle that never appears.
    if (!applyMeasuredResponse(model)) return notifyReady()
    if ((attempts += 1) > 150) return notifyReady()
    measureTimer = setTimeout(measure, 100)
  }
  scene.add(model)
  scene.add(
    createReferenceLights(lighting === "neutral" ? "neutral" : "reference")
  )

  // Staged in front of and to the upper right of the face, close enough to read
  // as one product shot but clear of the paddle's silhouette on every orbit.
  let ball: THREE.Group | null = null
  if (withBall) {
    ball = instantiatePickleballModel()
    ball.position.set(0.13, PADDLE_LENGTH * 0.74, 0.09)
    ball.rotation.x = THREE.MathUtils.degToRad(-16)
    scene.add(ball)

    // The paddle's reference key is far dimmer than the ball scene's (0.55 vs
    // 2.0), which left the shell muddy. A local point light lifts it without
    // touching the paddle: the falloff is spent well before the face.
    // Intensity is in candela and falls off with the square of distance, so the
    // small number here still lands ~1.5 on a shell sitting ~0.15 m away.
    const ballKey = new THREE.PointLight(0xfffdf3, 0.035, 0.4, 2)
    ballKey.position.set(0.24, PADDLE_LENGTH * 0.9, 0.24)
    scene.add(ballKey)

    if (ball.userData.texturesComplete)
      textureCompletions.push(ball.userData.texturesComplete)
  }

  /* Kicked off only after every completion the scene must wait on is
     registered — `measure` can reach `notifyReady` on its first pass. */
  measure()

  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.001, 10)
  camera.position.set(0, PADDLE_CENTER_Y, 2)
  camera.lookAt(0, PADDLE_CENTER_Y, 0)

  const resize = (width: number, height: number) => {
    const aspect = width / Math.max(1, height)
    const halfHeight = frameHeight / 2
    const halfWidth = halfHeight * aspect
    camera.left = -halfWidth
    camera.right = halfWidth
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.updateProjectionMatrix()
  }
  resize(1, 1)

  return {
    scene,
    camera,
    model,
    ball,
    setAzimuth: (degrees) => {
      model.rotation.y = THREE.MathUtils.degToRad(degrees)
      // Slower and counter to the paddle, so the two reads as separate objects
      // rather than one rigid assembly.
      if (ball) ball.rotation.y = THREE.MathUtils.degToRad(-degrees * 0.7)
    },
    resize,
    dispose: () => {
      if (measureTimer !== null) clearTimeout(measureTimer)
      // The environment is built per renderer, so it is the one GPU resource
      // this scene genuinely owns.
      if (scene.environment) scene.environment.dispose()
      // Everything else — geometry, materials, and the ten PBR maps hanging off
      // them — belongs to the shared prototypes and is very likely still being
      // rendered by the other court half's viewer. Releasing the scene graph is
      // the whole of an instance's teardown; see `instancing.ts`.
      if (ball) disposeInstance(ball)
      disposeInstance(model)
    },
  }
}

/** Applies the renderer settings the spec's lighting contract calls for. */
export function configurePaddleRenderer(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.88
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
}
