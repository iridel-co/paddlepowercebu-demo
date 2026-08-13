import * as THREE from "three"

import { BALL_RADIUS, instantiatePickleballModel } from "./createBallModel"
import { disposeInstance } from "./instancing"

/**
 * Shared scene setup for the procedural pickleball.
 *
 * Mirrors `paddle-scene.ts`: metres, model at the origin, transparent background by default so
 * the viewer drops onto any section colour, and a code-built studio environment so nothing is
 * fetched at runtime. The framing matches `public/images/pickleball-ball.png`, where the ball
 * fills ~78% of a square frame — that is what makes a render directly comparable to it.
 */

export type BallSceneOptions = {
  /** Review renders use the white sweep; the site viewer uses null for transparent. */
  background?: THREE.ColorRepresentation | null
  /** 'reference' matches the render's key/fill; 'neutral' judges material readability alone. */
  lighting?: "neutral" | "reference"
  /** Vertical world height the camera frames. Defaults to the reference framing. */
  frameHeight?: number
  renderer?: THREE.WebGLRenderer
}

export type BallScene = {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  model: THREE.Group
  /** Orbit the ball about Y, in degrees. */
  setAzimuth: (degrees: number) => void
  resize: (width: number, height: number) => void
  dispose: () => void
}

/**
 * Reference lighting: a bright key from the upper right, a broad frontal fill, and a soft
 * back light. The reference's holes stay readable at the terminator, which only happens with
 * meaningful ambient — hence the strong hemisphere rather than a single hard key.
 */
function createBallLights(mode: "reference" | "neutral"): THREE.Group {
  const lights = new THREE.Group()
  lights.name = "Ball reference lighting"

  lights.add(
    new THREE.HemisphereLight(
      0xf4f7e0,
      0x5c6a42,
      mode === "neutral" ? 1.6 : 0.3
    )
  )

  // Strong single key: the reference has a hot upper-right highlight falling to a clearly
  // shaded lower-left limb. An even ambient washed that gradient out entirely.
  const key = new THREE.DirectionalLight(
    0xfffdf3,
    mode === "neutral" ? 0.8 : 2.0
  )
  key.position.set(1.2, 1.5, 1.4)
  lights.add(key)

  const fill = new THREE.DirectionalLight(0xeef6e4, 0.22)
  fill.position.set(-1.5, 0.1, 1.0)
  lights.add(fill)

  // Keeps the rear bore walls from crushing to black when a hole is seen edge-on.
  const back = new THREE.DirectionalLight(0xeef4ea, 0.22)
  back.position.set(-0.4, 0.7, -1.6)
  lights.add(back)

  lights.userData.reviewMode = mode
  return lights
}

/** A white studio sweep, built in code, for the shell's clearcoat highlight to reflect. */
function createStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const size = 256
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d")!
  const gradient = context.createLinearGradient(0, 0, 0, size)
  gradient.addColorStop(0, "#ffffff")
  gradient.addColorStop(0.5, "#eef1f4")
  gradient.addColorStop(1, "#7b8188")
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  context.fillStyle = "#ffffff"
  context.beginPath()
  context.ellipse(
    size * 0.7,
    size * 0.22,
    size * 0.2,
    size * 0.13,
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

export function createBallScene(options: BallSceneOptions = {}): BallScene {
  const {
    background = null,
    lighting = "reference",
    // The reference ball spans 528 px of a 673 px frame.
    frameHeight = (BALL_RADIUS * 2) / 0.78,
  } = options

  const scene = new THREE.Scene()
  scene.background = background === null ? null : new THREE.Color(background)
  if (options.renderer)
    scene.environment = createStudioEnvironment(options.renderer)

  const model = instantiatePickleballModel()
  scene.add(model)
  scene.add(createBallLights(lighting === "neutral" ? "neutral" : "reference"))

  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.001, 10)
  camera.position.set(0, 0, 1)
  camera.lookAt(0, 0, 0)

  const resize = (width: number, height: number) => {
    const aspect = width / Math.max(1, height)
    const halfHeight = frameHeight / 2
    camera.left = -halfHeight * aspect
    camera.right = halfHeight * aspect
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.updateProjectionMatrix()
  }
  resize(1, 1)

  return {
    scene,
    camera,
    model,
    setAzimuth: (degrees) => {
      model.rotation.y = THREE.MathUtils.degToRad(degrees)
    },
    resize,
    dispose: () => {
      // Built per renderer, so it is this scene's own. The model's geometry,
      // materials and generated maps belong to the shared prototype and stay —
      // see `instancing.ts`.
      scene.environment?.dispose()
      disposeInstance(model)
    },
  }
}

/** Applies the renderer settings this scene's lighting was tuned against. */
export function configureBallRenderer(renderer: THREE.WebGLRenderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  // No tone mapping on purpose: ACES desaturates the bright side of a saturated hue toward
  // white, which is exactly what pulled the render off the reference's green highlight.
  renderer.toneMapping = THREE.NoToneMapping
  renderer.toneMappingExposure = 1.0
}
