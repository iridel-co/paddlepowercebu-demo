"use client"

import { useEffect, useState } from "react"

/**
 * Live `matchMedia` result for a breakpoint.
 *
 * For gating *work*, not layout — Tailwind's responsive variants already handle
 * anything that is only a matter of what's painted. This exists for the cases
 * where a `hidden lg:block` wrapper isn't enough because the subtree inside it
 * costs something to mount at all: `display: none` still runs the component's
 * effects, so a WebGL viewer under one stands up a GL context, downloads its
 * textures, and builds its geometry on a phone that will never show it.
 *
 * Starts `false` on the server and on the first client render, so a subtree
 * gated on it is never part of hydration — matches how these viewers are loaded
 * (`next/dynamic` with `ssr: false`) anyway.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const list = window.matchMedia(query)
    const sync = () => setMatches(list.matches)
    sync()
    list.addEventListener("change", sync)
    return () => list.removeEventListener("change", sync)
  }, [query])

  return matches
}
