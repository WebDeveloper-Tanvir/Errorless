/**
 * Pure helpers for the Python runner: traceback cleanup and message validation.
 * (No DOM, so they are unit-tested in Node.)
 */

/** Internal Pyodide/stdlib frames are noise to a student; keep the user's frames and the error line. */
export function cleanTraceback(raw: string): { text: string; line?: number } {
  const lines = raw.replace(/\r\n/g, "\n").trimEnd().split("\n")
  const out: string[] = []
  let keep = true
  for (const l of lines) {
    const frame = /^\s{2}File "([^"]+)", line (\d+)/.exec(l)
    if (frame) keep = frame[1] === "<exec>" || !/^\/lib\/python|_pyodide|^\/lib\/pyodide|site-packages\/pyodide/.test(frame[1])
    else if (!/^\s/.test(l)) keep = true
    if (keep) out.push(l)
  }
  const text = out.join("\n").trim()
  const all = [...text.matchAll(/File "<exec>", line (\d+)/g)]
  const line = all.length ? Number(all[all.length - 1][1]) : undefined
  return { text, line }
}

export const PYTHON_SOURCE = "errorless-python"
export const MAX_OUTPUT_CHARS = 200_000

export type FrameMessage =
  | { type: "ready" }
  | { type: "init-error"; message: string }
  | { type: "worker-error"; message: string }
  | { type: "stdout" | "stderr"; id: number; text: string }
  | { type: "done"; id: number }
  | { type: "error"; id: number; message: string }

const isStr = (v: unknown): v is string => typeof v === "string"

/** Accept only well-formed messages carrying this run's nonce; everything else is ignored. */
export function parseFrameMessage(data: unknown, nonce: string): FrameMessage | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (d.source !== PYTHON_SOURCE || d.nonce !== nonce) return null
  const id = typeof d.id === "number" ? d.id : -1
  switch (d.type) {
    case "ready": return { type: "ready" }
    case "init-error": return { type: "init-error", message: isStr(d.message) ? d.message.slice(0, 2000) : "Python failed to start." }
    case "worker-error": return { type: "worker-error", message: isStr(d.message) ? d.message.slice(0, 2000) : "The Python worker crashed." }
    case "stdout":
    case "stderr": return isStr(d.text) ? { type: d.type, id, text: d.text.slice(0, 20_000) } : null
    case "done": return { type: "done", id }
    case "error": return { type: "error", id, message: isStr(d.message) ? d.message.slice(0, 20_000) : "Python error" }
    default: return null
  }
}
