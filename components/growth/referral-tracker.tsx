"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { X } from "lucide-react"
import { track } from "@/lib/analytics"
import { REFERRAL } from "@/lib/growth/config"
import { isReferralCode } from "@/lib/growth/referral"

/**
 * Invite attribution, in the open:
 *  1. A visitor arriving with ?ref=CODE has the code remembered in localStorage for 30 days.
 *  2. After they sign up and sign in, the code is sent to the server once. The server decides
 *     whether it counts (different person, verified email, new account) and who gets credits.
 *  3. The visitor sees the real outcome, including when nothing was granted.
 * No code is ever generated in the browser.
 */
interface Stored { code: string; exp: number }

function remember(code: string) {
  try {
    const cur = JSON.parse(localStorage.getItem(REFERRAL.storageKey) ?? "null") as Stored | null
    if (cur && cur.exp > Date.now()) return // first invite wins
    localStorage.setItem(REFERRAL.storageKey, JSON.stringify({ code, exp: Date.now() + REFERRAL.rememberDays * 86_400_000 }))
  } catch { /* storage blocked: attribution is simply skipped */ }
}

export function ReferralTracker() {
  const { isLoaded, isSignedIn, user } = useUser()
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref")?.toUpperCase()
    if (isReferralCode(code)) remember(code)
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return
    let stored: Stored | null = null
    try { stored = JSON.parse(localStorage.getItem(REFERRAL.storageKey) ?? "null") } catch { return }
    if (!stored || stored.exp < Date.now() || !isReferralCode(stored.code)) return
    // Only recently created accounts can use an invite; skip the request for everyone else.
    if (user.createdAt && Date.now() - new Date(user.createdAt).getTime() > REFERRAL.maxAccountAgeMs) {
      try { localStorage.removeItem(REFERRAL.storageKey) } catch { /* ignore */ }
      return
    }
    const done = () => { try { localStorage.removeItem(REFERRAL.storageKey) } catch { /* ignore */ } }
    fetch("/api/growth/referral", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: stored.code }) })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => {
        if (d.outcome === "not_eligible" && d.reason === "unverified_email") { setNotice(d.message); return } // keep the code; they can verify and retry
        if (d.outcome === "rewarded" || d.outcome === "counted") track("referral_conversion", { outcome: d.outcome })
        if (d.outcome) done()
        if (ok && (d.outcome === "rewarded" || d.outcome === "counted")) setNotice(d.message)
      })
      .catch(() => { /* try again next visit */ })
  }, [isLoaded, isSignedIn, user])

  if (!notice) return null
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl border border-brand/30 bg-popover px-4 py-3 text-sm shadow-glow">
      <span>{notice}</span>
      <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="rounded p-1 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
