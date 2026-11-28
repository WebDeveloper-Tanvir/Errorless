"use client"

import { useMemo, useState } from "react"
import { Check, Copy, Link2, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { track } from "@/lib/analytics"
import type { DebugResult } from "@/lib/debug/schema"
import { SHARE } from "@/lib/growth/config"
import { buildSharePayload } from "@/lib/growth/share"

/**
 * Explicit-consent sharing. Nothing is public until the owner presses "Create link".
 * The dialog shows exactly what will be visible; your submitted code and error text are never
 * included. Evidence quotes and corrected code are off unless you tick them.
 */
export function ShareDialog({ result }: { result: DebugResult }) {
  const [open, setOpen] = useState(false)
  const [includeEvidence, setEvidence] = useState(false)
  const [includeCode, setCode] = useState(false)
  const [days, setDays] = useState<number>(SHARE.defaultDays)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const payload = useMemo(
    () => buildSharePayload(result, { includeEvidence, includeCorrectedCode: includeCode }),
    [result, includeEvidence, includeCode],
  )
  const hasCode = !!result.fix?.correctedCode

  function reset(o: boolean) {
    setOpen(o)
    if (!o) { setUrl(null); setConsent(false); setError(null); setEvidence(false); setCode(false) }
  }

  async function create() {
    setBusy(true); setError(null)
    try {
      const res = await fetch("/api/growth/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, consent: true, days }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || "Could not create the link."); return }
      setUrl(d.url)
      track("share_created", { include_code: payload.includes.correctedCode, include_evidence: payload.includes.evidence, days })
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" aria-hidden /> Share
      </Button>
      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share this result</DialogTitle>
            <DialogDescription>Private by default. Nothing is published until you create a link.</DialogDescription>
          </DialogHeader>

          {url ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Anyone with this link can read the result until it expires. You can revoke it any time from the Invite &amp; sharing page.</p>
              <div className="flex gap-2">
                <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-xs text-foreground" />
                <Button type="button" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* blocked */ } }}>
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">This link is shown only once. We store only a fingerprint of it, so we can&apos;t show it again.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <fieldset className="space-y-2 text-sm">
                <legend className="mb-1 font-medium text-foreground">What will be visible</legend>
                <p className="text-muted-foreground">Summary, root cause, confidence, fix steps, verification and prevention tips. Secret-like values are removed. <strong className="text-foreground">Your submitted code and error text are not included.</strong></p>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={includeEvidence} onChange={(e) => setEvidence(e.target.checked)} className="mt-1" />
                  <span>Include evidence quotes <span className="text-muted-foreground">(short excerpts from your code or error)</span></span>
                </label>
                {hasCode && (
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={includeCode} onChange={(e) => setCode(e.target.checked)} className="mt-1" />
                    <span>Include the corrected code <span className="text-muted-foreground">(contains your code)</span></span>
                  </label>
                )}
              </fieldset>

              <div>
                <label htmlFor="share-days" className="text-sm font-medium text-foreground">Link expires after</label>
                <select id="share-days" value={days} onChange={(e) => setDays(Number(e.target.value))}
                  className="ml-2 h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground">
                  {[1, 7, 30].map((d) => <option key={d} value={d}>{d} {d === 1 ? "day" : "days"}</option>)}
                </select>
              </div>

              <details className="rounded-lg border border-border bg-background p-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Preview exactly what will be shared</summary>
                <pre tabIndex={0} className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-foreground">{JSON.stringify(payload, null, 2)}</pre>
              </details>

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
                <span>I understand anyone with the link can view this, and I choose to share it.</span>
              </label>
              {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
              <Button type="button" disabled={!consent || busy} onClick={create}>
                <Link2 className="h-4 w-4" aria-hidden /> {busy ? "Creating…" : "Create link"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
