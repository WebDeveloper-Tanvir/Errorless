/** One line in the run log, shared by the Terminal, Output and Debug tabs. */
export type EventKind = "command" | "system" | "stdout" | "stderr" | "warn" | "success" | "error"
export interface RuntimeEvent { id: number; kind: EventKind; text: string; at: number }
export interface RunProblem { id: number; severity: "error" | "warning"; message: string; file: string; line: number; column: number; source: string }

/** How an event reads in the terminal: system lines get a "> " prefix, results a ✓ / ✗. */
export function terminalText(e: Pick<RuntimeEvent, "kind" | "text">): string {
  switch (e.kind) {
    case "command": return `$ ${e.text}`
    case "system": return `> ${e.text}`
    case "success": return `✓ ${e.text}`
    case "error": return `✗ ${e.text}`
    default: return e.text
  }
}
