"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
import { UpiPayment } from "@/components/upi-payment"
import { DebugWorkspace } from "@/components/debug/debug-workspace"
import { AlertTriangle, BarChart3, Brain, Check, Copy, Crown, Download, FileCode2, Gauge, Lightbulb, Loader2, Lock, Minus, RefreshCw, ScanSearch, ShieldCheck, Sparkles, Upload, X, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Plan = "none" | "basic" | "premium"
type Tab = "debug" | "generate" | "analyze" | "optimize"
type UploadedFile = { name: string; content: string; language: string }

const PLANS = {
  basic: {
    id: "basic", name: "Basic", price: "$2.5", priceINR: "₹209",
    amountPaise: 20900, color: "#00cfff",
    features: [
      { text: "Code Generation", ok: true },
      { text: "Code Analysis", ok: true },
      { text: "Code Optimization", ok: false },
      { text: "24-hour memory only", ok: true, italic: true },
      { text: "Permanent memory", ok: false },
    ],
    desc: "Generate & analyze code. Memory auto-resets every 24 hours.",
  },
  premium: {
    id: "premium", name: "Premium", price: "$5", priceINR: "₹419",
    amountPaise: 41900, color: "#8b5cf6",
    features: [
      { text: "Code Generation", ok: true },
      { text: "Code Analysis", ok: true },
      { text: "Code Optimization", ok: true },
      { text: "Permanent memory saved", ok: true },
      { text: "Priority AI processing", ok: true },
    ],
    desc: "Full access: generate, analyze, optimize + permanent memory.",
  },
}

function detectLanguage(filename: string, content: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  const m: Record<string, string> = {
    py: "python", js: "javascript", ts: "typescript", tsx: "typescript",
    jsx: "javascript", java: "java", cpp: "cpp", c: "c", cs: "csharp",
    rs: "rust", go: "go", rb: "ruby", php: "php", swift: "swift",
    kt: "kotlin", r: "r", lua: "lua", sh: "bash", html: "html", css: "css",
  }
  if (m[ext]) return m[ext]
  if (content.includes("def ") && content.includes(":")) return "python"
  if (content.includes("function") || content.includes("const ")) return "javascript"
  return "text"
}

const STORAGE_KEY = "errorless_devmode_v1"
function saveMemory(plan: Plan, data: object) {
  if (plan === "none") return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, plan, ts: Date.now() })) } catch {}
}
function loadMemory(plan: Plan) {
  if (plan === "none") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (plan === "basic" && Date.now() - p.ts > 86400000) {
      localStorage.removeItem(STORAGE_KEY); return null
    }
    return p
  } catch { return null }
}

// ─── Presentational helpers ─────────────────────────────────────────────────
function OutputPanel({ title, icon: Icon, text, actions, children }: { title: string; icon: LucideIcon; text?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
  <section aria-label={title} className="flex min-h-0 flex-1 flex-col">
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-brand" aria-hidden />{title}</h2>
      {text && actions}
    </div>
    <div aria-live="polite" className="scrollbar-thin flex-1 overflow-auto p-5">{children}</div>
  </section>
  )
}
function Empty({ icon: Icon, text, sub }: { icon: LucideIcon; text: string; sub: string }) {
  return (
  <div className="flex h-full min-h-56 flex-col items-center justify-center gap-2 text-center">
    <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20"><Icon className="size-6" aria-hidden /></span>
    <p className="mt-2 font-medium">{text}</p>
    <p className="text-sm text-muted-foreground">{sub}</p>
  </div>
  )
}
function Busy({ text }: { text: string }) {
  return (
  <div className="flex h-full min-h-56 flex-col items-center justify-center gap-3 text-muted-foreground">
    <Loader2 className="size-7 animate-spin text-brand" aria-hidden /><p className="text-sm">{text}</p>
  </div>
  )
}


