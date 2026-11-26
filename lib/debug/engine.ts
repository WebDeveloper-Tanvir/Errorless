import type { DebugEvent, DebugRequest } from "./types.ts"
import { DebugError } from "./types.ts"
import { redactSecrets } from "./redact.ts"
import { buildPrompt } from "./prompt.ts"
import { normalizeResult } from "./normalize.ts"
import { parsePartialJson } from "./partial-json.ts"
import { DEFAULT_MODEL, streamGemini } from "./gemini.ts"

export interface EngineOptions {
  apiKey: string
  model?: string
  baseUrl?: string
  signal?: AbortSignal
  /** Minimum ms between partial events. */
  throttleMs?: number
  /** Injectable for tests; defaults to the real Gemini stream. */
  stream?: typeof streamGemini
}

/**
 * Runs one debugging request and yields events: meta → partial* → result | error.
 * Secrets are redacted here too, so no caller can forget to do it.
 */
export async function* runDebug(input: DebugRequest, opts: EngineOptions): AsyncGenerator<DebugEvent> {
  const code = redactSecrets(input.code)
  const err = redactSecrets(input.errorText)
  const ctx = redactSecrets(input.context)
  const req: DebugRequest = { ...input, code: code.text, errorText: err.text, context: ctx.text }

  const merged = new Map<string, number>()
  for (const f of [...code.findings, ...err.findings, ...ctx.findings]) merged.set(f.kind, (merged.get(f.kind) ?? 0) + f.count)
  yield { type: "meta", model: opts.model || DEFAULT_MODEL, redactions: [...merged].map(([kind, count]) => ({ kind, count })) }

  const norm = { code: req.code, errorText: req.errorText }
  const stream = opts.stream ?? streamGemini
  let raw = ""
  let lastSent = 0
  const throttle = opts.throttleMs ?? 120

  try {
    for await (const chunk of stream({ apiKey: opts.apiKey, model: opts.model, baseUrl: opts.baseUrl, prompt: buildPrompt(req), signal: opts.signal })) {
      raw += chunk
      const now = Date.now()
      if (now - lastSent >= throttle) {
        const p = parsePartialJson(raw)
        if (p !== undefined) {
          lastSent = now
          yield { type: "partial", result: normalizeResult(p, norm, { partial: true }) }
        }
      }
    }
  } catch (e) {
    if (e instanceof DebugError) {
      yield { type: "error", code: e.code, message: e.message, retryable: e.retryable }
      return
    }
    if ((e as Error)?.name === "AbortError") return
    yield { type: "error", code: "unexpected", message: "Something went wrong while analyzing. Please retry.", retryable: true }
    return
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = parsePartialJson(raw)
  }
  if (parsed === undefined || typeof parsed !== "object" || parsed === null) {
    yield { type: "error", code: "bad_output", message: "The AI returned an answer we could not read. Please retry.", retryable: true }
    return
  }
  yield { type: "result", result: normalizeResult(parsed, norm) }
}
