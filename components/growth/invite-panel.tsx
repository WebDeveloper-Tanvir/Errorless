"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Copy, Gift, Link2, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Referral {
  code: string
  link: string
  rewarded: number
  unrewarded: number
  credits: number
  policy: { rewardCredits: number; maxRewarded: number }
}
interface ShareRow { id: string; title: string; createdAt: number; expiresAt: number; revokedAt: number | null; views: number }

async function load<T>(url: string): Promise<{ data?: T; error?: string }> {
  try {
    const r = await fetch(url, { cache: "no-store" })
    const d = await r.json().catch(() => ({}))
    return r.ok ? { data: d as T } : { error: d.error || "Could not load." }
  } catch {
    return { error: "Could not reach the server." }
  }
}

export function InvitePanel() {
  const [ref, setRef] = useState<Referral | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { load<Referral>("/api/growth/referral").then((r) => (r.data ? setRef(r.data) : setErr(r.error ?? null))) }, [])

  if (err) return <p role="alert" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{err}</p>
  if (!ref) return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Loading your invite link</p>

  return (
    <section aria-labelledby="invite-h" className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 id="invite-h" className="flex items-center gap-2 text-lg font-semibold"><Gift className="h-5 w-5 text-primary" aria-hidden /> Invite a developer</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        When a developer signs up through your link and verifies their email, you <em>both</em> get {ref.policy.rewardCredits} AI analyses.
        Up to {ref.policy.maxRewarded} invites earn credits. Invites to yourself, to unverified or older accounts, and repeat claims don&apos;t count. Sharing is always optional.
      </p>
      <div className="mt-4 flex gap-2">
        <input readOnly value={ref.link} aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-xs text-foreground" />
        <Button type="button" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(ref.link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* blocked */ } }}>
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[["Rewarded invites", ref.rewarded], ["Counted, no credits", ref.unrewarded], ["Your AI credits", ref.credits]].map(([k, v]) => (
          <div key={k as string} className="rounded-xl border border-border bg-surface p-3">
            <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
            <dt className="mt-1 text-xs text-muted-foreground">{k}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">These are real counts from our database. Credits are used for AI debugging on free accounts; paid plans don&apos;t need them.</p>
    </section>
  )
}

export function MyShares() {
  const [rows, setRows] = useState<ShareRow[] | null>(null)
  const [now, setNow] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const refresh = useCallback(() => load<{ shares: ShareRow[]; now: number }>("/api/growth/share").then((r) => {
    if (r.data) { setRows(r.data.shares); setNow(r.data.now) } else setErr(r.error ?? null)
  }), [])
  useEffect(() => { refresh() }, [refresh])

  async function revoke(id: string) {
    const r = await fetch(`/api/growth/share?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    if (r.ok) refresh(); else setErr("Could not revoke that link.")
  }

  return (
    <section aria-labelledby="shares-h" className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 id="shares-h" className="flex items-center gap-2 text-lg font-semibold"><Link2 className="h-5 w-5 text-primary" aria-hidden /> Your shared results</h2>
      <p className="mt-2 text-sm text-muted-foreground">Every link you created, and only yours. Nothing is shared unless you made a link. Revoking takes effect immediately.</p>
      {err && <p role="alert" className="mt-3 text-sm text-rose-400">{err}</p>}
      {rows === null && !err && <p role="status" className="mt-3 text-sm text-muted-foreground">Loading…</p>}
      {rows && rows.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No links yet. Use <strong className="text-foreground">Share</strong> on a Dev Mode result to create one. <Link href="/devmode" className="text-brand underline-offset-4 hover:underline">Open Dev Mode</Link></p>}
      {rows && rows.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((s) => {
            const status = s.revokedAt ? "Revoked" : s.expiresAt <= now ? "Expired" : `Expires ${new Date(s.expiresAt).toLocaleDateString()}`
            const live = !s.revokedAt && s.expiresAt > now
            return (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{status} · {s.views} {s.views === 1 ? "view" : "views"}</p>
                </div>
                {live && <Button type="button" size="sm" variant="outline" onClick={() => revoke(s.id)} aria-label={`Revoke link: ${s.title}`}><Trash2 className="h-4 w-4" aria-hidden />Revoke</Button>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
