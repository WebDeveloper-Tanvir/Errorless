"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useUser } from "@clerk/nextjs"
import {
  AlertCircle, Bot, ChevronDown, Cloud, Cpu, Paperclip, RefreshCw, RotateCcw, Send, Settings2, Square, Trash2, Plus, Sparkles,
} from "lucide-react"
import { ACTIONS, type ActionContext, type ActionId } from "@/lib/ide/ai/actions"
import { LOCAL_MODELS, approxDownloadMB, fmtGB } from "@/lib/ide/ai/models"
import { analyzeCode, formatAnalysisAsMarkdown } from "@/lib/code-analyzer"
import { useIdeChat, type ApplyScope, type UiMessage } from "./use-ide-chat"
import { ChatCodeBlock } from "./chat-code-block"
import { ApplyFixDialog, type PendingApply } from "./apply-fix-dialog"

export interface AssistantContext { ctx: ActionContext; scope?: ApplyScope }
interface Props {
  /** Current editor/terminal context, read at the moment an action runs. */
  getContext: () => AssistantContext
  /** Current content of a file, to build and verify a diff. */
  getFileContent: (fileId: string) => string | null
  /** Writes new content into the editor. Only called after the user confirms the diff. */
  onApply: (fileId: string, next: string) => void
}

const MONO = "'JetBrains Mono', ui-monospace, monospace"
const SUPPORTED_EXTS = [".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".go", ".rs", ".rb", ".php", ".swift", ".html", ".css", ".sql", ".txt", ".md"]

export function ErrorlessChatbotPanel({ getContext, getFileContent, onApply }: Props) {
  const { user } = useUser()
  const chat = useIdeChat(user?.id ?? null)
  const [input, setInput] = useState("")
  const [showSetup, setShowSetup] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingApply | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }) }, [chat.messages])

  const ready = chat.mode === "cloud" || chat.loadedKey !== null
  const needsSetup = !ready && chat.messages.length === 0
  const model = chat.model!

  const submit = useCallback(async () => {
    const t = input.trim()
    if (!t) return
    setInput("")
    const { scope } = getContext()
    await chat.send(t, scope)
  }, [input, chat, getContext])

  const action = async (id: ActionId) => {
    setShowActions(false)
    setNotice(null)
    const { ctx, scope } = getContext()
    const problem = await chat.runAction(id, { ...ctx, prompt: id === "generate" ? input.trim() || undefined : undefined }, scope)
    if (problem) setNotice(problem)
    else if (id === "generate") setInput("")
  }

  const askApply = (m: UiMessage, code: string) => {
    const scope = m.scope
    if (!scope) return setNotice("Open the file you want to change, then ask again so the answer is tied to it.")
    const current = getFileContent(scope.fileId)
    if (current === null) return setNotice(`${scope.fileName} is no longer open.`)
    if (scope.selection) {
      if (current.slice(scope.selection.start, scope.selection.end) !== scope.selection.text) {
        return setNotice("The code changed since this answer was written. Select it again and re-run the action; nothing was changed.")
      }
      setPending({ fileId: scope.fileId, fileName: scope.fileName, before: scope.selection.text, after: code, scopeLabel: "selected code", next: current.slice(0, scope.selection.start) + code + current.slice(scope.selection.end) })
    } else {
      setPending({ fileId: scope.fileId, fileName: scope.fileName, before: current, after: code, scopeLabel: "whole file", next: code })
    }
  }

  const attach = async (f: File) => {
    const ext = "." + (f.name.split(".").pop()?.toLowerCase() ?? "")
    if (f.size > 500 * 1024) return setNotice(`${f.name} is larger than 500 KB.`)
    if (!SUPPORTED_EXTS.includes(ext)) return setNotice(`Unsupported file type ${ext}.`)
    const text = await f.text()
    chat.addNote("Static analysis (rule-based, not AI)", formatAnalysisAsMarkdown(analyzeCode(text, f.name)))
  }

  const pct = Math.round(chat.progress.fraction * 100)
  const status = chat.mode === "cloud" ? { dot: "#8B5CF6", text: "Cloud AI" }
    : chat.loadedKey ? { dot: "#22c55e", text: `Local · ${model.label}` }
    : chat.progress.phase === "downloading" ? { dot: "#ffd166", text: `Loading ${pct}%` }
    : { dot: "#ff4d6d", text: "No model loaded" }

  return (
    <div className="h-full flex flex-col" style={{ background: "#080D18", borderLeft: "1px solid rgba(0,207,255,0.12)", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 shrink-0" style={{ height: 44, borderBottom: "1px solid rgba(0,207,255,0.1)" }}>
        <Bot size={16} color="#00CFFF" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-white leading-4">Errorless Assistant</p>
          <p className="text-[10px] flex items-center gap-1 truncate" style={{ color: "rgba(200,225,255,0.55)" }} aria-live="polite">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} /> {status.text}
            {chat.mode === "local" ? <Cpu size={10} /> : <Cloud size={10} />}
          </p>
        </div>
        <button aria-label="Model and privacy settings" aria-expanded={showSetup} onClick={() => setShowSetup((s) => !s)} className="p-1.5 rounded hover:bg-white/5" style={{ color: showSetup ? "#00CFFF" : "rgba(200,225,255,0.6)" }}><Settings2 size={15} /></button>
      </div>

      {/* Setup */}
      {(showSetup || needsSetup) && (
        <div className="px-3 py-3 space-y-3 overflow-y-auto shrink-0 max-h-[60%]" style={{ borderBottom: "1px solid rgba(0,207,255,0.1)", background: "rgba(0,207,255,0.03)" }}>
          <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }} role="tablist" aria-label="AI mode">
            {(["local", "cloud"] as const).map((m) => (
              <button key={m} role="tab" aria-selected={chat.mode === m} onClick={() => chat.setMode(m)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-md"
                style={chat.mode === m ? { background: "rgba(0,207,255,0.15)", color: "#00CFFF" } : { color: "rgba(200,225,255,0.55)" }}>
                {m === "local" ? <Cpu size={12} /> : <Cloud size={12} />} {m === "local" ? "Local (free)" : "Cloud"}
              </button>
            ))}
          </div>

          {chat.mode === "local" ? (
            <div className="space-y-2 text-[11px]" style={{ color: "rgba(200,225,255,0.7)" }}>
              <p>Runs a small model <b>on your device</b> with WebGPU. No account, no API key, and your code never leaves the browser. The model downloads only when you press the button; the browser then caches it.</p>
              {chat.gpu && !chat.gpu.supported && (
                <p role="alert" className="flex gap-2 rounded-md p-2" style={{ background: "rgba(255,77,109,0.1)", color: "#ff8fa3" }}><AlertCircle size={14} className="shrink-0 mt-0.5" />{chat.gpu.reason} You can still use Cloud mode if your plan includes it.</p>
              )}
              <label className="block">
                <span className="block mb-1 font-semibold text-white">Model</span>
                <select value={chat.modelKey} onChange={(e) => chat.setModelKey(e.target.value)} disabled={chat.progress.phase === "downloading"}
                  className="w-full rounded-md px-2 py-1.5 text-[11px] text-white" style={{ background: "#0b1220", border: "1px solid rgba(0,207,255,0.2)" }}>
                  {LOCAL_MODELS.map((m) => <option key={m.key} value={m.key}>{m.label} · ~{fmtGB(m.vramMB)} GPU memory</option>)}
                </select>
              </label>
              <p>{model.note} Download ≈ {fmtGB(approxDownloadMB(model))}; needs about {fmtGB(model.vramMB)} of free GPU memory{chat.gpu?.adapter ? ` (detected: ${chat.gpu.adapter})` : ""}. Smaller models are faster but make more mistakes.</p>
              {chat.progress.phase === "downloading" && (
                <div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#00CFFF,#8B5CF6)" }} /></div>
                  <p className="mt-1 truncate font-mono" style={{ fontSize: 10 }}>{chat.progress.text}</p>
                </div>
              )}
              {chat.progress.phase === "error" && <p role="alert" className="rounded-md p-2" style={{ background: "rgba(255,77,109,0.1)", color: "#ff8fa3" }}>{chat.progress.text}</p>}
              <div className="flex gap-2">
                <button onClick={() => void chat.loadLocal()} disabled={chat.progress.phase === "downloading" || chat.gpu?.supported === false || chat.loadedKey === chat.modelKey}
                  className="flex-1 py-1.5 rounded-md text-[11px] font-semibold disabled:opacity-40" style={{ background: "#00CFFF", color: "#080D18" }}>
                  {chat.loadedKey === chat.modelKey ? "Loaded" : chat.progress.phase === "downloading" ? "Loading…" : "Download & load"}
                </button>
                {chat.loadedKey && <button onClick={() => void chat.unloadLocal()} className="px-3 py-1.5 rounded-md text-[11px] text-gray-300 hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>Unload</button>}
              </div>
            </div>
          ) : (
            <p className="text-[11px]" style={{ color: "rgba(200,225,255,0.7)" }}>Cloud AI is answered by a server-side model. It needs sign-in and a Dev Mode plan, and has per-minute and daily limits. Your conversation is sent to our server and the model provider (secrets are redacted first). No API key is ever stored in the browser. If it is unavailable you will see the exact reason here.</p>
          )}

          <label className="flex items-start gap-2 text-[11px] cursor-pointer" style={{ color: "rgba(200,225,255,0.7)" }}>
            <input type="checkbox" checked={chat.saveHistory} onChange={(e) => chat.setSaveHistory(e.target.checked)} className="mt-0.5" />
            <span>Remember conversations on this device. Off by default. When on, your questions and the code you sent are saved in this browser only; turning it off deletes them.</span>
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-2 shrink-0 relative" style={{ borderBottom: "1px solid rgba(0,207,255,0.08)" }}>
        <button onClick={() => setShowActions((s) => !s)} aria-expanded={showActions} className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-semibold" style={{ background: "rgba(139,92,246,0.12)", color: "#b79cff", border: "1px solid rgba(139,92,246,0.3)" }}>
          <span className="flex items-center gap-1.5"><Sparkles size={12} /> Assistant actions</span><ChevronDown size={13} />
        </button>
        {showActions && (
          <div className="absolute left-3 right-3 top-full mt-1 z-20 rounded-lg overflow-hidden shadow-xl" style={{ background: "#0b1220", border: "1px solid rgba(0,207,255,0.2)" }} role="menu">
            {ACTIONS.map((a) => (
              <button key={a.id} role="menuitem" onClick={() => void action(a.id)} className="w-full text-left px-3 py-1.5 hover:bg-white/5">
                <span className="block text-[12px] text-white">{a.label}</span><span className="block text-[10px]" style={{ color: "rgba(200,225,255,0.5)" }}>{a.hint}</span>
              </button>
            ))}
          </div>
        )}
        {notice && <p role="status" className="mt-2 text-[11px] flex gap-1.5" style={{ color: "#ffd166" }}><AlertCircle size={13} className="shrink-0" />{notice}</p>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0" aria-live="polite" data-testid="chat-messages">
        {chat.messages.length === 0 && (
          <div className="text-[12px] space-y-2" style={{ color: "rgba(200,225,255,0.65)" }}>
            <p className="text-white font-semibold">Ask about the code in your editor.</p>
            <p>Use <b>Assistant actions</b> for Explain, Find Bugs, Fix This Error, Optimize, Refactor, Documentation, Unit Tests or Terminal output. Answers are suggestions: nothing changes in your files until you review a diff and confirm.</p>
            {!ready && <p style={{ color: "#ffd166" }}>No model is available yet. Open the settings above: download a local model (free), or switch to Cloud if your plan includes it.</p>}
          </div>
        )}
        {chat.messages.map((m, i) => (
          <Message key={m.id} m={m} isLast={i === chat.messages.length - 1} busy={chat.busy} onApply={askApply} onRetry={() => void chat.retry()} onSetup={() => setShowSetup(true)} />
        ))}
        <div ref={end} />
      </div>

      {/* Composer */}
      <div className="px-3 pb-3 pt-2 shrink-0" style={{ borderTop: "1px solid rgba(0,207,255,0.1)" }}>
        <div className="flex items-end gap-1.5 rounded-xl px-2 py-1.5" style={{ background: "#0b1220", border: "1px solid rgba(0,207,255,0.2)" }}>
          <button aria-label="Attach a file for static analysis" title="Static analysis of a file (rule-based, not AI)" onClick={() => fileRef.current?.click()} className="p-1.5 rounded hover:bg-white/5" style={{ color: "rgba(200,225,255,0.6)" }}><Paperclip size={14} /></button>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void attach(f); e.target.value = "" }} />
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder="Ask about your code…" aria-label="Message"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit() } }}
            className="flex-1 bg-transparent resize-none outline-none text-[12px] text-white py-1.5 max-h-28 placeholder:text-gray-600" />
          {chat.busy
            ? <button aria-label="Stop generating" onClick={chat.stop} className="p-1.5 rounded-md" style={{ background: "rgba(255,77,109,0.15)", color: "#ff4d6d" }}><Square size={14} /></button>
            : <button aria-label="Send" onClick={() => void submit()} disabled={!input.trim()} className="p-1.5 rounded-md disabled:opacity-40" style={{ background: "#00CFFF", color: "#080D18" }}><Send size={14} /></button>}
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px]" style={{ color: "rgba(200,225,255,0.45)" }}>
          <span>Enter to send · Shift+Enter for a new line</span>
          <span className="flex gap-2">
            <button onClick={() => void chat.regenerate()} disabled={chat.busy || !chat.messages.some((m) => m.role === "assistant" && !m.label?.startsWith("Static"))} className="flex items-center gap-0.5 hover:text-[#00CFFF] disabled:opacity-40"><RefreshCw size={10} />Regenerate</button>
            <button onClick={chat.clear} disabled={chat.messages.length === 0} className="flex items-center gap-0.5 hover:text-[#00CFFF] disabled:opacity-40" aria-label="Clear conversation"><Trash2 size={10} />Clear</button>
            <button onClick={chat.clear} className="flex items-center gap-0.5 hover:text-[#00CFFF]"><Plus size={10} />New</button>
          </span>
        </div>
      </div>

      {pending && <ApplyFixDialog pending={pending} onCancel={() => setPending(null)} onConfirm={() => { onApply(pending.fileId, pending.next); setPending(null); setNotice(`Applied to ${pending.fileName}. Undo with Ctrl+Z in the editor.`) }} />}
    </div>
  )
}

