import type { KnownError, ToolPage } from "./tools.ts"

export interface Match {
  id: string
  title: string
  why: string
  fix: string
  before: string
  after: string
  codeLang: string
  /** Where in the pasted text the pattern matched (for ordering). */
  index: number
}

export interface Location {
  file: string
  line: number
}

/** Replaces $1, $2 ... with capture groups; unmatched groups become an empty string. */
export function fill(template: string, groups: (string | undefined)[]): string {
  return template.replace(/\$(\d)/g, (_, n) => (groups[Number(n)] ?? "").trim())
}

/**
 * Pattern-based explanation. Runs in the browser, makes no network request, and only
 * reports what the documented patterns on the page say. It does not analyse the user's code.
 */
export function matchKnownErrors(errors: KnownError[], text: string, max = 3): Match[] {
  const out: Match[] = []
  if (!text.trim()) return out
  for (const e of errors) {
    let re: RegExp
    try {
      re = new RegExp(e.pattern, "i")
    } catch {
      continue
    }
    const m = re.exec(text)
    if (!m) continue
    out.push({
      id: e.id,
      title: e.title,
      why: fill(e.why, m),
      fix: fill(e.fix, m),
      before: e.before,
      after: e.after,
      codeLang: e.codeLang,
      index: m.index,
    })
  }
  // Earliest match in the text first; for ties keep the page's own (more specific first) order.
  return out.sort((a, b) => a.index - b.index).slice(0, max)
}

/** The "why"/"fix" text with placeholders filled from the error's own example, for the static guide. */
export function describeError(e: KnownError): { why: string; fix: string } {
  let m: RegExpExecArray | null = null
  try {
    m = new RegExp(e.pattern, "i").exec(e.example)
  } catch {
    /* fall through */
  }
  const groups = m ?? []
  return { why: fill(e.why, groups), fix: fill(e.fix, groups) }
}

export function matchTool(tool: ToolPage, text: string, max = 3): Match[] {
  return matchKnownErrors(tool.errors, text, max)
}

/** Best-effort file:line from a Python, Node/browser or compiler error. */
export function extractLocation(text: string): Location | null {
  const py = /File "([^"]+)", line (\d+)/g
  let last: RegExpExecArray | null = null
  for (let m = py.exec(text); m; m = py.exec(text)) last = m
  if (last) return { file: last[1], line: Number(last[2]) }
  const ts = /([\w./\\-]+\.(?:tsx?|jsx?|mjs|cjs))\((\d+),\d+\)/.exec(text)
  if (ts) return { file: ts[1], line: Number(ts[2]) }
  const js = /\(?([\w./\\@-]+\.(?:tsx?|jsx?|mjs|cjs|py|java|go|rs|rb|php)):(\d+)(?::\d+)?\)?/.exec(text)
  if (js) return { file: js[1], line: Number(js[2]) }
  return null
}
