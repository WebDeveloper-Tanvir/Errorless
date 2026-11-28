"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ACTIONS, buildActionMessage, checkContext, withSystem, type ActionContext, type ActionId } from "@/lib/ide/ai/actions"
import { ChatError, type ChatMsg, type ChatProvider } from "@/lib/ide/ai/types"
import { CloudProvider } from "@/lib/ide/ai/cloud-provider"
import { LocalProvider, type LocalProgress } from "@/lib/ide/ai/local-provider"
import { DEFAULT_LOCAL_MODEL, modelByKey } from "@/lib/ide/ai/models"
import { detectWebGpu, type WebGpuStatus } from "@/lib/ide/ai/webgpu"

/** Where an answer's code should go if the user applies it (captured when the question was asked). */
export interface ApplyScope { fileId: string; fileName: string; selection?: { text: string; start: number; end: number } }
export interface UiMessage {
  id: number
  role: "user" | "assistant"
  content: string
  /** Static-analysis results are shown in the chat but are NOT model output and never sent to a model. */
  label?: string
  error?: { message: string; code: string; retryable: boolean }
  streaming?: boolean
  scope?: ApplyScope
  via?: "local" | "cloud"
}
export type Mode = "local" | "cloud"

const HISTORY_KEY = (uid: string) => `errorless.ide.chat.v1.${uid}`
const CONSENT_KEY = (uid: string) => `errorless.ide.chat.consent.v1.${uid}`
const safe = <T,>(f: () => T, d: T): T => { try { return f() } catch { return d } }

/**
 * Chat state for the IDE assistant. Conversations are kept in memory only, unless the user opts in
 * to saving them in this browser (localStorage, keyed by account). Nothing is sent to a server in
 * local mode; in cloud mode the conversation goes to /api/ide/chat.
 */
