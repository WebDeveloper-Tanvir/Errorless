import { BRIDGE_SOURCE } from "./bridge.ts"

export type BridgeMessage =
  | { type: "console"; level: "log" | "info" | "warn" | "error" | "debug"; text: string }
  | { type: "error"; message: string; line: number; col: number; stack: string }
  | { type: "loaded" }
  | { type: "done" }

const LEVELS = ["log", "info", "warn", "error", "debug"] as const
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0)

/**
 * Validates a message from the preview iframe. The frame runs untrusted code, so anything it sends is
 * untrusted text: unknown shapes are dropped, strings are capped, and nothing is ever evaluated.
 * The caller must also check `event.source` is the preview frame.
 */
export function parseBridgeMessage(data: unknown, nonce: string): BridgeMessage | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (d.source !== BRIDGE_SOURCE || d.nonce !== nonce) return null
  switch (d.type) {
    case "console": {
      const level = LEVELS.find((l) => l === d.level) ?? "log"
      return { type: "console", level, text: str(d.text, 8000) }
    }
    case "error": return { type: "error", message: str(d.message, 8000) || "Script error", line: num(d.line), col: num(d.col), stack: str(d.stack, 8000) }
    case "loaded": return { type: "loaded" }
    case "done": return { type: "done" }
    default: return null
  }
}
