"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ClipboardPaste, Eraser, FileUp, FlaskConical, Keyboard, Loader2, RefreshCw, ShieldCheck, Sparkles, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LIMITS } from "@/lib/debug/types"
import { redactSecrets } from "@/lib/debug/redact"
import { detectLanguage } from "@/lib/debug/detect"
import { cn } from "@/lib/utils"
import { CodeInput } from "./code-input"
import { EXAMPLES, EXT_LANGUAGE, FRAMEWORKS, LANGUAGES } from "./constants"
import { ResultsPanel } from "./results-panel"
import { ShortcutsDialog } from "./shortcuts-dialog"
import { useDebugSession } from "./use-debug-session"

const MAX_FILE_BYTES = 200_000
const selectCls =
  "h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"

export function DebugWorkspace() {
  const { state, run, retry, cancel, reset } = useDebugSession()
  const [errorText, setErrorText] = useState("")
  const [code, setCode] = useState("")
  const [context, setContext] = useState("")
  const [language, setLanguage] = useState("auto")
  const [framework, setFramework] = useState<string>(FRAMEWORKS[0])
  const [notice, setNotice] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState(false)
  const [mobileView, setMobileView] = useState<"input" | "results">("input")
  const errorFileRef = useRef<HTMLInputElement>(null)
  const codeFileRef = useRef<HTMLInputElement>(null)
  const submittedCode = useRef("")

  // Hand-off from the public tool pages: text the visitor already pasted there.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("errorless:prefill")
      if (!raw) return
      window.sessionStorage.removeItem("errorless:prefill")
      const p = JSON.parse(raw) as Record<string, unknown>
      const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")
      if (str(p.errorText, 1)) setErrorText(str(p.errorText, LIMITS.errorText))
      if (str(p.code, 1)) setCode(str(p.code, LIMITS.code))
      if (LANGUAGES.some((l) => l.value === p.language)) setLanguage(p.language as string)
      if ((FRAMEWORKS as readonly string[]).includes(p.framework as string)) setFramework(p.framework as string)
    } catch {
      /* ignore malformed hand-off data */
    }
  }, [])

  const running = state.phase === "running"
  const hasOutput = state.phase !== "idle"
  const canRun = errorText.trim().length > 0 && !running

  // Client-side preview of what the server will redact. Display only; the server redacts again.
  const secretKinds = useMemo(() => {
    const f = redactSecrets(`${errorText}\n${code}\n${context}`).findings
    return f.map((x) => x.kind)
  }, [errorText, code, context])

  const analyze = useCallback(() => {
    if (!errorText.trim() || running) return
    submittedCode.current = code
    setMobileView("results")
    void run({ errorText, code, language, framework, context })
  }, [errorText, code, language, framework, context, running, run])

  const pasteError = useCallback(async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (!t.trim()) return setNotice("The clipboard is empty.")
      setErrorText(t.slice(0, LIMITS.errorText))
      setNotice(t.length > LIMITS.errorText ? `Pasted, trimmed to ${LIMITS.errorText.toLocaleString()} characters.` : null)
    } catch {
      setNotice("The browser blocked clipboard access. Paste with Ctrl/⌘+V into the error box instead.")
    }
  }, [])

  const loadExample = useCallback((i?: number) => {
    const ex = EXAMPLES[i ?? Math.floor(Math.random() * EXAMPLES.length)]
    setErrorText(ex.errorText); setCode(ex.code); setLanguage(ex.language); setFramework(ex.framework); setContext("")
    setNotice(null); reset()
  }, [reset])

  const clearAll = useCallback(() => {
    setErrorText(""); setCode(""); setContext(""); setNotice(null); reset(); setMobileView("input")
  }, [reset])

  async function readFile(file: File | undefined, kind: "error" | "code") {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) return setNotice(`${file.name} is larger than ${MAX_FILE_BYTES / 1000} KB. Paste the relevant part instead.`)
    const text = await file.text()
    if (text.includes("\u0000")) return setNotice(`${file.name} looks like a binary file. Only text files are supported.`)
    if (kind === "error") setErrorText(text.slice(0, LIMITS.errorText))
    else {
      setCode(text.slice(0, LIMITS.code))
      const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
      if (EXT_LANGUAGE[ext]) setLanguage(EXT_LANGUAGE[ext])
    }
    setNotice(null)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey
    if (showKeys) return
    if (mod && e.key === "Enter") { e.preventDefault(); e.stopPropagation(); analyze() }
    else if (e.key === "Escape" && running) { e.preventDefault(); cancel() }
    else if (e.altKey && e.key.toLowerCase() === "v") { e.preventDefault(); void pasteError() }
    else if (e.altKey && e.key.toLowerCase() === "e") { e.preventDefault(); loadExample() }
    else if (e.altKey && e.key === "Backspace") { e.preventDefault(); clearAll() }
    else if (e.altKey && e.key === "/") { e.preventDefault(); setShowKeys(true) }
  }

  // Window-level so shortcuts work wherever focus is (including inside Monaco, which handles keys in capture).
  const keyRef = useRef(onKeyDown)
  keyRef.current = onKeyDown
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener("keydown", h, true)
    return () => window.removeEventListener("keydown", h, true)
  }, [])

  const guessed = useMemo(() => (language === "auto" ? detectLanguage(errorText, code)?.language : undefined), [language, errorText, code])
  const monacoLang = LANGUAGES.find((l) => l.value === (guessed ?? language))?.monaco ?? "plaintext"

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {/* Mobile view switch */}
      {hasOutput && (
        <div role="tablist" aria-label="Workspace view" className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1 lg:hidden">
          {(["input", "results"] as const).map((v) => (
            <button key={v} role="tab" aria-selected={mobileView === v} onClick={() => setMobileView(v)}
              className={cn("rounded-md py-2 text-sm font-medium capitalize", mobileView === v ? "bg-surface-elevated text-foreground ring-1 ring-border" : "text-muted-foreground")}>
              {v}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* INPUT */}
        <div className={cn("min-w-0 space-y-4", hasOutput && mobileView !== "input" && "hidden lg:block")}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="dbg-lang">Language</label>
            <select id="dbg-lang" className={selectCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="dbg-fw">Framework</label>
            <select id="dbg-fw" className={selectCls} value={framework} onChange={(e) => setFramework(e.target.value)}>
              {FRAMEWORKS.map((f) => <option key={f}>{f}</option>)}
            </select>
            <div className="ml-auto flex gap-1.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowKeys(true)} aria-label="Keyboard shortcuts">
                <Keyboard className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="dbg-error" className="text-sm font-medium text-foreground">Error message <span className="text-rose-400" aria-hidden>*</span></label>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={pasteError}><ClipboardPaste className="h-4 w-4" aria-hidden />Paste</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => errorFileRef.current?.click()}><FileUp className="h-4 w-4" aria-hidden />Error file</Button>
                <input ref={errorFileRef} type="file" accept=".log,.txt,.out,.err,text/plain" className="sr-only" tabIndex={-1} aria-label="Upload error log file"
                  onChange={(e) => { void readFile(e.target.files?.[0], "error"); e.target.value = "" }} />
              </div>
            </div>
            <textarea
              id="dbg-error"
              value={errorText}
              onChange={(e) => setErrorText(e.target.value.slice(0, LIMITS.errorText))}
              rows={8}
              spellCheck={false}
              placeholder="Paste an error, stack trace, log, or API, database, Docker or dependency error…"
              className="min-h-40 w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
            <p className="mt-1 text-right font-mono text-xs text-muted-foreground">{errorText.length.toLocaleString()} / {LIMITS.errorText.toLocaleString()}</p>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span id="dbg-code-label" className="text-sm font-medium text-foreground">Code or config <span className="text-xs font-normal text-muted-foreground">(optional, but gives better answers)</span></span>
              <Button type="button" variant="outline" size="sm" onClick={() => codeFileRef.current?.click()}><FileUp className="h-4 w-4" aria-hidden />Code file</Button>
              <input ref={codeFileRef} type="file" className="sr-only" tabIndex={-1} aria-label="Upload code file"
                accept={Object.keys(EXT_LANGUAGE).map((x) => `.${x}`).join(",")}
                onChange={(e) => { void readFile(e.target.files?.[0], "code"); e.target.value = "" }} />
            </div>
            <CodeInput value={code} onChange={setCode} language={monacoLang} maxLength={LIMITS.code} label="Code" />
          </div>

          <div>
            <label htmlFor="dbg-ctx" className="mb-1.5 block text-sm font-medium text-foreground">Extra context <span className="text-xs font-normal text-muted-foreground">(optional)</span></label>
            <textarea id="dbg-ctx" value={context} onChange={(e) => setContext(e.target.value.slice(0, LIMITS.context))} rows={2}
              placeholder="Versions, what you changed last, what you already tried…"
              className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60" />
          </div>

          {secretKinds.length > 0 && (
            <p role="note" className="flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs text-emerald-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Possible secrets detected ({Array.from(new Set(secretKinds)).join(", ")}). They are masked before anything is sent to the AI.
            </p>
          )}
          {notice && <p role="status" className="flex gap-2 text-xs text-amber-300"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{notice}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <Button type="button" variant="outline" onClick={cancel}><Square className="h-4 w-4" aria-hidden />Cancel</Button>
            ) : (
              <Button type="button" variant="gradient" onClick={analyze} disabled={!canRun}><Sparkles className="h-4 w-4" aria-hidden />Analyze error</Button>
            )}
            <Button type="button" variant="outline" onClick={() => loadExample()}><FlaskConical className="h-4 w-4" aria-hidden />Example</Button>
            <Button type="button" variant="ghost" onClick={clearAll}><Eraser className="h-4 w-4" aria-hidden />Clear</Button>
            <span className="ml-auto hidden text-xs text-muted-foreground sm:inline"><kbd className="font-mono">Ctrl/⌘ + Enter</kbd></span>
          </div>
        </div>

        {/* RESULTS */}
        <div className={cn("min-w-0", !hasOutput && "hidden lg:block", hasOutput && mobileView !== "results" && "hidden lg:block")} aria-live="polite">
          {state.phase === "idle" && (
            <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center">
              <Sparkles className="mb-3 h-8 w-8 text-primary" aria-hidden />
              <p className="text-sm font-medium text-foreground">Your analysis appears here</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">Paste an error, add the code that causes it if you can, then press Analyze. Results come from AI reasoning and are not executed.</p>
            </div>
          )}

          {running && !state.partial?.rootCause?.statement && (
            <div role="status" className="mb-4 flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium text-foreground">Analyzing your error…</p>
                <p className="text-xs text-muted-foreground">Reading the stack trace and matching it to your code.</p>
              </div>
              <div className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-surface-elevated"><div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-primary to-secondary" /></div>
            </div>
          )}

          {state.phase === "error" && state.error && (
            <div role="alert" className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-rose-200"><AlertTriangle className="h-4 w-4" aria-hidden />Analysis failed</p>
              <p className="mt-1 text-sm text-rose-100/80">{state.error.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {state.error.retryable && <Button type="button" size="sm" variant="outline" onClick={retry}><RefreshCw className="h-4 w-4" aria-hidden />Retry</Button>}
                {state.error.upgrade && <Button asChild size="sm" variant="gradient"><a href="/pricing">See plans</a></Button>}
              </div>
            </div>
          )}

          {(state.partial || state.result) && (
            <ResultsPanel
              result={state.result}
              partial={state.partial}
              originalCode={submittedCode.current}
              language={language}
              framework={framework}
              onRetry={retry}
              streaming={running}
            />
          )}
          {state.model && state.phase === "done" && <p className="mt-3 text-right font-mono text-xs text-muted-foreground">model: {state.model} · nothing was executed</p>}
        </div>
      </div>
      <ShortcutsDialog open={showKeys} onOpenChange={setShowKeys} />
    </div>
  )
}
