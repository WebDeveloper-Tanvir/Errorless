"use client"

import { useState } from "react"
import { AlertTriangle, Check, CheckCircle2, Copy, HelpCircle, Lightbulb, RefreshCw, SearchCheck, ShieldAlert, Terminal, ThumbsDown, ThumbsUp, Wrench } from "lucide-react"
import type { Certainty, DebugResult } from "@/lib/debug/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DiffView } from "./diff-view"
import { sendFeedback } from "./use-debug-session"

const CERTAINTY: Record<Certainty, { label: string; hint: string; cls: string }> = {
  confirmed: { label: "Confirmed", hint: "Directly supported by evidence in what you submitted", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  likely: { label: "Likely", hint: "Probable, but not fully proven by the input", cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  hypothesis: { label: "Hypothesis", hint: "A reasoned guess. Verify before acting", cls: "border-secondary/50 bg-secondary/10 text-violet-300" },
}

function Card({ title, icon: Icon, children, className }: { title: string; icon: typeof Wrench; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("rounded-xl border border-border bg-surface p-4 sm:p-5", className)}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden /> {title}
      </h3>
      {children}
    </section>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle")
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setState("ok")
        } catch {
          setState("fail")
        }
        setTimeout(() => setState("idle"), 2000)
      }}
    >
      {state === "ok" ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      <span aria-live="polite">{state === "ok" ? "Copied" : state === "fail" ? "Copy blocked" : label}</span>
    </Button>
  )
}

interface Props {
  result: DebugResult | null
  partial: Partial<DebugResult> | null
  originalCode: string
  language: string
  framework: string
  onRetry: () => void
  streaming: boolean
}

