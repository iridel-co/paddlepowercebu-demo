/**
 * Client-readable environment values.
 *
 * `NEXT_PUBLIC_BASE_URL` is the origin the site is being served from. Vercel
 * preview deploys set it to their own URL; production sets it to the real
 * domain. Everything about indexing follows from which one it is, so this is
 * the only switch the deployment has to get right.
 */
export const ENV_CLIENT = {
  NEXT_PUBLIC_BASE_URL:
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://paddlepowercebu.com",
} as const

export type EnvClient = typeof ENV_CLIENT
