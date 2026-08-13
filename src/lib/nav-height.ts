/**
 * Resolves `--nav-h` to pixels. The token is authored in rem, so it has to be
 * read against the root font size rather than trusted as a bare number.
 */
export function getNavHeightPx(): number {
  const root = getComputedStyle(document.documentElement)
  const raw = root.getPropertyValue("--nav-h").trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return 72
  return raw.endsWith("rem")
    ? value * (Number.parseFloat(root.fontSize) || 16)
    : value
}