function Message({ m, isLast, busy, onApply, onRetry, onSetup }: { m: UiMessage; isLast: boolean; busy: boolean; onApply: (m: UiMessage, code: string) => void; onRetry: () => void; onSetup: () => void }) {
  if (m.role === "user") {
    return <div className="ml-6 rounded-xl rounded-br-sm px-3 py-2 text-[12px] text-white whitespace-pre-wrap break-words" style={{ background: "rgba(0,207,255,0.14)", border: "1px solid rgba(0,207,255,0.25)" }}>{m.content}</div>
  }
  return (
    <div className="mr-2 rounded-xl rounded-bl-sm px-3 py-2 text-[12px] leading-relaxed" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(230,240,255,0.92)" }}>
      {m.label && <p className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: m.label.startsWith("Static") ? "#ffd166" : "rgba(200,225,255,0.45)" }}>{m.label}</p>}
      {m.content && (
        <div className="prose-chat break-words">
          <ReactMarkdown
            components={{
              pre: ({ children }) => <>{children}</>,
              code: ({ className, children }) => {
                const text = String(children).replace(/\n$/, "")
                const block = /language-/.test(className ?? "") || text.includes("\n")
                if (!block) return <code className="px-1 rounded text-[11px]" style={{ background: "rgba(255,255,255,0.08)", fontFamily: MONO }}>{children}</code>
                return <ChatCodeBlock code={text} lang={/language-([\w+#-]+)/.exec(className ?? "")?.[1] ?? ""} canApply={!m.streaming && !m.label?.startsWith("Static") && !!m.scope} onApply={(c) => onApply(m, c)} />
              },
              h2: ({ children }) => <h3 className="mt-3 mb-1 text-[12px] font-semibold" style={{ color: "#00CFFF" }}>{children}</h3>,
              h3: ({ children }) => <h4 className="mt-2 mb-1 text-[12px] font-semibold" style={{ color: "#8B5CF6" }}>{children}</h4>,
              p: ({ children }) => <p className="my-1.5">{children}</p>,
              ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal">{children}</ol>,
            }}
          >{m.content}</ReactMarkdown>
        </div>
      )}
      {m.streaming && <span className="inline-block w-1.5 h-3 ml-0.5 align-middle animate-pulse" style={{ background: "#00CFFF" }} aria-label="Generating" />}
      {m.error && (
        <div role="alert" className="flex items-start gap-2 mt-1" style={{ color: "#ff8fa3" }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p>{m.error.message}</p>
            <div className="mt-1.5 flex gap-2">
              {m.error.code === "not_loaded" && <button onClick={onSetup} className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "#00CFFF", color: "#080D18" }}>Open model settings</button>}
              {m.error.retryable && isLast && !busy && <button onClick={onRetry} className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.15)", color: "#e5eeff" }}><RotateCcw size={10} /> Retry</button>}
            </div>
          </div>
        </div>
      )}
      {!m.streaming && m.via && !m.error && <p className="mt-1.5 text-[9px]" style={{ color: "rgba(200,225,255,0.35)" }}>{m.via === "local" ? "Generated on your device" : "Generated by cloud AI"} · AI can be wrong, so check before applying.</p>}
    </div>
  )
}