export function ResultsPanel({ result, partial, originalCode, language, framework, onRetry, streaming }: Props) {
  const r: Partial<DebugResult> = result ?? partial ?? {}
  const done = !!result
  const [vote, setVote] = useState<null | "sent" | "failed">(null)
  const [comment, setComment] = useState("")
  const [pending, setPending] = useState<null | boolean>(null)

  const cert = r.rootCause?.certainty ? CERTAINTY[r.rootCause.certainty] : null
  const evidence = r.evidence ?? []
  const fix = r.fix ?? null
  const unverified = evidence.filter((e) => e.verified === false).length

  async function submit(helpful: boolean) {
    const ok = await sendFeedback({ helpful, certainty: r.rootCause?.certainty ?? "hypothesis", language, framework, comment: comment.trim() || undefined })
    setVote(ok ? "sent" : "failed")
  }

  return (
    <div className="space-y-4" aria-busy={streaming}>
      {r.status === "needs_context" && (
        <div role="status" className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>There isn&apos;t enough information to be sure. Answer the questions below, add them to the extra context box, and run again.</p>
        </div>
      )}

      {r.rootCause?.statement && (
        <Card title="Root cause" icon={SearchCheck}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {cert && (
              <span title={cert.hint} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", cert.cls)}>
                {cert.label}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{cert?.hint}</span>
          </div>
          <p className="text-sm leading-6 text-foreground">{r.rootCause.statement}</p>
          {r.rootCause.basis && <p className="mt-2 text-sm leading-6 text-muted-foreground">Basis: {r.rootCause.basis}</p>}
          {r.explanation && <p className="mt-3 border-t border-border pt-3 text-sm leading-6 text-muted-foreground">{r.explanation}</p>}
        </Card>
      )}

      {evidence.length > 0 && (
        <Card title="Evidence" icon={Lightbulb}>
          {unverified > 0 && done && (
            <p role="note" className="mb-3 flex gap-2 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {unverified} quote{unverified === 1 ? "" : "s"} could not be found in your input, so no line number is shown. Treat {unverified === 1 ? "it" : "them"} with caution.
            </p>
          )}
          <ul className="space-y-3">
            {evidence.map((e, i) => (
              <li key={i} className="rounded-lg border border-border bg-background p-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-muted-foreground">{e.source === "code" ? "code" : "error"}</span>
                  {e.line != null && <span className="font-mono text-primary">line {e.line}</span>}
                  {e.verified === true && <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" aria-hidden />found in your input</span>}
                  {e.verified === false && <span className="inline-flex items-center gap-1 text-amber-300"><ShieldAlert className="h-3 w-3" aria-hidden />not found in your input</span>}
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-foreground">{e.quote}</pre>
                {e.note && <p className="mt-1.5 text-sm text-muted-foreground">{e.note}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {fix && (fix.summary || fix.correctedCode) && (
        <Card title="Suggested fix" icon={Wrench}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {fix.risk && (
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", fix.risk === "low" ? "border-emerald-500/40 text-emerald-300" : fix.risk === "medium" ? "border-amber-500/40 text-amber-300" : "border-rose-500/40 text-rose-300")}>
                {fix.risk} risk
              </span>
            )}
            <span className="text-xs text-muted-foreground">Suggestion only. Your code is never changed automatically.</span>
          </div>
          {fix.summary && <p className="mb-3 text-sm leading-6 text-foreground">{fix.summary}</p>}

          {fix.changes?.length > 0 && (
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground marker:text-primary">
              {fix.changes.map((c, i) => (
                <li key={i}>{c.line != null && <span className="font-mono text-primary">line {c.line}: </span>}{c.description}</li>
              ))}
            </ol>
          )}
          {fix.steps?.length > 0 && (
            <div className="mb-3">
              <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Steps</h4>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground marker:text-primary">
                {fix.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )}

          {fix.correctedCode && done && (
            <>
              <DiffView before={originalCode} after={fix.correctedCode} />
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={fix.correctedCode} label="Copy fix" />
              </div>
            </>
          )}
          {fix.correctedCode && !done && <p className="text-xs text-muted-foreground">Preparing the before/after comparison…</p>}
        </Card>
      )}

      {(r.verification?.length ?? 0) > 0 && (
        <Card title="How to verify" icon={Terminal}>
          <p className="mb-2 text-xs text-muted-foreground">Errorless has not run any of these. Run them yourself to confirm the fix.</p>
          <ul className="space-y-2">
            {r.verification!.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <code className="min-w-0 overflow-x-auto whitespace-pre font-mono text-xs text-foreground">{c}</code>
                <CopyButton text={c} label="Copy" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(r.missingContext?.length ?? 0) > 0 && (
        <Card title="Missing context" icon={HelpCircle}>
          <ul className="space-y-2 text-sm">
            {r.missingContext!.map((m, i) => (
              <li key={i}>
                <p className="text-foreground">{m.question}</p>
                {m.why && <p className="text-muted-foreground">Why it matters: {m.why}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(r.hypotheses?.length ?? 0) > 0 && (
        <Card title="Other possibilities (unconfirmed)" icon={HelpCircle}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-secondary">
            {r.hypotheses!.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </Card>
      )}

      {(r.warnings?.length ?? 0) > 0 && (
        <div role="note" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          <ul className="space-y-1">{r.warnings!.map((w, i) => <li key={i}>⚠ {w}</li>)}</ul>
        </div>
      )}

      {done && (
        <section aria-label="Feedback" className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground" id="helpful-label">Was this helpful?</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-4 w-4" aria-hidden /> Try again
              </Button>
              {vote === "sent" ? (
                <span role="status" className="inline-flex items-center gap-1.5 px-2 text-sm text-emerald-400"><Check className="h-4 w-4" aria-hidden />Thanks for the feedback</span>
              ) : (
                <>
                  <Button type="button" variant="outline" size="sm" aria-pressed={pending === true} onClick={() => setPending(true)}>
                    <ThumbsUp className="h-4 w-4" aria-hidden /> Yes
                  </Button>
                  <Button type="button" variant="outline" size="sm" aria-pressed={pending === false} onClick={() => setPending(false)}>
                    <ThumbsDown className="h-4 w-4" aria-hidden /> No
                  </Button>
                </>
              )}
            </div>
          </div>
          {pending !== null && vote !== "sent" && (
            <div className="mt-3 space-y-2">
              <label htmlFor="fb-comment" className="text-xs text-muted-foreground">Optional comment. Don&apos;t include code or secrets.</label>
              <textarea
                id="fb-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
                rows={2}
                className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              />
              <div className="flex items-center gap-3">
                <Button type="button" size="sm" onClick={() => submit(pending)}>Send feedback</Button>
                {vote === "failed" && <span role="alert" className="text-xs text-rose-400">Could not send. Try again.</span>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