export function useIdeChat(userId: string | null) {
  const uid = userId ?? "guest"
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [mode, setMode] = useState<Mode>("local")
  const [modelKey, setModelKey] = useState(DEFAULT_LOCAL_MODEL)
  const [gpu, setGpu] = useState<WebGpuStatus | null>(null)
  const [progress, setProgress] = useState<LocalProgress>({ phase: "idle", text: "", fraction: 0 })
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saveHistory, setSaveHistoryState] = useState(false)
  const local = useRef<LocalProvider | null>(null)
  const cloud = useRef(new CloudProvider())
  const ctl = useRef<AbortController | null>(null)
  const seq = useRef(0)
  const lastSend = useRef<{ history: ChatMsg[]; scope?: ApplyScope } | null>(null)

  useEffect(() => { void detectWebGpu().then(setGpu) }, [])
  useEffect(() => () => { ctl.current?.abort(); void local.current?.unload() }, [])

  // Restore history only if the user previously opted in on this device for this account.
  useEffect(() => {
    const on = safe(() => localStorage.getItem(CONSENT_KEY(uid)) === "1", false)
    setSaveHistoryState(on)
    if (on) {
      const raw = safe(() => localStorage.getItem(HISTORY_KEY(uid)), null)
      if (raw) safe(() => { const m = JSON.parse(raw) as UiMessage[]; seq.current = m.reduce((a, x) => Math.max(a, x.id), 0); setMessages(m.map((x) => ({ ...x, streaming: false }))) }, undefined)
    }
  }, [uid])
  useEffect(() => {
    if (!saveHistory) return
    safe(() => localStorage.setItem(HISTORY_KEY(uid), JSON.stringify(messages.filter((m) => !m.streaming).slice(-60))), undefined)
  }, [messages, saveHistory, uid])

  const setSaveHistory = useCallback((on: boolean) => {
    setSaveHistoryState(on)
    safe(() => { if (on) localStorage.setItem(CONSENT_KEY(uid), "1"); else { localStorage.removeItem(CONSENT_KEY(uid)); localStorage.removeItem(HISTORY_KEY(uid)) } }, undefined)
  }, [uid])

  const add = useCallback((m: Omit<UiMessage, "id">) => { const id = ++seq.current; setMessages((p) => [...p, { ...m, id }]); return id }, [])
  const patch = useCallback((id: number, f: (m: UiMessage) => UiMessage) => setMessages((p) => p.map((m) => (m.id === id ? f(m) : m))), [])

  const loadLocal = useCallback(async () => {
    local.current ??= new LocalProvider()
    try {
      await local.current.load(modelKey, setProgress)
      setLoadedKey(modelKey)
    } catch (e) {
      const ce = e instanceof ChatError ? e : new ChatError("load", String(e))
      setProgress({ phase: "error", text: ce.message, fraction: 0 })
      setLoadedKey(null)
    }
  }, [modelKey])

  const unloadLocal = useCallback(async () => { await local.current?.unload(); setLoadedKey(null); setProgress({ phase: "idle", text: "", fraction: 0 }) }, [])

  const provider = (): ChatProvider | ChatError => {
    if (mode === "cloud") return cloud.current
    if (!local.current || loadedKey !== local.current.loaded) return new ChatError("not_loaded", "No local model is loaded yet. Choose a model and press Download & load.")
    return local.current
  }

  const run = useCallback(async (history: ChatMsg[], scope?: ApplyScope) => {
    lastSend.current = { history, scope }
    const p = provider()
    if (p instanceof ChatError) { add({ role: "assistant", content: "", error: { message: p.message, code: p.code, retryable: false } }); return }
    const id = add({ role: "assistant", content: "", streaming: true, scope, via: p.kind })
    const c = new AbortController()
    ctl.current = c
    setBusy(true)
    try {
      for await (const t of p.stream(withSystem(history), c.signal)) patch(id, (m) => ({ ...m, content: m.content + t }))
      patch(id, (m) => ({ ...m, streaming: false, ...(m.content.trim() ? {} : { error: { message: "The model returned an empty answer.", code: "empty", retryable: true } }) }))
    } catch (e) {
      if ((e as Error)?.name === "AbortError") patch(id, (m) => ({ ...m, streaming: false, label: m.content ? "stopped" : undefined, ...(m.content ? {} : { error: { message: "Stopped.", code: "stopped", retryable: true } }) }))
      else {
        const ce = e instanceof ChatError ? e : new ChatError("unexpected", e instanceof Error ? e.message : "Unexpected error", 0, true)
        patch(id, (m) => ({ ...m, streaming: false, error: { message: ce.message, code: ce.code, retryable: ce.retryable } }))
      }
    } finally { setBusy(false); ctl.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, loadedKey, add, patch])

  const historyOf = (extra: ChatMsg): ChatMsg[] => [
    ...messages.filter((m) => !m.error && !m.label?.startsWith("Static") && m.content).map((m) => ({ role: m.role, content: m.content }) as ChatMsg),
    extra,
  ].slice(-12)

  const send = useCallback(async (text: string, scope?: ApplyScope) => {
    if (!text.trim() || busy) return
    add({ role: "user", content: text.trim() })
    await run(historyOf({ role: "user", content: text.trim() }), scope)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, messages, run, add])

  /** Quick actions. Returns a message when the context is missing, so the UI can say what to do. */
  const runAction = useCallback(async (id: ActionId, ctx: ActionContext, scope?: ApplyScope): Promise<string | null> => {
    if (busy) return "Wait for the current answer to finish, or press Stop."
    const need = checkContext(id, ctx)
    if (!need.ok) return need.message
    const def = ACTIONS.find((a) => a.id === id)!
    add({ role: "user", content: `${def.label}${ctx.filename ? ` — ${ctx.filename}` : ""}${ctx.prompt ? `: ${ctx.prompt}` : ""}` })
    // Actions are one-shot: they carry their own context, so earlier chat is not mixed in.
    await run([{ role: "user", content: buildActionMessage(id, ctx) }], scope)
    return null
  }, [busy, add, run])

  const stop = useCallback(() => ctl.current?.abort(), [])
  const regenerate = useCallback(async () => {
    if (busy || !lastSend.current) return
    setMessages((p) => { const i = [...p].reverse().findIndex((m) => m.role === "assistant"); return i === -1 ? p : p.filter((_, k) => k !== p.length - 1 - i) })
    await run(lastSend.current.history, lastSend.current.scope)
  }, [busy, run])
  const retry = regenerate
  const clear = useCallback(() => { ctl.current?.abort(); setMessages([]); lastSend.current = null; if (saveHistory) safe(() => localStorage.removeItem(HISTORY_KEY(uid)), undefined) }, [saveHistory, uid])
  const addNote = useCallback((label: string, content: string) => { add({ role: "assistant", content, label }) }, [add])

  const model = useMemo(() => modelByKey(modelKey), [modelKey])
  return { messages, mode, setMode, modelKey, setModelKey, model, gpu, progress, loadedKey, loadLocal, unloadLocal, busy, send, runAction, stop, regenerate, retry, clear, addNote, saveHistory, setSaveHistory }
}
