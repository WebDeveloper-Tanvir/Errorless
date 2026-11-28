import { ChatError, type ChatMsg, type ChatProvider } from "./types.ts"
import { SseParser } from "../../debug/sse.ts"

/** Cloud AI via our own endpoint. The browser never sees a provider key. */
export class CloudProvider implements ChatProvider {
  readonly kind = "cloud" as const
  private endpoint: string
  private doFetch: typeof fetch
  constructor(endpoint = "/api/ide/chat", doFetch: typeof fetch = (...a) => fetch(...a)) {
    this.endpoint = endpoint
    this.doFetch = doFetch
  }

  async *stream(messages: ChatMsg[], signal: AbortSignal): AsyncGenerator<string> {
    let res: Response
    try {
      res = await this.doFetch(this.endpoint, {
        method: "POST", signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: messages.filter((m) => m.role !== "system") }),
      })
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e
      throw new ChatError("network", "Could not reach the server. Check your connection and retry.", 0, true)
    }
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => null)
      const code = res.status === 401 || res.status === 404 ? "signed_out" : res.status === 402 ? "plan" : j?.code ?? (res.status === 429 ? "rate_limited" : "http")
      const msg = j?.error ?? (res.status === 404 ? "Sign in to use cloud AI." : `The server returned ${res.status}.`)
      throw new ChatError(code, msg, res.status, res.status === 429 || res.status >= 500)
    }
    const parser = new SseParser(), dec = new TextDecoder(), reader = res.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const m of parser.push(dec.decode(value, { stream: true }))) {
        let d: any
        try { d = JSON.parse(m.data) } catch { continue }
        if (m.event === "delta" && typeof d.text === "string") yield d.text
        else if (m.event === "error") throw new ChatError(String(d.code ?? "error"), String(d.message ?? "The AI request failed."), 502, !!d.retryable)
        else if (m.event === "done") return
      }
    }
  }
}
