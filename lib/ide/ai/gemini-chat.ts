import { ChatError, type ChatMsg } from "./types.ts"
import { SseParser } from "../../debug/sse.ts"

const DEFAULT_MODEL = "gemini-3.8-flash"
const DEFAULT_BASE = "https://generativelanguage.googleapis.com"

function httpError(status: number): ChatError {
  if (status === 400) return new ChatError("bad_request", "The AI service rejected the request. Try a shorter conversation.", 502)
  if (status === 401 || status === 403) return new ChatError("ai_auth", "The AI service key is missing, invalid or not permitted.", 502)
  if (status === 404) return new ChatError("ai_model", "The configured AI model is unavailable. Set GEMINI_MODEL to a current model.", 502)
  if (status === 429) return new ChatError("rate_limited", "The AI service is rate limited right now. Wait a moment and retry.", 429, true)
  return new ChatError("ai_unavailable", "The AI service is temporarily unavailable. Please retry.", 502, true)
}

export interface GeminiChatOptions {
  apiKey: string
  system: string
  messages: ChatMsg[]
  model?: string
  baseUrl?: string
  signal?: AbortSignal
  doFetch?: typeof fetch
}

/**
 * Streams plain text from Gemini for a chat. Server-only: the key goes in a header (never the URL) and is
 * never returned to the browser. The system prompt is set here by the server, not taken from the client.
 */
export async function* streamGeminiChat(o: GeminiChatOptions): AsyncGenerator<string> {
  const base = (o.baseUrl || DEFAULT_BASE).replace(/\/$/, "")
  const url = `${base}/v1beta/models/${encodeURIComponent(o.model || DEFAULT_MODEL)}:streamGenerateContent?alt=sse`
  let res: Response
  try {
    res = await (o.doFetch ?? fetch)(url, {
      method: "POST",
      signal: o.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": o.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: o.system }] },
        contents: o.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      }),
    })
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e
    throw new ChatError("network", "Could not reach the AI service. Check your connection and retry.", 502, true)
  }
  if (!res.ok || !res.body) throw httpError(res.status)

  const parser = new SseParser()
  const dec = new TextDecoder()
  const reader = res.body.getReader()
  let got = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const msg of parser.push(dec.decode(value, { stream: true }))) {
      let j: any
      try { j = JSON.parse(msg.data) } catch { continue }
      if (j?.promptFeedback?.blockReason) throw new ChatError("blocked", "The AI service declined to process this input.", 422)
      for (const part of j?.candidates?.[0]?.content?.parts ?? []) {
        if (typeof part?.text === "string" && part.text) { got = true; yield part.text }
      }
    }
  }
  if (!got) throw new ChatError("empty", "The AI service returned no text. Please retry.", 502, true)
}
