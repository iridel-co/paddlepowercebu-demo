/**
 * Exports the procedural paddle and pickleball as transparent PNGs.
 *
 * The models are generated in code (`src/lib/paddle3d/`), so there is no file to hand anyone.
 * This drives the two review routes — which take size, angle and background off the query
 * string — and screenshots their canvases. Output lands in `assets/renders/`, which is a
 * source folder, not `public/`: these are for design handoff, not for the site to serve.
 *
 *   npm run dev                 # in another shell
 *   node tools/export-renders.mjs
 *
 * Playwright is not a project dependency. It is resolved from node_modules if it is there,
 * otherwise from an `npx playwright` install already on the machine.
 */

import { createRequire } from "node:module"
import { mkdir } from "node:fs/promises"
import { globSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { homedir } from "node:os"

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const OUT_DIR = resolve(ROOT, "assets/renders")
const BASE = process.env.BASE_URL ?? "http://localhost:3000"

/** 2x everything — these get scaled down in design tools, never up. */
const SCALE = 2

const SHOTS = [
  // Paddle. `az` is the orbit angle in degrees; 0 is the reference front view.
  { file: "paddle-front", route: "paddle-3d", w: 700, h: 875, az: 0 },
  { file: "paddle-hero", route: "paddle-3d", w: 700, h: 875, az: -22 },
  { file: "paddle-three-quarter", route: "paddle-3d", w: 700, h: 875, az: -42 },
  { file: "paddle-edge", route: "paddle-3d", w: 700, h: 875, az: -78 },
  { file: "paddle-back", route: "paddle-3d", w: 700, h: 875, az: 180 },
  // Paddle with the pickleball staged beside the face — the pairing the site uses.
  {
    file: "paddle-with-ball",
    route: "paddle-3d",
    w: 800,
    h: 875,
    az: -22,
    ball: true,
  },
  // Ball on its own.
  { file: "ball", route: "ball-3d", w: 600, h: 600, az: 0 },
  { file: "ball-angled", route: "ball-3d", w: 600, h: 600, az: 34 },
]

function resolveChromium() {
  try {
    return require("playwright")
  } catch {
    const [found] = globSync(
      `${homedir()}/.npm/_npx/*/node_modules/playwright/index.mjs`
    )
    if (!found) {
      throw new Error(
        "Playwright not found. Run `npx playwright@1.62.1 --version` once, or `npm i -D playwright`."
      )
    }
    return import(pathToFileURL(found).href)
  }
}

const { chromium } = await resolveChromium()
await mkdir(OUT_DIR, { recursive: true })

const browser = await chromium.launch()
for (const shot of SHOTS) {
  const page = await browser.newPage({
    viewport: { width: shot.w, height: shot.h },
    deviceScaleFactor: SCALE,
  })
  const query = new URLSearchParams({
    bg: "transparent",
    w: String(shot.w),
    h: String(shot.h),
    az: String(shot.az),
    ...(shot.ball ? { ball: "1" } : {}),
  })
  await page.goto(`${BASE}/${shot.route}?${query}`, {
    waitUntil: "networkidle",
  })
  // The dev-server badge floats over the bottom-left of the viewport, which is inside the
  // canvas crop. It is painted into the shot unless it is gone before the capture.
  // ...and the page's own body colour would otherwise show through the transparent canvas,
  // since `omitBackground` only drops the browser's default base layer.
  await page.addStyleTag({
    content: `
      nextjs-portal, #__next-build-watcher { display: none !important }
      html, body { background: transparent !important }
    `,
  })
  // The paddle's PBR maps land after the first frame; capturing early gets a white paddle.
  if (shot.route === "paddle-3d") {
    await page.waitForFunction(() => window.__paddleTexturesReady === true, {
      timeout: 30_000,
    })
  }
  await page.waitForTimeout(400)

  const path = `${OUT_DIR}/${shot.file}.png`
  // `omitBackground` is what keeps the alpha: the canvas is already transparent, and this
  // stops the browser painting its own white behind it.
  await page.locator("canvas").screenshot({ path, omitBackground: true })
  console.log(`${shot.file}.png  ${shot.w * SCALE}×${shot.h * SCALE}`)
  await page.close()
}
await browser.close()
console.log(`\n${SHOTS.length} renders → assets/renders/`)
