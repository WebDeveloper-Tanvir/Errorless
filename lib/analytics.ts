import { track as vercelTrack } from "@vercel/analytics"
import { sanitizeProps, trackingDisabled, type AnalyticsEvent } from "./seo/events.ts"

/**
 * Privacy-first product analytics. Sends to Vercel Analytics (already installed) and, if
 * NEXT_PUBLIC_GA_MEASUREMENT_ID is set, to Google Analytics 4. Event names and properties
 * are restricted by lib/seo/events.ts: never any error text, code, email or user id.
 * Honors Do Not Track and a local opt-out flag.
 */
export const OPT_OUT_KEY = "errorless:analytics-optout"

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function optedOut(): boolean {
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === "1"
  } catch {
    return false
  }
}

export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return
  if (trackingDisabled(window.navigator as { doNotTrack?: string | null }, optedOut())) return
  const clean = sanitizeProps(event, props)
  try {
    vercelTrack(event, clean)
  } catch {
    /* analytics must never break the app */
  }
  try {
    window.gtag?.("event", event, clean)
  } catch {
    /* ignore */
  }
}
