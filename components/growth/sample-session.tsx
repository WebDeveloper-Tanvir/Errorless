"use client"

import { useState } from "react"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CodeBlock } from "@/components/seo/code-block"
import { ResultsPanel } from "@/components/debug/results-panel"
import { track } from "@/lib/analytics"
import { SHOWCASE } from "@/lib/growth/showcase"

/**
 * Guest demo: a full debugging session with no sign-up. The result is a pre-written example
 * and is labelled as such; it is not generated live and no server or AI call is made.
 */
export function SampleSession() {
  const [slug, setSlug] = useState(SHOWCASE[0].slug)
  const [ran, setRan] = useState(false)
  const entry = SHOWCASE.find((e) => e.slug === slug) ?? SHOWCASE[0]

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <label htmlFor="sample-pick" className="text-sm font-medium text-foreground">Sample problem</label>
        <select id="sample-pick" value={slug} onChange={(e) => { setSlug(e.target.value); setRan(false) }}
          className="h-9 w-full max-w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground sm:w-auto">
          {SHOWCASE.map((e) => <option key={e.slug} value={e.slug}>{e.title}</option>)}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CodeBlock label="1. The error you would paste" code={entry.error} tone="bad" />
        <CodeBlock label={`2. The code (${entry.codeFile})`} code={entry.code} />
      </div>

      {!ran ? (
        <Button type="button" onClick={() => { setRan(true); track("demo_start", { slug: entry.slug, language: entry.language }); track("demo_result", { slug: entry.slug, matched: true, used_code: true }) }}>
          <Play className="h-4 w-4" aria-hidden /> Show the debugging result
        </Button>
      ) : (
        <div className="space-y-3">
          <p role="note" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
            This is a pre-written sample so you can see the format. It was not generated live and nothing was run. Sign in to analyze your own error.
          </p>
          <ResultsPanel result={entry.result} partial={null} originalCode={entry.code} language={entry.language} framework={entry.framework}
            streaming={false} readOnly feedbackSurface="guest_demo" />
        </div>
      )}
    </div>
  )
}
