"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cannotRunReason, detectLanguage } from "@/lib/ide/language"
import { buildPreview, flattenProject, type ProjectFile, type TreeNode } from "@/lib/ide/project"
import { parseBridgeMessage } from "@/lib/ide/preview-protocol"
import { transpileTs } from "@/lib/ide/typescript"
import { PythonRunner } from "@/lib/ide/python-runner"
import { cleanTraceback } from "@/lib/ide/python-protocol"
import type { EventKind, RunProblem, RuntimeEvent } from "@/lib/ide/events"

const MAX_EVENTS = 2000
const PAGE_TIMEOUT_MS = 15_000
const nonce = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("")

export interface PreviewState { html: string; key: number; label: string }
interface Waiter { nonce: string; errors: number; settle: (r: { errors: number; stopped?: boolean; timedOut?: boolean }) => void; timer: ReturnType<typeof setTimeout> }

/**
 * Owns everything about running code: the shared log (Terminal, Output and Debug tabs read it),
 * Problems, the preview document, and the Python runner. Content is always read from the file tree at
 * run time, so unsaved editor changes are what runs.
 */
export function useIdeRuntime(getTree: () => TreeNode[]) {
  const [events, setEvents] = useState<RuntimeEvent[]>([])
  const [problems, setProblems] = useState<RunProblem[]>([])
  const [running, setRunning] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const seq = useRef(0)
  const waiter = useRef<Waiter | null>(null)
  const currentNonce = useRef("")
  const python = useRef<PythonRunner | null>(null)
  const lastRun = useRef<string | null>(null)
  const runToken = useRef(0)
  const pendingFile = useRef<{ file: string; lineOffset: number }>({ file: "", lineOffset: 0 })
  const abort = useRef<AbortController | null>(null)

  const add = useCallback((kind: EventKind, text: string) => {
    setEvents((p) => [...p.slice(-(MAX_EVENTS - 1)), { id: ++seq.current, kind, text, at: Date.now() }])
  }, [])
  const addProblem = useCallback((file: string, message: string, line = 0, column = 0, source = "runtime", severity: "error" | "warning" = "error") => {
    setProblems((p) => [...p, { id: ++seq.current, severity, message, file, line, column, source }])
  }, [])

  // Messages from the sandboxed preview frame (untrusted text; validated, never evaluated).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const frame = iframeRef.current
      if (!frame || e.source !== frame.contentWindow) return
      const m = parseBridgeMessage(e.data, currentNonce.current)
      const w = waiter.current
      if (!m || !w || w.nonce !== currentNonce.current) return
      if (m.type === "console") add(m.level === "error" ? "stderr" : m.level === "warn" ? "warn" : "stdout", m.text)
      else if (m.type === "error") {
        w.errors++
        const { file, lineOffset } = pendingFile.current
        const line = m.line > 0 && lineOffset >= 0 ? Math.max(1, m.line - lineOffset) : 0
        add("error", `${m.message}${line ? ` (${file}:${line}${m.col ? ":" + m.col : ""})` : ""}`)
        addProblem(file, m.message, line, m.col, "runtime")
      } else if (m.type === "done") {
        clearTimeout(w.timer)
        waiter.current = null
        w.settle({ errors: w.errors })
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [add, addProblem])

  useEffect(() => () => { python.current?.dispose() }, [])

  const settleWaiter = (r: { stopped?: boolean }) => {
    const w = waiter.current
    if (!w) return
    clearTimeout(w.timer)
    waiter.current = null
    w.settle({ errors: w.errors, ...r })
  }

  const finish = useCallback((ok: boolean, okText: string, failText: string, ms?: number) => {
    add(ok ? "success" : "error", ok ? okText : failText)
    if (ms !== undefined) add("system", `Finished in ${ms} ms`)
  }, [add])

  /** Render `entry` in the sandboxed preview and wait for the page to finish loading. */
  const renderPreview = useCallback(async (files: ProjectFile[], entry: ProjectFile, compiled: Record<string, string>) => {
    const n = nonce()
    const built = buildPreview({ files, entry, nonce: n, parentOrigin: window.location.origin, compiled })
    built.notes.forEach((t) => add("warn", t))
    built.missing.forEach((m) => { add("warn", `Referenced file not found: ${m}`); addProblem(built.page, `Referenced file not found: ${m}`, 0, 0, "preview", "warning") })
    if (!built.html) return { built, result: null as null }
    currentNonce.current = n
    pendingFile.current = { file: entry.path, lineOffset: built.lineOffset ?? -1 }
    const result = new Promise<{ errors: number; stopped?: boolean; timedOut?: boolean }>((settle) => {
      const timer = setTimeout(() => { waiter.current = null; settle({ errors: 0, timedOut: true }) }, PAGE_TIMEOUT_MS)
      waiter.current = { nonce: n, errors: 0, settle, timer }
    })
    setPreview((p) => ({ html: built.html, key: (p?.key ?? 0) + 1, label: built.page }))
    return { built, result: await result }
  }, [add, addProblem])

  const stop = useCallback(() => {
    runToken.current++
    python.current?.stop()
    abort.current?.abort()
    settleWaiter({ stopped: true })
    setPreview((p) => (p ? { html: "", key: p.key + 1, label: "" } : p))
    setRunning(false)
    add("system", "Execution stopped.")
  }, [add])

  const run = useCallback(async (target: string | { id: string }): Promise<void> => {
    const files = flattenProject(getTree())
    const entry = typeof target === "string"
      ? files.find((f) => f.path === target) ?? (files.filter((f) => f.name === target).length === 1 ? files.find((f) => f.name === target) : undefined)
      : files.find((f) => f.id === target.id)
    if (!entry) {
      const ambiguous = typeof target === "string" && files.filter((f) => f.name === target).length > 1
      add("error", ambiguous ? `More than one file is named ${target}. Use its full path.` : `File not found: ${typeof target === "string" ? target : target.id}`)
      return
    }
    if (running) stop()
    const token = ++runToken.current
    const alive = () => runToken.current === token
    lastRun.current = entry.id
    setProblems([])
    const info = detectLanguage(entry.name)
    add("command", `run ${entry.path}`)

    const reason = cannotRunReason(entry.name)
    if (reason) { add("error", reason); return }
    if (!entry.content.trim()) { add("error", `${entry.path} is empty. Nothing was executed.`); return }

    setRunning(true)
    try {
      switch (info.runtime) {
        case "html": {
          add("system", "Starting HTML preview...")
          setPreviewOpen(true)
          const { built, result } = await renderPreview(files, entry, {})
          if (!alive()) return
          if (!result) { add("error", built.notes[0] ?? "Nothing to render."); break }
          if (result.timedOut) { add("error", `The page did not finish loading within ${PAGE_TIMEOUT_MS / 1000}s. Use Stop if it is stuck.`); break }
          if (result.errors) { add("error", `The page rendered with ${result.errors} script error(s). See Problems.`); break }
          add("system", "HTML rendered successfully.")
          add("system", "Preview updated.")
          break
        }
        case "css": {
          add("system", "Applying CSS to the preview...")
          const { built, result } = await renderPreview(files, entry, {})
          if (!alive()) return
          if (!result) { add("error", built.notes[0] ?? "Nothing to render."); break }
          setPreviewOpen(true)
          add("system", `CSS applied to ${built.page}.`)
          add("system", "Preview updated.")
          break
        }
        case "browser-js":
        case "browser-ts": {
          const compiled: Record<string, string> = {}
          const ts = info.runtime === "browser-ts"
          if (ts) {
            add("system", "Transpiling TypeScript...")
            for (const f of files.filter((x) => /\.(ts|mts)$/i.test(x.name))) {
              const r = await transpileTs(f.content, f.name)
              if (r.diagnostics.length) {
                r.diagnostics.forEach((d) => { add("error", `${f.path}:${d.line}:${d.col} ${d.message}`); addProblem(f.path, d.message, d.line, d.col, "typescript") })
                add("error", "TypeScript could not be transpiled. Nothing was executed.")
                return
              }
              compiled[f.path] = r.js
            }
            if (!alive()) return
          }
          add("system", ts ? "Executing TypeScript..." : "Executing JavaScript...")
          const t0 = performance.now()
          const { built, result } = await renderPreview(files, entry, compiled)
          if (!alive()) return
          if (!result) { add("error", built.notes[0] ?? "Nothing to execute."); break }
          if (result.timedOut) { add("error", `Execution did not finish within ${PAGE_TIMEOUT_MS / 1000}s. Use Stop if it is stuck.`); break }
          finish(result.errors === 0, "Execution completed.", `Execution finished with ${result.errors} error(s). See Problems.`, Math.round(performance.now() - t0))
          break
        }
        case "python": {
          python.current ??= new PythonRunner({ baseUrl: process.env.NEXT_PUBLIC_PYODIDE_BASE_URL })
          const out = await python.current.run(entry.content, {
            onStatus: (t) => add("system", t.replace(/…$/, "...")),
            onStart: () => add("system", "Executing Python..."),
            onStdout: (t) => add("stdout", t),
            onStderr: (t) => add("stderr", t),
          })
          if (!alive()) return
          if (out.ok) finish(true, "Execution completed.", "", out.ms)
          else if (out.kind === "exception") {
            const c = cleanTraceback(out.message)
            c.text.split("\n").forEach((l) => add("stderr", l))
            addProblem(entry.path, c.text.split("\n").pop() || "Python error", c.line ?? 0, 0, "python")
            finish(false, "", "Execution failed.", out.ms)
          } else if (out.kind === "stopped") { /* stop() already logged it */ }
          else finish(false, "", out.message)
          break
        }
        case "remote": {
          add("system", `Sending ${info.label} to the execution service...`)
          abort.current = new AbortController()
          const res = await fetch("/api/ide/execute", {
            method: "POST", headers: { "content-type": "application/json" }, signal: abort.current.signal,
            body: JSON.stringify({ language: info.remote, code: entry.content, filename: entry.name }),
          }).catch((e) => (e instanceof Error && e.name === "AbortError" ? null : new Error("Network error: the request could not be sent.")))
          if (!alive() || res === null) return
          if (res instanceof Error) { finish(false, "", res.message); break }
          const j = await res.json().catch(() => null)
          if (!res.ok || !j?.run) {
            const signedOut = res.status === 401 || (res.status === 404 && !j)
            finish(false, "", j?.error ?? (signedOut ? `Sign in to run ${info.label}. It needs an account and a configured execution service.` : `The execution service returned ${res.status}.`))
            break
          }
          if (j.compile?.stderr) j.compile.stderr.split("\n").filter(Boolean).forEach((l: string) => add(j.compile.code === 0 ? "warn" : "stderr", l))
          if (j.compile && j.compile.code !== 0) { addProblem(entry.path, "Compilation failed", 0, 0, "compiler"); finish(false, "", "Compilation failed."); break }
          if (j.run.stdout) j.run.stdout.replace(/\n$/, "").split("\n").forEach((l: string) => add("stdout", l))
          if (j.run.stderr) j.run.stderr.replace(/\n$/, "").split("\n").forEach((l: string) => add("stderr", l))
          if (j.run.code === 0) finish(true, "Execution completed.", "")
          else { addProblem(entry.path, `Exited with ${j.run.signal ?? "code " + j.run.code}`, 0, 0, "runtime"); finish(false, "", `Program exited with ${j.run.signal ?? "code " + j.run.code}.`) }
          break
        }
      }
    } catch (err) {
      add("error", err instanceof Error ? err.message : "Unexpected error while running.")
    } finally {
      if (alive()) setRunning(false)
    }
  }, [getTree, running, stop, add, addProblem, renderPreview, finish])

  const refresh = useCallback(() => { if (lastRun.current) void run({ id: lastRun.current }) }, [run])

  /** Terminal commands. Only what is real: help, clear, run. */
  const command = useCallback((raw: string, clearTerminal: () => void) => {
    const cmd = raw.trim()
    if (!cmd) return
    const [name, ...rest] = cmd.split(/\s+/)
    if (name === "clear" || name === "cls") { clearTerminal(); return }
    if (name === "run") {
      if (rest.length) void run(rest.join(" "))
      else if (lastRun.current) void run({ id: lastRun.current })
      else { add("command", cmd); add("error", "No file selected. Open a file, then use run, or run <filename>.") }
      return
    }
    add("command", cmd)
    if (name === "help") {
      ;["Commands:", "  run <file>   run a file (HTML, CSS, JS, TS, Python; C/C++/Java with a compiler service)", "  run          run the active file", "  clear        clear the terminal", "  help         show this message", "This is not a shell: npm, git, pip and other system commands are not available here."].forEach((l) => add("stdout", l))
      return
    }
    add("error", `'${name}' is not supported. This terminal is not a shell and cannot run system commands. Type help.`)
  }, [add, run])

  const setActive = useCallback((id: string | null) => { if (id) lastRun.current = id }, [])

  return { events, problems, running, preview, previewOpen, setPreviewOpen, iframeRef, run, stop, refresh, command, setActive, log: add, clearProblems: () => setProblems([]) }
}
