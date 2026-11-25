"use client"

import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react"
import type { AnalysisResult, Severity } from "@/lib/code-analyzer"
import { cn } from "@/lib/utils"

const META: Record<Exclude<Severity, "success">, { label: string; icon: typeof Info; text: string }> = {
  error: { label: "Error", icon: XCircle, text: "text-destructive" },
  warning: { label: "Warning", icon: AlertTriangle, text: "text-warning" },
  info: { label: "Suggestion", icon: Info, text: "text-brand" },
}
const ORDER = { error: 0, warning: 1, info: 2 } as const

interface ErrorPanelProps {
  result: AnalysisResult
  className?: string
}

/** Real analyzer output for the current code: severity, line, rule, message and fix. */
export function ErrorPanel({ result, className }: ErrorPanelProps) {
  const issues = result.issues
    .filter((i): i is typeof i & { severity: keyof typeof META } => i.severity !== "success")
    .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.line - b.line)

  return (
    <section aria-label="Analysis results" className={cn("flex min-h-0 flex-col bg-surface", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Issues ({issues.length})</h2>
        <p className="font-mono text-sm tabular-nums">
          {result.score}
          <span className="text-muted-foreground">/100</span>
        </p>
      </div>

      <div aria-live="polite" className="scrollbar-thin flex-1 overflow-y-auto">
        {issues.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <CheckCircle2 className="size-7 text-success" aria-hidden />
            <p className="text-sm">No issues found</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {issues.map((issue, i) => {
              const m = META[issue.severity]
              const Icon = m.icon
              return (
                <li key={`${issue.rule}-${issue.line}-${i}`} className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", m.text)} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn("text-xs font-semibold", m.text)}>{m.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">line {issue.line}</span>
                        <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          {issue.rule}
                        </code>
                      </div>
                      <p className="mt-1 text-sm">{issue.message}</p>
                      {issue.fix && <p className="mt-1.5 text-xs text-muted-foreground">Fix: {issue.fix}</p>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
