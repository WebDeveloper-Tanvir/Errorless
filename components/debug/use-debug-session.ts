"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { SseParser } from "@/lib/debug/sse"
import type { DebugEvent, DebugRequest, DebugResult } from "@/lib/debug/types"

export interface SessionError {
  message: string
  code: string
  retryable: boolean
  upgrade?: boolean
}

export interface SessionState {
  phase: "idle" | "running" | "done" | "error"
  partial: Partial<DebugResult> | null
  result: DebugResult | null
  error: SessionError | null
  redactions: { kind: string; count: number }[]
  model: string
}

const INITIAL: SessionState = { phase: "idle", partial: null, result: null, error: null, redactions: [], model: "" }

export function useDebugSession() {
  const [state, setState] = useState<SessionState>(INITIAL)
  const abortRef = useRef<AbortController | null>(null)
  const lastRef = useRef<DebugRequest | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState((s) => (s.phase === "running" ? { ...s, phase: "idle", partial: null } : s))
  }, [])

  const run = useCallback(async (req: DebugRequest) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    lastRef.current = req
    setState({ ...INITIAL, phase: "running" })

    const fail = (error: SessionError) => setState((s) => ({ ...s, phase: "error", error, partial: null }))

    try {
      const res = await fetch("/api/devmode/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: ac.signal,
      })

      if (!res.ok || !res.body) {
        const d = await res.json().catch(() => ({}))
        const message =
          res.status === 401 ? "Please sign in again to continue."
          : res.status === 402 ? "A Dev Mode plan is required for AI debugging."
          : d.error || "The request failed. Please retry."
        return fail({ message, code: d.code || `http_${res.status}`, retryable: d.code !== "ai_not_configured" && (res.status >= 500 || res.status === 429), upgrade: !!d.upgrade })
      }

      const parser = new SseParser()
      const decoder = new TextDecoder()
      const reader = res.body.getReader()
      let finished = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const m of parser.push(decoder.decode(value, { stream: true }))) {
          let ev: DebugEvent
          try { ev = JSON.parse(m.data) } catch { continue }
          if (ev.type === "meta") setState((s) => ({ ...s, redactions: ev.redactions, model: ev.model }))
          else if (ev.type === "partial") setState((s) => ({ ...s, partial: ev.result }))
          else if (ev.type === "result") { finished = true; setState((s) => ({ ...s, phase: "done", result: ev.result, partial: null })) }
          else if (ev.type === "error") { finished = true; fail({ message: ev.message, code: ev.code, retryable: ev.retryable }) }
        }
      }
      if (!finished) fail({ message: "The connection closed before the analysis finished. Please retry.", code: "interrupted", retryable: true })
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return
      fail({ message: "Could not reach the server. Check your connection and retry.", code: "network", retryable: true })
    }
  }, [])

  const retry = useCallback(() => {
    if (lastRef.current) void run(lastRef.current)
  }, [run])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(INITIAL)
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  return { state, run, retry, cancel, reset }
}

export async function sendFeedback(body: { helpful: boolean; certainty: string; language: string; framework: string; comment?: string }) {
  const res = await fetch("/api/devmode/debug/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.ok
}
