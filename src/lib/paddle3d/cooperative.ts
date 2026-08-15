/**
 * Cooperative row scheduler for the procedural texture bakes.
 *
 * The paddle synthesises five 1024² map sets and the ball rasterises a
 * 1024×512 perforation mask, all in per-pixel loops. Run in one go that is
 * seconds of main-thread work — it landed inside React's passive-effect flush
 * as a single ~3s task that blocked the whole page at load (the viewers mount
 * ahead of the visitor on purpose, so "at load" is exactly when it ran).
 *
 * This runs the same loops in slices: rows are processed until the time
 * budget is spent, then the rest is posted back to the task queue. Every
 * computed pixel is identical — only the scheduling changes. The budget keeps
 * each slice under the 50ms long-task threshold with room to spare, and a
 * MessageChannel carries the continuation because, unlike `setTimeout`, it
 * isn't clamped in background tabs, so a build started just before a tab
 * switch still finishes promptly.
 */
const BUDGET_MS = 6

export function runSliced(
  totalRows: number,
  processRow: (row: number) => void
): Promise<void> {
  // No event loop worth yielding to — the review pipeline's scripted
  // environments just want the finished pixels.
  if (typeof window === "undefined" || typeof MessageChannel === "undefined") {
    for (let row = 0; row < totalRows; row += 1) processRow(row)
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    let row = 0
    const channel = new MessageChannel()
    const pump = () => {
      const deadline = performance.now() + BUDGET_MS
      while (row < totalRows) {
        processRow(row)
        row += 1
        if (performance.now() >= deadline) break
      }
      if (row >= totalRows) {
        resolve()
        return
      }
      channel.port2.postMessage(null)
    }
    channel.port1.onmessage = pump
    pump()
  })
}
