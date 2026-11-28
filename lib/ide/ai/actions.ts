import type { ChatMsg } from "./types.ts"

export const SYSTEM_PROMPT = `You are Errorless, a careful coding assistant inside an in-browser IDE.
Rules you always follow:
- Never invent files, functions, APIs or line numbers. Only refer to what is in the code and error text you were given. If something is not in the input, say it is unknown.
- Never claim you ran or tested code. You cannot execute anything. Describe how the user can verify.
- Separate CONFIRMED causes (directly shown by the error or code) from HYPOTHESES, and label each.
- Prefer the smallest change that fixes the problem. Do not rewrite unrelated code.
- Put corrected code in ONE fenced code block that tags the language, containing the complete replacement for the code you were asked about (the selection if one was given, otherwise the whole file), with no "..." placeholders.
- Never repeat secrets, API keys or tokens you see; refer to them as [REDACTED].
- Be concise. Use Markdown.`

export type ActionId =
  | "explain" | "bugs" | "fix-error" | "optimize" | "generate"
  | "explain-selected" | "refactor" | "docs" | "tests" | "explain-terminal"

export interface ActionDef { id: ActionId; label: string; hint: string; needs: "code" | "selection" | "error" | "terminal" | "prompt" }

export const ACTIONS: readonly ActionDef[] = [
  { id: "explain", label: "Explain Code", hint: "Walk through what the file does", needs: "code" },
  { id: "bugs", label: "Find Bugs", hint: "Review for defects, with evidence", needs: "code" },
  { id: "fix-error", label: "Fix This Error", hint: "Root cause and a fix for the last error", needs: "error" },
  { id: "optimize", label: "Optimize", hint: "Faster or simpler, behaviour preserved", needs: "code" },
  { id: "generate", label: "Generate Code", hint: "Write code from your description", needs: "prompt" },
  { id: "explain-selected", label: "Explain Selected", hint: "Explain only the selected code", needs: "selection" },
  { id: "refactor", label: "Refactor", hint: "Clearer structure, same behaviour", needs: "code" },
  { id: "docs", label: "Write Documentation", hint: "Docstrings / comments / README text", needs: "code" },
  { id: "tests", label: "Generate Unit Tests", hint: "Tests for the code, in its own language", needs: "code" },
  { id: "explain-terminal", label: "Explain Terminal Output", hint: "Make sense of the latest output", needs: "terminal" },
]

export const MAX_CODE_CHARS = 12_000
export const MAX_ERROR_CHARS = 4_000

