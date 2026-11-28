"use client"

import { MAX_OUTPUT_CHARS, cleanTraceback, parseFrameMessage } from "./python-protocol.ts"
import { pythonFrameHtml } from "./python-frame.ts"

export const DEFAULT_PYODIDE_BASE = "/ide-runtime/pyodide/"

export interface PythonCallbacks {
  onStatus?: (text: string) => void
  /** Fired once the runtime is ready, immediately before the code starts. */
  onStart?: () => void
  onStdout?: (text: string) => void
  onStderr?: (text: string) => void
}
export type PythonOutcome =
  | { ok: true; ms: number; truncated: boolean }
  | { ok: false; kind: "exception" | "timeout" | "stopped" | "init" | "busy"; message: string; line?: number; ms: number }

const nonce = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("")

/**
 * Runs Python with Pyodide inside a hidden sandboxed iframe. The runtime is loaded lazily on the
 * first run and reused for later runs. Stop and timeouts destroy the iframe (and the worker in it),
 * which is the only dependable way to interrupt WebAssembly code in a browser; the next run
 * re-initialises from the browser cache.
 */
export class PythonRunner {
  private frame: HTMLIFrameElement | null = null
  private nonce = ""
  private ready: Promise<void> | null = null
  private seq = 0
  private active: { id: number; settle: (o: PythonOutcome) => void } | null = null
  private listener: ((e: MessageEvent) => void) | null = null
  private handlers: PythonCallbacks = {}
  private outChars = 0
  private truncated = false
  private base: string
  private runTimeoutMs: number
  private initTimeoutMs: number

  constructor(opts: { baseUrl?: string; runTimeoutMs?: number; initTimeoutMs?: number } = {}) {
    this.base = (opts.baseUrl || DEFAULT_PYODIDE_BASE).replace(/\/?$/, "/")
    this.runTimeoutMs = opts.runTimeoutMs ?? 20_000
    this.initTimeoutMs = opts.initTimeoutMs ?? 90_000
  }

  get running() { return this.active !== null }

  private emit(kind: "onStdout" | "onStderr", text: string) {
    if (this.outChars >= MAX_OUTPUT_CHARS) return
    this.outChars += text.length
    if (this.outChars >= MAX_OUTPUT_CHARS && !this.truncated) {
      this.truncated = true
      this.handlers.onStderr?.("… output truncated (limit reached)")
      return
    }
    this.handlers[kind]?.(text)
  }

  private kill() {
    if (this.listener) window.removeEventListener("message", this.listener)
    this.listener = null
    this.frame?.remove()
    this.frame = null
    this.ready = null
  }

  private ensureFrame(): Promise<void> {
    if (this.ready) return this.ready
    this.nonce = nonce()
    const frame = document.createElement("iframe")
    frame.setAttribute("sandbox", "allow-scripts") // opaque origin: no cookies or storage
    frame.setAttribute("aria-hidden", "true")
    frame.setAttribute("referrerpolicy", "no-referrer")
    frame.title = "Python runtime (sandboxed)"
    frame.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden"
    frame.srcdoc = pythonFrameHtml({ nonce: this.nonce, parentOrigin: window.location.origin, baseUrl: new URL(this.base, window.location.origin).href })
    this.frame = frame
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.kill(); reject(new Error(`The Python runtime did not start within ${Math.round(this.initTimeoutMs / 1000)}s.`)) }, this.initTimeoutMs)
      const myNonce = this.nonce
      this.listener = (e: MessageEvent) => {
        if (e.source !== frame.contentWindow) return
        const m = parseFrameMessage(e.data, myNonce)
        if (!m) return
        switch (m.type) {
          case "ready": clearTimeout(timer); resolve(); break
          case "init-error": clearTimeout(timer); this.kill(); reject(new Error(m.message)); break
          case "worker-error": clearTimeout(timer); { const wasReady = this.active; this.kill(); if (wasReady) wasReady.settle({ ok: false, kind: "exception", message: m.message, ms: 0 }); else reject(new Error(m.message)) } break
          case "stdout": if (this.active?.id === m.id) this.emit("onStdout", m.text); break
          case "stderr": if (this.active?.id === m.id) this.emit("onStderr", m.text); break
          case "done": if (this.active?.id === m.id) this.active.settle({ ok: true, ms: 0, truncated: this.truncated }); break
          case "error": if (this.active?.id === m.id) {
            const c = cleanTraceback(m.message)
            this.active.settle({ ok: false, kind: "exception", message: c.text || m.message, line: c.line, ms: 0 })
          } break
        }
      }
      window.addEventListener("message", this.listener)
      document.body.appendChild(frame)
    })
    this.ready.catch(() => undefined)
    return this.ready
  }

  async run(code: string, cb: PythonCallbacks = {}): Promise<PythonOutcome> {
    if (this.active) return { ok: false, kind: "busy", message: "Python is already running. Stop it first.", ms: 0 }
    this.handlers = cb
    this.outChars = 0
    this.truncated = false
    const first = !this.ready
    if (first) cb.onStatus?.("Initializing Python runtime…")
    const t0 = performance.now()
    try {
      await this.ensureFrame()
    } catch (err) {
      return { ok: false, kind: "init", message: err instanceof Error ? err.message : String(err), ms: Math.round(performance.now() - t0) }
    }
    if (first) cb.onStatus?.(`Python runtime ready (${((performance.now() - t0) / 1000).toFixed(1)}s).`)

    cb.onStart?.()
    const id = ++this.seq
    const start = performance.now()
    return new Promise<PythonOutcome>((resolve) => {
      const settle = (o: PythonOutcome) => {
        clearTimeout(timer)
        this.active = null
        resolve({ ...o, ms: Math.round(performance.now() - start) } as PythonOutcome)
      }
      this.active = { id, settle }
      const timer = setTimeout(() => {
        this.kill()
        settle({ ok: false, kind: "timeout", message: `Execution stopped after ${Math.round(this.runTimeoutMs / 1000)}s (possible infinite loop). Python cannot be interrupted in place, so the runtime was restarted.`, ms: 0 })
      }, this.runTimeoutMs)
      this.frame?.contentWindow?.postMessage({ type: "run", id, nonce: this.nonce, code }, "*")
    })
  }

  stop() {
    const a = this.active
    this.kill()
    a?.settle({ ok: false, kind: "stopped", message: "Execution stopped.", ms: 0 })
  }

  dispose() { this.stop() }
}
