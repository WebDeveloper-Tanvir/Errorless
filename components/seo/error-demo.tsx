"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useAuth } from "@clerk/nextjs"
import { AlertTriangle, CheckCircle2, FlaskConical, Info, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { analyzeCode, type CodeIssue } from "@/lib/code-analyzer"
import { track } from "@/lib/analytics"
import { extractLocation, matchKnownErrors, type Match } from "@/lib/seo/match-error"
import type { KnownError } from "@/lib/seo/tools"
import { CodeBlock } from "./code-block"

export const PREFILL_KEY = "errorless:prefill"

interface Props {
  slug: string
  label: string
  errors: KnownError[]
  demoError: string
  demoCode?: string
  analyzerExt?: "py" | "js" | "ts" | "tsx" | "jsx"
  debugLanguage: string
  debugFramework: string
}

interface Outcome {
  matches: Match[]
  location: { file: string; line: number } | null
  issues: CodeIssue[]
  ranStatic: boolean
}

/**
 * The working demo on every tool page. Two real, local checks, no server call, no AI:
 *  1. the error is matched against the patterns documented on the page;
 *  2. optional code is run through Errorless' in-browser static analyzer.
 * Full AI analysis lives in Dev Mode; the button hands the pasted text over via sessionStorage.
 */
export function ErrorDemo({ slug, label, errors, demoError, demoCode, analyzerExt, debugLanguage, debugFramework }: Props) {
  const [errorText, setErrorText] = useState("")
  const [code, setCode] = useState("")
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const started = useRef(false)
  const { isSignedIn } = useAuth()

  const markStarted = useCallback(() => {
    if (started.current) return
    started.current = true
    track("demo_start", { slug, language: debugLanguage })
  }, [slug, debugLanguage])

  const run = useCallback(() => {
    markStarted()
    const matches = matchKnownErrors(errors, errorText)
    const ranStatic = !!analyzerExt && code.trim().length > 0
    const issues = ranStatic ? analyzeCode(code, `snippet.${analyzerExt}`).issues.filter((i) => i.severity !== "success").slice(0, 6) : []
    setOutcome({ matches, location: extractLocation(errorText), issues, ranStatic })
    track("demo_result", { slug, matched: matches.length > 0, matches: matches.length, static_issues: issues.length, used_code: ranStatic })
  }, [errors, errorText, code, analyzerExt, slug, markStarted])

  const loadExample = () => {
    markStarted()
    setErrorText(demoError)
    setCode(demoCode ?? "")
    setOutcome(null)
  }

  const handoff = () => {
    try {
      window.sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ errorText, code, language: debugLanguage, framework: debugFramework }))
    } catch {
      /* private mode: the user can paste again */
    }
  }

  const issueCount = useMemo(() => outcome?.issues.length ?? 0, [outcome])

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`err-${slug}`} className="mb-1.5 block text-sm font-medium">Paste your {label} error</label>
          <textarea
            id={`err-${slug}`}
            value={errorText}
            onChange={(e) => { markStarted(); setErrorText(e.target.value.slice(0, 5000)) }}
            rows={7}
            spellCheck={false}
            placeholder="Paste the error message or traceback here…"
            className="min-h-40 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          />
        </div>
        {analyzerExt ? (
          <div className="min-w-0">
            <label htmlFor={`code-${slug}`} className="mb-1.5 block text-sm font-medium">
              Code <span className="text-xs font-normal text-muted-foreground">(optional, checked locally)</span>
            </label>
            <textarea
              id={`code-${slug}`}
              value={code}
              onChange={(e) => { markStarted(); setCode(e.target.value.slice(0, 20000)) }}
              rows={7}
              spellCheck={false}
              placeholder="Paste the code that fails…"
              className="min-h-40 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </div>
        ) : (
          <div className="flex items-center rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Info className="mr-2 size-4 shrink-0" aria-hidden />
            The pattern explainer reads error text only. To analyse a {label} file or statement, use Dev Mode below.
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="gradient" onClick={run} disabled={!errorText.trim() && !code.trim()}>
          <Sparkles className="size-4" aria-hidden /> Explain this error
        </Button>
        <Button type="button" variant="outline" onClick={loadExample}>
          <FlaskConical className="size-4" aria-hidden /> Load an example
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setErrorText(""); setCode(""); setOutcome(null) }}>Clear</Button>
        <p className="ml-auto text-xs text-muted-foreground">Runs in your browser. Nothing you paste here is uploaded.</p>
      </div>

      <div aria-live="polite" className="mt-5 min-h-6">
        {outcome && (
          <div className="space-y-4">
            {outcome.location && (
              <p className="text-sm text-muted-foreground">
                Failing location in the trace: <code className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-foreground">{outcome.location.file}:{outcome.location.line}</code>
              </p>
            )}

            {outcome.matches.length > 0 ? (
              outcome.matches.map((m) => (
                <article key={m.id} className="rounded-xl border border-border bg-surface p-4">
                  <h3 className="flex items-start gap-2 text-sm font-semibold">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden /> {m.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6"><span className="font-medium">Why it happens: </span><span className="text-muted-foreground">{m.why}</span></p>
                  <p className="mt-2 text-sm leading-6"><span className="font-medium">How to fix it: </span><span className="text-muted-foreground">{m.fix}</span></p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <CodeBlock code={m.before} label="Before" tone="bad" />
                    <CodeBlock code={m.after} label="After" tone="good" />
                  </div>
                  <a href={`#err-${m.id}`} className="mt-3 inline-block text-xs text-brand underline-offset-4 hover:underline">Read the full guide for this error</a>
                </article>
              ))
            ) : errorText.trim() ? (
              <p role="status" className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                This error does not match any of the {errors.length} patterns documented on this page, so no explanation is shown rather than a guess. Dev Mode can analyse it with your code.
              </p>
            ) : null}

            {outcome.ranStatic && (
              <section aria-label="Static code check" className="rounded-xl border border-border bg-surface p-4">
                <h3 className="text-sm font-semibold">Static check of your code ({issueCount} finding{issueCount === 1 ? "" : "s"})</h3>
                {issueCount === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">The local checker found nothing obvious. That does not prove the code is correct.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {outcome.issues.map((i, n) => (
                      <li key={n} className="text-muted-foreground">
                        <span className="font-mono text-primary">line {i.line}</span> · <span className="text-foreground">{i.message}</span>
                        {i.fix && <span className="block text-xs">Suggestion: {i.fix}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-elevated/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                This was a pattern-based explanation. For the root cause in <em>your</em> code, with evidence quoted from it, a confidence level and a minimal fix, use AI analysis in Dev Mode (plan required).
              </p>
              <Button asChild variant="gradient" className="shrink-0">
                <Link href={isSignedIn ? "/devmode" : "/sign-up?redirect_url=%2Fdevmode"} onClick={handoff}>
                  {isSignedIn ? "Open in Dev Mode" : "Sign up to analyse with AI"}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
