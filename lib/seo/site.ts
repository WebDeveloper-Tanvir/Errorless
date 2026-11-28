/** Site-wide SEO constants. No imports so it can be used from tests, config and components. */

export const SITE_NAME = "Errorless"
/** Override per environment (preview/staging) with NEXT_PUBLIC_SITE_URL. No trailing slash. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://errorless.dev").replace(/\/+$/, "")
export const SITE_TAGLINE = "AI debugging for developers"
export const DEFAULT_DESCRIPTION =
  "Paste an error message or stack trace and get the likely root cause, the evidence for it, and the smallest safe fix. Free pattern-based explanations; AI analysis with Dev Mode."

/** Dates are real content-update dates, not build time, so <lastmod> stays honest. */
export const CONTENT_UPDATED = "2026-11-26"

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

/** Paths that must never be indexed: private, per-user or transactional. */
export const NOINDEX_PATHS = ["/dashboard", "/devmode", "/profile", "/editor", "/ide", "/admin", "/sign-in", "/sign-up", "/auth", "/login", "/signup", "/sso-callback", "/invite", "/s", "/quiz", "/learn"] as const
/** Paths crawlers should not even fetch (APIs and admin). */
export const DISALLOW_PATHS = ["/api/", "/admin/"] as const
