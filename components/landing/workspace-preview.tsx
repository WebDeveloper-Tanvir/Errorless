"use client"

import { useDeferredValue, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { AlertTriangle, CheckCircle2, Info, RotateCcw, XCircle } from "lucide-react"
import { analyzeCode, type CodeIssue, type Severity } from "@/lib/code-analyzer"
import { cn } from "@/lib/utils"

/**
 * Interactive preview of the debugging workspace. Everything shown here is the
 * output of the real `analyzeCode` static analyzer running in the browser, so
 * visitors can edit the code and see findings change.
 */

const SAMPLES = [
  {
    file: "app.py",
    code: `def add_item(item, items=[]):
    items.append(item)
    return items

def average(values):
    try:
        return sum(values) / len(values)
    except:
        return None

if add_item("a") == None:
    print("empty")
`,
  },
  {
    file: "fetch.js",
    code: `async function loadUser(id) {
  try {
    const res = fetch("/api/users/" + id)
    if (res == null) return
    return eval("(" + res + ")")
  } catch (err) {}
}

while (true) {
  loadUser(1)
}
`,
  },
  {
    file: "Main.java",
    code: `public class Main {
    public static void main(String[] args) {
        try {
            int n = Integer.parseInt(args[0]);
            System.out.println(n);
        } catch (Exception e) {
        }
    }
}
`,
  },
] as const

const SEVERITY: Record<
  Severity,
  { label: string; icon: typeof Info; text: string; dot: string; gutter: string }
> = {
  error: { label: "Error", icon: XCircle, text: "text-destructive", dot: "bg-destructive", gutter: "bg-destructive/15 text-destructive" },
  warning: { label: "Warning", icon: AlertTriangle, text: "text-warning", dot: "bg-warning", gutter: "bg-warning/15 text-warning" },
  info: { label: "Suggestion", icon: Info, text: "text-brand", dot: "bg-brand", gutter: "bg-brand/10 text-brand" },
  success: { label: "Clean", icon: CheckCircle2, text: "text-success", dot: "bg-success", gutter: "" },
}

const ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2, success: 3 }
const LINE_HEIGHT = 22 // px — keep in sync with the textarea + gutter below

interface WorkspacePreviewProps {
  className?: string
  /** Editor/results height in px (desktop). */
  height?: number
}

