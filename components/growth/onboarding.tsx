"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { track } from "@/lib/analytics"
import { FREE_TIER } from "@/lib/growth/config"

export const ONBOARDED_KEY = "errorless:onboarded"

const STEPS = [
  {
    title: "1. Submit the error",
    points: [
      "Paste the full error or stack trace, including the first line. That line usually names the problem.",
      "Add the code around the failing line, and optionally what changed recently or your versions.",
      "Language and framework are detected automatically. Pick them yourself if detection is wrong.",
      "Secret-like values (keys, tokens, passwords in URLs) are masked before anything is sent, and you can see a warning when that happens.",
    ],
  },
  {
    title: "2. Read the diagnosis",
    points: [
      "Confirmed, Likely or Hypothesis tells you how sure the root cause is. Treat a hypothesis as something to check, not a fact.",
      "Evidence quotes are checked against what you submitted. An unchecked quote is flagged.",
      "Confidence is calculated from that evidence, not from how sure the AI sounds.",
      "When the evidence is thin you get other possible causes and at most three questions to answer.",
    ],
  },
  {
    title: "3. Apply the fix safely",
    points: [
      "The fix is a minimal change, shown as a before/after diff. Errorless never edits your code for you.",
      "Verification steps are commands for you to run. Errorless does not execute your code and never claims a fix was tested.",
      "Use Copy fix, rate the result, or Share it. Sharing is optional, private until you create a link, and never includes your code unless you tick it.",
    ],
  },
] as const

export function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0)
  const [seen, setSeen] = useState(1)
  const last = i === STEPS.length - 1
  const step = STEPS[i]

  function finish(skipped: boolean) {
    try { localStorage.setItem(ONBOARDED_KEY, "1") } catch { /* ignore */ }
    track("onboarding_complete", { steps_seen: seen, skipped })
    setI(0); setSeen(1)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) finish(!last) }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>How Errorless debugging works</DialogTitle>
          <DialogDescription>Step {i + 1} of {STEPS.length}. You can reopen this from the workspace any time.</DialogDescription>
        </DialogHeader>
        <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">{step.points.map((p) => <li key={p}>{p}</li>)}</ul>
        {last && <p className="rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">{FREE_TIER.aiAccess} {FREE_TIER.sharing}</p>}
        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => finish(!last)}>{last ? "Close" : "Skip"}</Button>
          <div className="flex gap-2">
            {i > 0 && <Button type="button" variant="outline" size="sm" onClick={() => setI(i - 1)}>Back</Button>}
            <Button type="button" size="sm" onClick={() => (last ? finish(false) : (setI(i + 1), setSeen((s) => Math.max(s, i + 2))))}>{last ? "Start debugging" : "Next"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
