"use client"

import { useId, useState } from "react"
import { Check, ThumbsDown, ThumbsUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FEEDBACK } from "@/lib/growth/config"
import { sendGuestFeedback, type FeedbackSurface } from "./client"

/** Helpful / not helpful plus an optional comment. Works for signed-out visitors. */
export function FeedbackWidget({ surface, question = "Was this helpful?" }: { surface: FeedbackSurface; question?: string }) {
  const id = useId()
  const [pending, setPending] = useState<null | boolean>(null)
  const [comment, setComment] = useState("")
  const [state, setState] = useState<"idle" | "sent" | "failed">("idle")

  if (state === "sent") {
    return (
      <p role="status" className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
        <Check className="h-4 w-4" aria-hidden /> Thanks for the feedback
      </p>
    )
  }
  return (
    <section aria-label="Feedback" className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{question}</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" aria-pressed={pending === true} onClick={() => setPending(true)}>
            <ThumbsUp className="h-4 w-4" aria-hidden /> Helpful
          </Button>
          <Button type="button" variant="outline" size="sm" aria-pressed={pending === false} onClick={() => setPending(false)}>
            <ThumbsDown className="h-4 w-4" aria-hidden /> Not helpful
          </Button>
        </div>
      </div>
      {pending !== null && (
        <div className="mt-3 space-y-2">
          <label htmlFor={id} className="text-xs text-muted-foreground">Optional comment. Please don&apos;t include code or secrets.</label>
          <textarea
            id={id}
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, FEEDBACK.maxComment))}
            rows={2}
            className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          />
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={async () => setState((await sendGuestFeedback(surface, pending, comment)) ? "sent" : "failed")}>
              Send feedback
            </Button>
            {state === "failed" && <span role="alert" className="text-xs text-rose-400">Could not send. Try again.</span>}
          </div>
        </div>
      )}
    </section>
  )
}
