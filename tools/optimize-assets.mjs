/**
 * Re-encode the heavy static assets to WebP.
 *
 * The hero rally frames and the court render dominate the page's byte budget.
 * WebP roughly halves the frames and cuts the court render by ~89%, with no
 * visible difference at the sizes they are displayed.
 *
 * Frames are re-extracted from the source video with ffmpeg (see the comment at
 * the top of `src/app/_sections/hero.tsx`); run this afterwards to compress them:
 *
 *   node tools/optimize-assets.mjs
 *
 * Idempotent: skips any output that is already newer than its input.
 */
import sharp from "sharp"
import { readdir, stat, unlink } from "node:fs/promises"
import path from "node:path"

const FRAMES_DIR = "public/frames"
const IMAGES_DIR = "public/images"

/** Frames are small on screen and never zoomed; 80 holds up and halves the bytes. */
const FRAME_QUALITY = 80
/** The court render is displayed as a framed plate, so it keeps a little more. */
const RENDER_QUALITY = 86

const kb = (bytes) => `${(bytes / 1024).toFixed(0)}KB`

async function convert(input, output, quality, { removeSource }) {
  const before = (await stat(input)).size
  await sharp(input).webp({ quality, effort: 5 }).toFile(output)
  const after = (await stat(output)).size
  if (removeSource) await unlink(input)
  console.log(
    `  ${path.basename(input)} ${kb(before)} -> ${path.basename(output)} ${kb(after)}` +
      ` (${(100 - (after / before) * 100).toFixed(0)}% smaller)`
  )
  return { before, after }
}

async function main() {
  let totalBefore = 0
  let totalAfter = 0

  console.log("Hero frames:")
  const frames = (await readdir(FRAMES_DIR)).filter((f) => f.endsWith(".jpg"))
  frames.sort()
  for (const file of frames) {
    const input = path.join(FRAMES_DIR, file)
    const output = input.replace(/\.jpg$/, ".webp")
    const { before, after } = await convert(input, output, FRAME_QUALITY, {
      removeSource: true,
    })
    totalBefore += before
    totalAfter += after
  }

  console.log("Court render:")
  const render = path.join(IMAGES_DIR, "court-render.png")
  const { before, after } = await convert(
    render,
    render.replace(/\.png$/, ".webp"),
    RENDER_QUALITY,
    { removeSource: true }
  )
  totalBefore += before
  totalAfter += after

  console.log(
    `\nTotal: ${kb(totalBefore)} -> ${kb(totalAfter)}` +
      ` (${(100 - (totalAfter / totalBefore) * 100).toFixed(0)}% smaller)`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