export default function DevModePage() {
  const { user, isLoaded } = useUser()
  // The plan lives on the server (Clerk metadata, set when an admin approves a payment).
  const [plan, setPlan] = useState<Plan>("none")
  const [request, setRequest] = useState<{ plan: "basic" | "premium"; status: "pending" | "rejected" } | null>(null)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const planRef = useRef<Plan>("none")
  // Free accounts with invite credits can use the Debug tab. Sticky for the visit so the page
  // does not flip to the paywall (and hide a result) when the last credit is used.
  const [credits, setCredits] = useState(0)
  const [creditMode, setCreditMode] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [selected, setSelected] = useState<"basic" | "premium" | null>(null)
  const [toastMsg, setToastMsg] = useState("")

  const [tab, setTab] = useState<Tab>("debug")
  const [file, setFile] = useState<UploadedFile | null>(null)
  const [prompt, setPrompt] = useState("")
  const [lang, setLang] = useState("python")
  const [generated, setGenerated] = useState("")
  const [analysis, setAnalysis] = useState<Record<string, string> | null>(null)
  const [optimized, setOptimized] = useState("")
  const [loading, setLoading] = useState(false)
  const [drag, setDrag] = useState(false)
  const [copied, setCopied] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = loadMemory(plan)
    if (saved) {
      if (saved.generated) setGenerated(saved.generated)
      if (saved.analysis) setAnalysis(saved.analysis)
      if (saved.optimized) setOptimized(saved.optimized)
    }
  }, [plan])

  useEffect(() => {
    saveMemory(plan, { generated, analysis, optimized })
  }, [generated, analysis, optimized, plan])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(""), 4000)
  }

  const refreshStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/devmode/payment/status")
      if (r.ok) {
        const d = await r.json()
        if (planRef.current === "none" && d.plan !== "none") {
          showToast(`${d.plan === "premium" ? "Premium" : "Basic"} activated. Welcome to Dev Mode.`)
        }
        planRef.current = d.plan
        setPlan(d.plan)
        setCredits(typeof d.credits === "number" ? d.credits : 0)
        if (d.plan === "none" && d.credits > 0) setCreditMode(true)
        setRequest(d.request)
        if (d.plan !== "none") { setUpgrading(false); setSelected(null) }
      }
    } catch { /* offline: keep current state */ }
    setStatusLoaded(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The debug workspace fires this when an analysis finishes, so the credit balance stays current.
  useEffect(() => {
    window.addEventListener("errorless:credits-changed", refreshStatus)
    return () => window.removeEventListener("errorless:credits-changed", refreshStatus)
  }, [refreshStatus])

  useEffect(() => {
    if (!isLoaded) return
    if (user) refreshStatus()
    else setStatusLoaded(true)
  }, [isLoaded, user, refreshStatus])

  const uploadFile = useCallback((f: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setFile({ name: f.name, content, language: detectLanguage(f.name, content) })
      setTab("analyze"); setAnalysis(null); setOptimized("")
    }
    reader.readAsText(f)
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true); setGenerated("")
    try {
      const res = await fetch("/api/devmode/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language: lang, plan }),
      })
      const d = await res.json()
      setGenerated(d.code || d.error || "No response received.")
    } catch { setGenerated("Generation failed. Check connection.") }
    setLoading(false)
  }

  const handleAnalyze = async () => {
    if (!file) return
    setLoading(true); setAnalysis(null)
    try {
      const res = await fetch("/api/devmode/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: file.content, language: file.language, plan }),
      })
      const d = await res.json()
      setAnalysis(d)
    } catch { setAnalysis({ error: "Analysis failed." }) }
    setLoading(false)
  }

  const handleOptimize = async () => {
    if (!file || plan !== "premium") return
    setLoading(true); setOptimized("")
    try {
      const res = await fetch("/api/devmode/optimize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: file.content, language: file.language, analysis }),
      })
      const d = await res.json()
      setOptimized(d.optimized || d.error || "")
    } catch { setOptimized("Optimization failed.") }
    setLoading(false)
  }

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt); setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadFile = (content: string, filename: string) => {
    const b = new Blob([content], { type: "text/plain" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = filename; a.click()
  }

  const isPremium = plan === "premium"
  const paywall = (plan === "none" && !creditMode) || upgrading
  const upgrade = () => { setSelected(null); setUpgrading(true) }

  const toast = toastMsg ? (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-xl border border-brand/30 bg-popover px-4 py-3 text-sm shadow-glow">
      {toastMsg}
    </div>
  ) : null

  // ─── PAYWALL ────────────────────────────────────────────────────────────────
  if (!statusLoaded) return (
    <div className="min-h-screen bg-background">
      <Header />
      <div role="status" className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-brand" aria-hidden /><span className="sr-only">Loading Dev Mode</span>
      </div>
    </div>
  )

  if (paywall) {
    const pending = request?.status === "pending"
    const rejected = request?.status === "rejected"
    const offered = (["basic", "premium"] as const).filter((pid) => !(plan === "basic" && pid === "basic"))
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main id="main" className="bg-mesh">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/10 px-3.5 py-1.5 font-mono text-xs text-brand">
                <Lock className="size-3.5" aria-hidden /> Dev Mode
              </p>
              <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                {plan === "basic" ? <>Upgrade to <span className="brand-gradient">Premium</span></> : <>Unlock <span className="brand-gradient">Dev Mode</span></>}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Generate, analyze and optimize code with AI. Pay with any UPI app.
              </p>
            </div>

            {pending ? (
              <div role="status" className="mx-auto mt-12 max-w-xl rounded-2xl border border-brand/30 bg-card p-8 text-center shadow-card">
                <Loader2 className="mx-auto size-6 animate-spin text-brand" aria-hidden />
                <h2 className="mt-4 text-lg font-semibold">Payment awaiting verification</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  We received your {request?.plan === "premium" ? "Premium" : "Basic"} payment details. Access starts as soon as the payment is verified.
                </p>
                <Button className="mt-6" variant="outline" onClick={refreshStatus}>Check status</Button>
              </div>
            ) : selected ? (
              <div className="mt-12">
                <UpiPayment
                  plan={selected}
                  planName={PLANS[selected].name}
                  amountINR={PLANS[selected].priceINR}
                  onSubmitted={() => { setSelected(null); refreshStatus() }}
                  onBack={() => setSelected(null)}
                />
              </div>
            ) : (
              <>
                {rejected && (
                  <p role="alert" className="mx-auto mt-10 max-w-xl rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center text-sm text-destructive">
                    We couldn&apos;t verify your last payment. Check the transaction ID and submit it again.
                  </p>
                )}
                <div className={cn("mx-auto mt-12 grid max-w-3xl gap-6", offered.length > 1 && "md:grid-cols-2")}>
                  {offered.map((pid) => {
                    const pl = PLANS[pid]
                    const featured = pid === "premium"
                    return (
                      <article key={pid} className={cn("relative flex flex-col rounded-2xl border bg-card p-6 shadow-card", featured ? "border-brand/50 shadow-glow" : "border-border")}>
                        {featured && (
                          <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand-gradient px-3 py-1 text-xs font-semibold text-primary-foreground">
                            <Crown className="size-3" aria-hidden /> Best value
                          </span>
                        )}
                        <h2 className="text-lg font-semibold">{pl.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{pl.desc}</p>
                        <p className="mt-5 flex items-baseline gap-2">
                          <span className="text-4xl font-semibold tracking-tight">{pl.priceINR}</span>
                          <span className="text-sm text-muted-foreground">≈ {pl.price}</span>
                        </p>
                        <ul className="mt-6 flex-1 space-y-3 text-sm">
                          {pl.features.map((f) => (
                            <li key={f.text} className="flex items-start gap-2.5">
                              {f.ok ? <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> : <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" aria-hidden />}
                              <span className={f.ok ? "text-foreground/90" : "text-muted-foreground/70"}>
                                {f.text}{!f.ok && <span className="sr-only"> (not included)</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <Button className="mt-8 w-full" variant={featured ? "default" : "outline"} onClick={() => setSelected(pid)}>
                          Pay {pl.priceINR} with UPI
                        </Button>
                      </article>
                    )
                  })}
                </div>
              </>
            )}

            <p className="mt-10 text-center text-sm">
              {plan === "basic" ? (
                <button type="button" onClick={() => setUpgrading(false)} className="text-brand underline-offset-4 hover:underline">Back to Dev Mode</button>
              ) : (
                <>
                  <Link href="/ide" className="text-brand underline-offset-4 hover:underline">Continue with the free IDE</Link>
                  <span className="mx-2 text-muted-foreground" aria-hidden>·</span>
                  <Link href="/invite" className="text-brand underline-offset-4 hover:underline">Earn free AI analyses by inviting a developer</Link>
                </>
              )}
            </p>
          </div>
        </main>
        {toast}
      </div>
    )
  }

  // ─── WORKSPACE ──────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string; icon: LucideIcon; locked: boolean }[] = [
    { id: "debug", label: "Debug", icon: ScanSearch, locked: false },
    { id: "generate", label: "Generate", icon: Sparkles, locked: plan === "none" },
    { id: "analyze", label: "Analyze", icon: ScanSearch, locked: plan === "none" },
    { id: "optimize", label: "Optimize", icon: RefreshCw, locked: !isPremium },
  ]
  const CARDS: [string, string, LucideIcon][] = [
    ["Summary", "summary", FileCode2],
    ["Complexity", "complexity", BarChart3],
    ["Issues", "issues", AlertTriangle],
    ["Security", "security", ShieldCheck],
    ["Performance", "performance", Gauge],
    ["Suggestions", "suggestions", Lightbulb],
  ]
  const label = "mb-2 block text-xs font-semibold uppercase tracking-widest text-muted-foreground"
  const field = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"

  const outActions = (txt: string, filename: string) => (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => copy(txt)}>{copied ? <Check aria-hidden /> : <Copy aria-hidden />}{copied ? "Copied" : "Copy"}</Button>
      <Button size="sm" variant="outline" onClick={() => downloadFile(txt, filename)}><Download aria-hidden />Save</Button>
    </div>
  )
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse-node rounded-full bg-success" aria-hidden />
          Dev Mode · <span className="font-medium capitalize text-foreground">{plan === "none" ? "free" : plan}</span>
          {plan === "none" && <span>· {credits} AI {credits === 1 ? "credit" : "credits"} left</span>}
        </p>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline"><Link href="/invite">Invite &amp; sharing</Link></Button>
          {plan === "none" && <Button size="sm" variant="gradient" onClick={upgrade}>See plans</Button>}
          {plan === "basic" && <Button size="sm" variant="gradient" onClick={upgrade}>Upgrade to Premium</Button>}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
        <div role="tablist" aria-label="Mode" className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-card p-1">
          {TABS.map(({ id, label: l, icon: Icon, locked }) => (
            <button key={id} role="tab" aria-selected={tab === id} aria-disabled={locked} onClick={() => !locked && setTab(id)}
              title={locked ? (plan === "none" ? "Needs a Dev Mode plan" : "Optimize is a Premium feature") : undefined}
              className={cn("flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors",
                tab === id ? "bg-surface-elevated text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                locked && "cursor-not-allowed opacity-50 hover:text-muted-foreground")}>
              <Icon className="size-4" aria-hidden />{l}{locked && <span className="sr-only"> (Premium)</span>}
            </button>
          ))}
        </div>

      </div>

      {tab === "debug" ? (
        <main id="main"><DebugWorkspace /></main>
      ) : (
      <main id="main" className="mx-auto grid max-w-7xl gap-4 px-4 pb-10 sm:px-6 lg:grid-cols-[22rem_1fr]">
        {/* Controls */}
        <aside className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-card lg:self-start">
          {tab === "generate" && (
            <div>
              <label htmlFor="gen-lang" className={label}>Language</label>
              <select id="gen-lang" className={field} value={lang} onChange={(e) => setLang(e.target.value)}>
                {["python","javascript","typescript","java","c","cpp","rust","go","csharp","ruby","php","swift","kotlin","bash"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <label htmlFor="gen-prompt" className={cn(label, "mt-5")}>What should it build?</label>
              <textarea id="gen-prompt" rows={7} className={cn(field, "resize-none")} value={prompt}
                placeholder="e.g. An Express.js endpoint that authenticates users with JWT"
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate() }} />
              <p className="mt-1.5 text-xs text-muted-foreground">Ctrl+Enter to run</p>
              <Button className="mt-4 w-full" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
                {loading ? <><Loader2 className="animate-spin" aria-hidden />Generating…</> : <><Sparkles aria-hidden />Generate code</>}
              </Button>
            </div>
          )}

          {tab === "analyze" && (
            <div>
              <span className={label}>Code file</span>
              <input ref={fileRef} id="dv-file" type="file" className="sr-only"
                accept=".py,.js,.ts,.tsx,.jsx,.java,.cpp,.c,.cs,.rs,.go,.rb,.php,.swift,.kt,.r,.lua,.sh,.html,.css"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f) }}
                className={cn("rounded-xl border-2 border-dashed p-5 text-center transition-colors", drag ? "border-brand bg-brand/10" : "border-input", file && "border-solid border-brand/30 bg-brand/5")}>
                {file ? (
                  <div className="flex items-center gap-3 text-left">
                    <FileCode2 className="size-6 shrink-0 text-brand" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{file.language} · {file.content.split("\n").length} lines</p>
                    </div>
                    <button type="button" aria-label="Remove file" onClick={() => { setFile(null); setAnalysis(null); setOptimized("") }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-4" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-1.5 rounded-lg py-2">
                    <Upload className="size-6 text-brand" aria-hidden />
                    <span className="text-sm font-medium">Drop a code file or click to browse</span>
                    <span className="text-xs text-muted-foreground">Any common language</span>
                  </button>
                )}
              </div>
              {file && (
                <Button className="mt-4 w-full" onClick={handleAnalyze} disabled={loading}>
                  {loading ? <><Loader2 className="animate-spin" aria-hidden />Analyzing…</> : <><ScanSearch aria-hidden />Analyze code</>}
                </Button>
              )}
            </div>
          )}

          {tab === "optimize" && isPremium && (
            <div>
              <span className={label}>Optimize code</span>
              {!file ? (
                <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">Upload and analyze a file in the <strong className="text-foreground">Analyze</strong> tab first.</p>
              ) : (
                <>
                  <p className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <span className="truncate">{file.name}</span><span className="font-mono text-xs text-muted-foreground">{file.language}</span>
                  </p>
                  {!analysis && <p className="mt-3 text-xs text-muted-foreground">Tip: run Analyze first for better results.</p>}
                  <Button className="mt-4 w-full" onClick={handleOptimize} disabled={loading}>
                    {loading ? <><Loader2 className="animate-spin" aria-hidden />Optimizing…</> : <><RefreshCw aria-hidden />Optimize code</>}
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
            <Brain className="size-5 text-violet-soft" aria-hidden />
            <div>
              <p className="text-sm font-medium">Memory: {isPremium ? "Permanent" : "24 hours"}</p>
              <p className="text-xs text-muted-foreground">{isPremium ? "Sessions are kept in this browser" : "Resets after 24 hours"}</p>
            </div>
          </div>
        </aside>

        {/* Output */}
        <div className="flex min-h-[28rem] flex-col rounded-2xl border border-border bg-surface shadow-card lg:min-h-[36rem]">
          {tab === "generate" && (
            <OutputPanel title={`Generated code · ${lang}`} icon={Sparkles} text={generated} actions={outActions(generated, `generated.${lang === "python" ? "py" : lang === "javascript" ? "js" : lang}`)}>
              {loading ? <Busy text={`Generating ${lang} code…`} /> : !generated ? <Empty icon={Sparkles} text="Describe what you want to build" sub="Supports 14 languages" /> :
                <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6"><code>{generated}</code></pre>}
            </OutputPanel>
          )}

          {tab === "analyze" && (
            <OutputPanel title="Error analysis" icon={ScanSearch}>
              {loading ? <Busy text="Scanning your code…" /> :
                analysis?.error ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{analysis.error}</p> :
                analysis ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {CARDS.map(([title, key, Icon]) => analysis[key] ? (
                      <article key={key} className={cn("rounded-xl border border-border bg-card p-4", (key === "summary" || key === "issues") && "xl:col-span-2")}>
                        <h3 className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-brand" aria-hidden />{title}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{analysis[key]}</p>
                      </article>
                    ) : null)}
                    {!isPremium && (
                      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-violet/30 bg-violet/10 p-4 xl:col-span-2">
                        <Zap className="size-5 text-violet-soft" aria-hidden />
                        <div className="min-w-0 flex-1 text-sm"><strong>Want this code optimized?</strong><p className="text-muted-foreground">Premium unlocks AI-powered optimization.</p></div>
                        <Button size="sm" variant="gradient" onClick={upgrade}>Upgrade</Button>
                      </div>
                    )}
                  </div>
                ) : file ? <Empty icon={FileCode2} text={`${file.name} is ready`} sub="Choose Analyze code to begin" /> :
                <Empty icon={ScanSearch} text="Upload a code file to analyze" sub="Drag and drop any source file" />}
            </OutputPanel>
          )}

          {tab === "optimize" && (
            <OutputPanel title="Optimized code" icon={RefreshCw} text={optimized} actions={outActions(optimized, `optimized_${file?.name || "code"}`)}>
              {loading ? <Busy text="Refactoring your code…" /> : !optimized ? <Empty icon={RefreshCw} text="Choose Optimize code to begin" sub="The AI refactors for performance and clarity" /> :
                <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6"><code>{optimized}</code></pre>}
            </OutputPanel>
          )}
        </div>
      </main>
      )}
      {toast}
    </div>
  )
}
