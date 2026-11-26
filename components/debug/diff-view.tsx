"use client"

import { useMemo, useState } from "react"
import { collapseDiff, lineDiff } from "@/lib/debug/diff"
import { cn } from "@/lib/utils"

type Mode = "diff" | "before" | "after"

/** Before/After comparison. Read-only: Errorless never writes to the user's code. */
export function DiffView({ before, after }: { before: string; after: string }) {
  const [mode, setMode] = useState<Mode>("diff")
  const { rows, added, removed } = useMemo(() => {
    const d = lineDiff(before, after)
    return { rows: collapseDiff(d.ops, 3), added: d.added, removed: d.removed }
  }, [before, after])

  const tabs: { id: Mode; label: string }[] = [
    { id: "diff", label: "Diff" },
    { id: "before", label: "Before" },
    { id: "after", label: "After" },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div role="tablist" aria-label="Code comparison view" className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={mode === t.id}
              onClick={() => setMode(t.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                mode === t.id ? "bg-surface-elevated text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          <span className="text-emerald-400">+{added}</span> <span className="text-rose-400">−{removed}</span>
        </span>
      </div>
      <div className="max-h-96 overflow-auto">
        {mode === "diff" ? (
          <pre className="min-w-max p-0 font-mono text-xs leading-5">
            {rows.map((r, i) =>
              r.type === "gap" ? (
                <div key={i} className="bg-surface-elevated/60 px-3 py-0.5 text-muted-foreground">
                  ⋯ {r.hidden} unchanged line{r.hidden === 1 ? "" : "s"}
                </div>
              ) : (
                <div
                  key={i}
                  className={cn(
                    "flex px-3",
                    r.type === "add" && "bg-emerald-500/10 text-emerald-200",
                    r.type === "del" && "bg-rose-500/10 text-rose-200",
                    r.type === "same" && "text-muted-foreground",
                  )}
                >
                  <span aria-hidden className="w-5 shrink-0 select-none">{r.type === "add" ? "+" : r.type === "del" ? "−" : " "}</span>
                  <span className="sr-only">{r.type === "add" ? "added: " : r.type === "del" ? "removed: " : ""}</span>
                  <span className="whitespace-pre">{r.text || " "}</span>
                </div>
              ),
            )}
          </pre>
        ) : (
          <pre className="min-w-max p-3 font-mono text-xs leading-5 text-foreground">{mode === "before" ? before : after}</pre>
        )}
      </div>
    </div>
  )
}
