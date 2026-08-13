"use client"

import { useEffect } from "react"

import { getNavHeightPx } from "@/lib/nav-height"

/**
 * Drives every in-page `href="#id"` jump through `window.scrollTo` instead of
 * native fragment navigation.
 *
 * Safari — iOS in particular, where the toolbar collapses mid-scroll and
 * shifts the visual viewport — computes the native jump's target before that
 * settles and ignores `scroll-margin-top` when it does, landing short and
 * tucking the target's heading under the fixed nav. A layout shift *during*
 * the animation causes the same symptom in Chromium: `#locations` mounts two
 * live WebGL viewers on scroll-into-view, and the jank from that mount can
 * make the browser abandon its own smooth-scroll early, well short of the
 * target, without ever firing `scrollend`.
 *
 * Both cases get fixed the same way: read the target fresh and correct once
 * the animation should be done, rather than trusting that the single scroll
 * we kicked off actually reached it. The correction has to use `"instant"`,
 * not `"auto"` — `"auto"` isn't actually instant, it defers to this page's
 * CSS `scroll-behavior: smooth`, which would just queue another animation
 * instead of landing the fix.
 */
const SETTLE_POLL_MS = 120
const SETTLE_MAX_TICKS = 20 // ~2.4s ceiling, well past any real animation

export function SmoothAnchorScroll() {
  useEffect(() => {
    let pollId: number | null = null

    const computeTop = (id: string) => {
      const el = document.getElementById(id)
      if (!el) return null
      return el.getBoundingClientRect().top + window.scrollY - getNavHeightPx()
    }

    const settle = (id: string) => {
      if (pollId !== null) window.clearInterval(pollId)
      let lastY = window.scrollY
      let steadyStreak = 0
      let ticks = 0
      pollId = window.setInterval(() => {
        ticks += 1
        const y = window.scrollY
        const steady = y === lastY
        lastY = y
        steadyStreak = steady ? steadyStreak + 1 : 0
        if (steadyStreak < 2 && ticks < SETTLE_MAX_TICKS) return

        if (pollId !== null) window.clearInterval(pollId)
        pollId = null
        const top = computeTop(id)
        if (top !== null && Math.abs(top - window.scrollY) > 1) {
          window.scrollTo({ top, behavior: "instant" as ScrollBehavior })
        }
      }, SETTLE_POLL_MS)
    }

    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return
      const anchor = (e.target as HTMLElement).closest?.(
        'a[href^="#"]'
      ) as HTMLAnchorElement | null
      if (!anchor) return

      const id = anchor.getAttribute("href")?.slice(1)
      if (!id) return
      const top = computeTop(id)
      if (top === null) return

      e.preventDefault()
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
      window.scrollTo({
        top,
        behavior: reducedMotion ? ("instant" as ScrollBehavior) : "smooth",
      })
      history.pushState(null, "", `#${id}`)
      if (!reducedMotion) settle(id)
    }

    document.addEventListener("click", onClick)
    return () => {
      document.removeEventListener("click", onClick)
      if (pollId !== null) window.clearInterval(pollId)
    }
  }, [])

  return null
}