export interface ActionContext {
  filename?: string
  language?: string
  /** Whole file. */
  code?: string
  /** Selected text, if any. */
  selection?: string
  /** Latest error / stack trace text. */
  error?: string
  /** Recent terminal lines. */
  terminal?: string
  /** Free-text instruction from the user. */
  prompt?: string
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}\n… [truncated ${s.length - max} characters]` : s)
const fence = (lang: string | undefined, code: string) => "```" + (lang ?? "") + "\n" + code.replace(/```/g, "'''") + "\n```"

export type ContextProblem = { ok: false; message: string } | { ok: true }

/** Says what is missing for an action, so the UI can explain instead of sending a useless request. */
export function checkContext(id: ActionId, c: ActionContext): ContextProblem {
  const def = ACTIONS.find((a) => a.id === id)!
  const miss = (m: string): ContextProblem => ({ ok: false, message: m })
  switch (def.needs) {
    case "code": return c.code?.trim() ? { ok: true } : miss("Open a file with some code first.")
    case "selection": return c.selection?.trim() ? { ok: true } : miss("Select some code in the editor first.")
    case "error": return c.error?.trim() ? { ok: true } : miss("There is no error to fix yet. Run the file first; if it fails, the error is used here.")
    case "terminal": return c.terminal?.trim() ? { ok: true } : miss("The terminal is empty. Run something first.")
    case "prompt": return c.prompt?.trim() ? { ok: true } : miss("Describe the code you want in the message box.")
  }
}

const TASKS: Record<ActionId, string> = {
  explain: "Explain what this code does, step by step, for a learner. Mention anything surprising.",
  bugs: "Review this code for bugs. For each one give: the problem, the exact code that shows it (quote it), why it is wrong, and a fix. Mark each as CONFIRMED or HYPOTHESIS. If you find none, say so plainly.",
  "fix-error": "Diagnose this error. Respond with these sections, in this order: ## Root cause (state it, and label it CONFIRMED or HYPOTHESIS), ## Evidence (quote the exact error text and code lines that support it), ## Solution (the smallest change), ## Corrected code (one fenced block, the complete replacement), ## Explanation, ## Verification (how the user can check the fix themselves; you have not run anything).",
  optimize: "Suggest optimizations that keep behaviour identical. Say what each change gains. Return the optimized code in one fenced block. If the code is already reasonable, say so rather than inventing changes.",
  generate: "Write the code described in the user's request, in the language of the open file (or the language they name). Return it in one fenced block, then a short note on how to run it.",
  "explain-selected": "Explain only the SELECTED code. Use the rest of the file only as context.",
  refactor: "Refactor for clarity and maintainability without changing behaviour. Return the complete refactored code in one fenced block, then list the changes.",
  docs: "Write documentation for this code in the idiom of its language (docstrings for Python, JSDoc for JavaScript/TypeScript, Javadoc for Java, comments for C/C++). Return the documented code in one fenced block.",
  tests: "Write unit tests for this code using the standard test framework for its language (unittest/pytest for Python, node:test or Jest-style for JavaScript, etc.). Cover normal cases, edge cases and failures. Return the tests in one fenced block. Do not claim they pass.",
  "explain-terminal": "Explain this terminal output: what happened, whether it indicates success or failure, and what to do next.",
}

/** Builds the user message for an action. Pure, so the context an action sends can be tested. */
export function buildActionMessage(id: ActionId, c: ActionContext): string {
  const parts: string[] = [TASKS[id]]
  const meta = [c.filename && `File: ${c.filename}`, c.language && `Language: ${c.language}`].filter(Boolean).join("\n")
  if (meta) parts.push(meta)
  if (c.prompt?.trim()) parts.push(`User request:\n${clip(c.prompt.trim(), 2000)}`)
  if (c.error?.trim()) parts.push(`Error and stack trace:\n${fence("text", clip(c.error.trim(), MAX_ERROR_CHARS))}`)
  if (c.terminal?.trim() && id === "explain-terminal") parts.push(`Terminal output:\n${fence("text", clip(c.terminal.trim(), MAX_ERROR_CHARS))}`)
  if (c.selection?.trim() && (id === "explain-selected" || id === "refactor" || id === "optimize" || id === "docs" || id === "tests" || id === "fix-error" || id === "bugs")) {
    parts.push(`SELECTED code (replace only this when you return corrected code):\n${fence(c.language, clip(c.selection, MAX_CODE_CHARS))}`)
    if (c.code && id !== "explain-selected") parts.push(`Full file for context:\n${fence(c.language, clip(c.code, MAX_CODE_CHARS))}`)
    else if (c.code) parts.push(`Full file for context:\n${fence(c.language, clip(c.code, MAX_CODE_CHARS))}`)
  } else if (c.code?.trim() && id !== "explain-terminal" && id !== "generate") {
    parts.push(`Code:\n${fence(c.language, clip(c.code, MAX_CODE_CHARS))}`)
  } else if (c.code?.trim() && id === "generate") {
    parts.push(`Open file, for style and language:\n${fence(c.language, clip(c.code, 3000))}`)
  }
  return parts.join("\n\n")
}

export function withSystem(history: ChatMsg[]): ChatMsg[] {
  return [{ role: "system", content: SYSTEM_PROMPT }, ...history.filter((m) => m.role !== "system")]
}

export interface CodeBlock { lang: string; code: string }
/** Fenced code blocks in a Markdown reply, in order. Used by Copy / Apply. */
export function extractCodeBlocks(md: string): CodeBlock[] {
  const out: CodeBlock[] = []
  const re = /^(`{3,})[ \t]*([\w+#.-]*)[^\n]*\n([\s\S]*?)\n\1[ \t]*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(md))) out.push({ lang: m[2] || "", code: m[3] })
  return out
}
