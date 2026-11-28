import { ChatError, type ChatMsg } from "./types.ts"
import { SYSTEM_PROMPT } from "./actions.ts"
import { streamGeminiChat } from "./gemini-chat.ts"
import { redactSecrets } from "../../debug/redact.ts"
import { encodeSse } from "../../debug/sse.ts"

export interface ServiceConfig { apiKey: string; model?: string; baseUrl?: string; doFetch?: typeof fetch }

/**
 * Turns a validated conversation into an SSE event stream: meta → delta* → done, or error.
 * Secrets are redacted BEFORE anything leaves for the provider, and the system prompt is the
 * server's own (a client cannot supply one).
 */
export async function* chatEvents(messages: ChatMsg[], cfg: ServiceConfig, signal: AbortSignal): AsyncGenerator<string> {
  let redactions = 0
  const safe = messages.map((m) => {
    const r = redactSecrets(m.content)
    redactions += r.findings.length
    return { ...m, content: r.text }
  })
  yield encodeSse("meta", { redactions })
  try {
    for await (const text of streamGeminiChat({ apiKey: cfg.apiKey, system: SYSTEM_PROMPT, messages: safe, model: cfg.model, baseUrl: cfg.baseUrl, signal, doFetch: cfg.doFetch })) {
      yield encodeSse("delta", { text })
    }
    yield encodeSse("done", {})
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      yield encodeSse("error", { code: "timeout", message: "The request was stopped or took too long.", retryable: true })
    } else if (e instanceof ChatError) {
      yield encodeSse("error", { code: e.code, message: e.message, retryable: e.retryable })
    } else {
      yield encodeSse("error", { code: "unexpected", message: "Something went wrong. Please retry.", retryable: true })
    }
  }
}
