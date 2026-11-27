/**
 * Analytics event contract. Pure: no browser or vendor imports, so it is unit-tested.
 * Rules: a fixed allowlist of events, flat primitive props only, short strings,
 * and never any user content (errors, code, emails, ids).
 */

export const EVENTS = ["landing_view", "demo_start", "demo_result", "debug_complete", "debug_error", "signup_click", "sign_up"] as const
export type AnalyticsEvent = (typeof EVENTS)[number]
export type PropValue = string | number | boolean

const ALLOWED_PROPS: Record<AnalyticsEvent, readonly string[]> = {
  landing_view: ["page_type", "slug", "source", "medium"],
  demo_start: ["slug", "language"],
  demo_result: ["slug", "matched", "matches", "static_issues", "used_code"],
  debug_complete: ["status", "confidence", "language", "framework", "input_kinds", "redactions", "has_code"],
  debug_error: ["code", "retryable"],
  signup_click: ["source", "slug", "label"],
  sign_up: ["method"],
}

export function isAnalyticsEvent(name: string): name is AnalyticsEvent {
  return (EVENTS as readonly string[]).includes(name)
}

/** Drops unknown props, non-primitive values and over-long strings. */
export function sanitizeProps(event: AnalyticsEvent, props: Record<string, unknown> = {}): Record<string, PropValue> {
  const out: Record<string, PropValue> = {}
  for (const key of ALLOWED_PROPS[event]) {
    const v = props[key]
    if (typeof v === "string") {
      const t = v.trim().slice(0, 60)
      if (t) out[key] = t
    } else if (typeof v === "number" && Number.isFinite(v)) out[key] = v
    else if (typeof v === "boolean") out[key] = v
  }
  return out
}

export type PageType = "home" | "tool" | "tools_hub" | "pricing" | "docs" | "demo" | "other"

/** Which public pages count as "landing" pages for landing_view. Private paths return null. */
export function classifyLandingPath(pathname: string): { page_type: PageType; slug?: string } | null {
  const p = pathname.replace(/\/+$/, "") || "/"
  if (p === "/") return { page_type: "home" }
  if (p === "/tools") return { page_type: "tools_hub" }
  const tool = /^\/tools\/([a-z0-9-]+)$/.exec(p)
  if (tool) return { page_type: "tool", slug: tool[1] }
  if (p === "/pricing") return { page_type: "pricing" }
  if (p === "/docs") return { page_type: "docs" }
  if (p === "/demo") return { page_type: "demo" }
  return null
}

/** Acquisition source from UTM params or the referrer hostname only (never a full URL). */
export function acquisitionSource(search: string, referrer: string, ownHost: string): { source?: string; medium?: string } {
  const q = new URLSearchParams(search)
  const source = q.get("utm_source") || undefined
  const medium = q.get("utm_medium") || undefined
  if (source) return { source, medium }
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "")
    if (host && host !== ownHost.replace(/^www\./, "")) return { source: host, medium: "referral" }
  } catch {
    /* no referrer */
  }
  return { source: "direct" }
}

/** True when the visitor asked not to be tracked. */
export function trackingDisabled(nav: { doNotTrack?: string | null } | undefined, optOut: boolean): boolean {
  return optOut || nav?.doNotTrack === "1"
}
