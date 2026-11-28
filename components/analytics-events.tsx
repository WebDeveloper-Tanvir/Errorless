"use client"

import { useEffect } from "react"
import Script from "next/script"
import { usePathname } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { track } from "@/lib/analytics"
import { recordVisit, acquisitionSource, classifyLandingPath } from "@/lib/seo/events"

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const SIGNUP_FLAG = "errorless:sign_up_tracked"
const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000

/**
 * Mounts once in the root layout. Fires:
 *  - landing_view   on public marketing and tool pages
 *  - signup_click   when any link to /sign-up is clicked
 *  - sign_up        once, when a brand-new account first loads the app
 * Demo and debugging events are fired where they happen (error-demo, use-debug-session).
 */
export function AnalyticsEvents() {
  const pathname = usePathname()
  const { isLoaded, isSignedIn, user } = useUser()

  useEffect(() => {
    const page = classifyLandingPath(pathname)
    if (!page) return
    const src = acquisitionSource(window.location.search, document.referrer, window.location.hostname)
    track("landing_view", { ...page, ...src })
  }, [pathname])

  // Repeat use: one event per returning calendar day, only a day count, no identifier.
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem("errorless:visit-days") ?? "[]")
      const days = Array.isArray(raw) ? raw.filter((d): d is string => typeof d === "string") : []
      const v = recordVisit(days, new Date().toISOString().slice(0, 10))
      if (!v.changed) return
      window.localStorage.setItem("errorless:visit-days", JSON.stringify(v.days))
      if (v.returning) track("returning_user", { visit_days: v.days.length })
    } catch { /* storage blocked: skip */ }
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!a) return
      const href = a.getAttribute("href") ?? ""
      if (!/^\/sign-up(\/|\?|$)/.test(href)) return
      const page = classifyLandingPath(window.location.pathname)
      track("signup_click", { source: page?.page_type ?? "other", slug: page?.slug, label: (a.getAttribute("aria-label") || a.textContent || "").trim() })
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.createdAt) return
    if (Date.now() - new Date(user.createdAt).getTime() > NEW_ACCOUNT_WINDOW_MS) return
    try {
      if (window.localStorage.getItem(SIGNUP_FLAG) === user.id) return
      window.localStorage.setItem(SIGNUP_FLAG, user.id)
    } catch {
      return
    }
    track("sign_up", { method: "clerk" })
  }, [isLoaded, isSignedIn, user])

  if (!GA_ID) return null
  return (
    <>
      <Script id="ga-consent" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        window.gtag = function(){ dataLayer.push(arguments); };
        gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
        gtag('js', new Date());
        gtag('config', ${JSON.stringify(GA_ID)}, { send_page_view: true, allow_google_signals: false });
      `}</Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="lazyOnload" />
    </>
  )
}