export function WorkspacePreview({ className, height = 340 }: WorkspacePreviewProps) {
  const reduceMotion = useReducedMotion()
  const [active, setActive] = useState(0)
  const [codes, setCodes] = useState<string[]>(() => SAMPLES.map((s) => s.code))
  const [scrollTop, setScrollTop] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const file = SAMPLES[active].file
  const code = codes[active]
  const deferred = useDeferredValue(code)
  const result = useMemo(() => analyzeCode(deferred, file), [deferred, file])

  const issues = useMemo(
    () =>
      [...result.issues]
        .filter((i) => i.severity !== "success")
        .sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.line - b.line),
    [result],
  )
  const lineSeverity = useMemo(() => {
    const map = new Map<number, Severity>()
    for (const i of issues) {
      const prev = map.get(i.line)
      if (!prev || ORDER[i.severity] < ORDER[prev]) map.set(i.line, i.severity)
    }
    return map
  }, [issues])

  const counts = {
    error: issues.filter((i) => i.severity === "error").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  }
  const lineCount = Math.max(code.split("\n").length, 1)
  const isEdited = code !== SAMPLES[active].code

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    e.preventDefault()
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + SAMPLES.length) % SAMPLES.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface shadow-card ring-1 ring-white/[0.03]",
        className,
      )}
    >
      {/* Window chrome + file tabs */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-elevated/60 px-3 py-2">
        <div className="hidden gap-1.5 sm:flex" aria-hidden>
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
          <span className="size-2.5 rounded-full bg-white/10" />
        </div>
        <div role="tablist" aria-label="Sample files" className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {SAMPLES.map((s, i) => (
            <button
              key={s.file}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              role="tab"
              id={`preview-tab-${i}`}
              aria-selected={active === i}
              aria-controls="preview-panel"
              tabIndex={active === i ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 font-mono text-xs transition-colors",
                active === i
                  ? "bg-background text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.file}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCodes((c) => c.map((v, i) => (i === active ? SAMPLES[i].code : v)))}
          disabled={!isEdited}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">Reset</span>
          <span className="sr-only sm:hidden">Reset sample</span>
        </button>
      </div>

      <div
        id="preview-panel"
        role="tabpanel"
        aria-labelledby={`preview-tab-${active}`}
        className="grid lg:grid-cols-[1.15fr_1fr]"
      >
        {/* Editor */}
        <div className="relative border-b border-border lg:border-b-0 lg:border-r" style={{ height }}>
          <div className="absolute inset-y-0 left-0 w-12 overflow-hidden border-r border-border bg-background/40" aria-hidden>
            <div style={{ transform: `translateY(${-scrollTop}px)`, paddingTop: 12 }}>
              {Array.from({ length: lineCount }, (_, n) => {
                const sev = lineSeverity.get(n + 1)
                return (
                  <div
                    key={n}
                    className={cn(
                      "pr-2 text-right font-mono text-xs text-muted-foreground/60",
                      sev && SEVERITY[sev].gutter,
                    )}
                    style={{ height: LINE_HEIGHT, lineHeight: `${LINE_HEIGHT}px` }}
                  >
                    {n + 1}
                  </div>
                )
              })}
            </div>
          </div>
          <label htmlFor="preview-editor" className="sr-only">
            Editable code for {file}. Analysis updates as you type.
          </label>
          <textarea
            id="preview-editor"
            value={code}
            onChange={(e) => setCodes((c) => c.map((v, i) => (i === active ? e.target.value : v)))}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            className="scrollbar-thin absolute inset-0 resize-none whitespace-pre bg-transparent py-3 pl-16 pr-4 font-mono text-[13px] text-foreground/90 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            style={{ lineHeight: `${LINE_HEIGHT}px`, tabSize: 4 }}
          />
        </div>

        {/* Results */}
        <div className="flex flex-col bg-background/30" style={{ minHeight: height }}>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Analysis</p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
                <span className="text-destructive">{counts.error} errors</span>
                <span className="text-warning">{counts.warning} warnings</span>
                <span className="text-brand">{counts.info} suggestions</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-semibold leading-none tabular-nums">
                {result.score}
                <span className="text-sm text-muted-foreground">/100</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Quality score</p>
            </div>
          </div>

          <div
            aria-live="polite"
            aria-label="Analysis results"
            className="scrollbar-thin flex-1 space-y-2 overflow-y-auto p-3"
            style={{ maxHeight: height - 64 }}
          >
            {issues.length === 0 ? (
              <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-center">
                <CheckCircle2 className="size-6 text-success" aria-hidden />
                <p className="text-sm font-medium">No issues found</p>
                <p className="max-w-[16rem] text-xs text-muted-foreground">
                  The static checks pass. Dev Mode adds AI review for logic, security and performance.
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false} mode="popLayout">
                {issues.slice(0, 8).map((issue) => (
                  <IssueRow key={`${issue.rule}-${issue.line}`} issue={issue} animate={!reduceMotion} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function IssueRow({ issue, animate }: { issue: CodeIssue; animate: boolean }) {
  const s = SEVERITY[issue.severity]
  const Icon = s.icon
  return (
    <motion.div
      layout={animate}
      initial={animate ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={animate ? { opacity: 0, scale: 0.98 } : undefined}
      transition={{ duration: 0.18 }}
      className="rounded-lg border border-border bg-surface/80 p-3"
    >
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 size-4 shrink-0", s.text)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("text-xs font-semibold", s.text)}>{s.label}</span>
            <span className="font-mono text-[11px] text-muted-foreground">line {issue.line}</span>
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {issue.rule}
            </code>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-foreground/90">{issue.message}</p>
          {issue.fix && (
            <p className="mt-1.5 border-l-2 border-brand/40 pl-2 text-xs leading-snug text-muted-foreground">
              <span className="font-medium text-brand">Fix:</span> {issue.fix}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
