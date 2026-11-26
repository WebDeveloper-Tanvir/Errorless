import { DebugError } from "./types.ts"
import { RESPONSE_SCHEMA, SYSTEM_INSTRUCTION } from "./prompt.ts"
import { SseParser } from "./sse.ts"

/**
 * Streams text from the Gemini API (streamGenerateContent, SSE).
 * The API key goes in a header, never in the URL, so it can't leak into logs.
 */

export const DEFAULT_MODEL = "gemini-3.8-flash"
export const DEFAULT_BASE = "https://generativelanguage.googleapis.com"

export interface GeminiOptions {
  apiKey: string
  model?: string
  baseUrl?: string
  prompt: string
  signal?: AbortSignal
}

function mapHttpError(status: number): DebugError {
  if (status === 400) return new DebugError("bad_request", "The AI service rejected the request. Try shortening the input.", 502)
  if (status === 401 || status === 403) return new DebugError("ai_auth", "The AI service key is missing, invalid or not permitted.", 502)
  if (status === 404) return new DebugError("ai_model", "The configured AI model is unavailable. Set GEMINI_MODEL to a current model.", 502)
  if (status === 429) return new DebugError("rate_limited", "The AI service is rate limited right now. Wait a moment and retry.", 429, true)
  return new DebugError("ai_unavailable", "The AI service is temporarily unavailable. Please retry.", 502, true)
}

export async function* streamGemini(opts: GeminiOptions): AsyncGenerator<string> {
  const model = opts.model || DEFAULT_MODEL
  const base = (opts.baseUrl || DEFAULT_BASE).replace(/\/$/, "")
  const url = `${base}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      signal: opts.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    })
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err
    throw new DebugError("network", "Could not reach the AI service. Check your connection and retry.", 502, true)
  }

  if (!res.ok || !res.body) throw mapHttpError(res.status)

  const parser = new SseParser()
  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let gotText = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const msg of parser.push(decoder.decode(value, { stream: true }))) {
      let json: any
      try {
        json = JSON.parse(msg.data)
      } catch {
        continue
      }
      if (json?.promptFeedback?.blockReason) {
        throw new DebugError("blocked", "The AI service declined to process this input.", 422)
      }
      const cand = json?.candidates?.[0]
      for (const part of cand?.content?.parts ?? []) {
        if (typeof part?.text === "string" && part.text) {
          gotText = true
          yield part.text
        }
      }
      if (cand?.finishReason === "MAX_TOKENS") {
        throw new DebugError("truncated", "The answer was cut off because it was too long. Try with less code.", 502, true)
      }
      if (cand?.finishReason === "SAFETY") {
        throw new DebugError("blocked", "The AI service declined to process this input.", 422)
      }
    }
  }
  if (!gotText) throw new DebugError("empty", "The AI service returned no answer. Please retry.", 502, true)
}
