import { DebugResultSchema, ModelOutputSchema, type Certainty, type DebugResult, type Evidence, type Fix } from "./schema.ts"
import { detectFramework, detectInputKinds, detectLanguage } from "./detect.ts"
import { lineDiff } from "./diff.ts"

/**
 * Turns whatever the model returned into a DebugResult we can trust the shape of,
 * and enforces the product rules:
 *  - evidence is only "verified" if its quote really appears in the user's input
 *  - line numbers are only kept when they point at that quote
 *  - "confirmed" needs verified evidence, otherwise it is downgraded
 *  - a root cause that merely repeats the error message (a symptom) is capped at "likely"
 *  - confidence is DERIVED here from verified evidence, never taken from the model
 *  - wording that claims code was run/tested is removed; destructive commands are removed
 *  - follow-up questions are dropped when the cause is already confirmed
 *  - language/framework/dependency claims are checked against the input
 *  - `executed` is always false
 */

export interface NormalizeContext {
  code: string
  errorText: string
  /** What the user picked in the UI. "auto"/"none"/"other"/"" count as not specified. */
  language?: string
  framework?: string
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const squash = (s: string) => s.replace(/\s+/g, " ").trim()

export function verifyEvidence(
  e: { source: "code" | "error"; line?: number; quote: string; note: string },
  ctx: NormalizeContext,
): Evidence {
  const quote = e.quote.trim()
  const needle = squash(quote)
  if (!needle) return { ...e, line: undefined, verified: false }

  if (e.source === "error") {
    const ok = squash(ctx.errorText).includes(needle)
    return { source: "error", quote, note: e.note, verified: ok }
  }

  const lines = ctx.code.split("\n")
  const claimed = Number.isInteger(e.line) ? (e.line as number) : undefined
  if (claimed && claimed >= 1 && claimed <= lines.length && squash(lines[claimed - 1]).includes(needle)) {
    return { source: "code", line: claimed, quote, note: e.note, verified: true }
  }
  const matches: number[] = []
  lines.forEach((l, i) => {
    if (squash(l).includes(needle)) matches.push(i + 1)
  })
  if (matches.length === 1) return { source: "code", line: matches[0], quote, note: e.note, verified: true }
  if (matches.length > 1) return { source: "code", quote, note: e.note, verified: true } // present, but line ambiguous
  // Multi-line quote?
  if (squash(ctx.code).includes(needle)) return { source: "code", quote, note: e.note, verified: true }
  return { source: "code", quote, note: e.note, verified: false }
}

const isAuto = (v?: string) => !v || /^(auto|none|other)/i.test(v.trim())

// Sentences that claim the code was executed or a fix was proven by running it.
const EXEC_CLAIM =
  /\b(?:I|we)(?:'ve| have)?\s+(?:ran|run|executed|tested|verified|reproduced|compiled|confirmed)\b|\b(?:has|have) been (?:tested|verified|executed|run|reproduced)\b|\b(?:verified|confirmed|validated) (?:by|through) (?:running|executing|testing)\b|\b(?:tests?|the build|the code) (?:now )?(?:pass(?:es|ed)?|succeed(?:s|ed)?)\b(?! after you| once you| if| when)/i

export function scrubExecutionClaims(input: string): { text: string; removed: number } {
  if (!input || !EXEC_CLAIM.test(input)) return { text: input, removed: 0 }
  const sentences = input.split(/(?<=[.!?])\s+/)
  const kept = sentences.filter((x) => !EXEC_CLAIM.test(x))
  return { text: kept.join(" ").trim(), removed: sentences.length - kept.length }
}

// Commands we never pass on as suggestions, whatever the model says.
const UNSAFE_COMMAND =
  /\brm\s+-[a-z]*[rf][a-z]*\b|\bdrop\s+(?:table|database|schema)\b|\btruncate\s+table\b|\bdelete\s+from\s+\w+\s*;?\s*$|git\s+reset\s+--hard|git\s+clean\s+-[a-z]*f|git\s+push\b.*--force|docker\s+system\s+prune|docker\s+volume\s+(?:rm|prune)|\bmkfs\b|\bdd\s+if=|:\(\)\s*\{|\|\s*(?:sudo\s+)?(?:sh|bash)\b|chmod\s+-R\s+777|\bsudo\b|>\s*\/dev\/sd|npm\s+(?:un)?publish|--no-verify/i

export function isUnsafeCommand(c: string): boolean {
  return UNSAFE_COMMAND.test(c)
}

function firstErrorLine(errorText: string): string {
  const lines = errorText.split("\n").map((l) => l.trim()).filter(Boolean)
  return lines.find((l) => /error|exception|failed|cannot|can't|panic|fatal|denied|refused|not found/i.test(l)) ?? lines[0] ?? ""
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()

/** True when the "root cause" is basically the error message again. */
export function restatesSymptom(statement: string, errorText: string): boolean {
  const a = words(statement)
  const b = words(firstErrorLine(errorText))
  if (!a || !b) return false
  if (a === b) return true
  if (b.length >= 12 && (a.includes(b) || b.includes(a)) && Math.max(a.length, b.length) < Math.min(a.length, b.length) * 1.6) return true
  return false
}

export function normalizeResult(raw: unknown, ctx: NormalizeContext, opts: { partial?: boolean } = {}): DebugResult {
  const partial = !!opts.partial
  const m = ModelOutputSchema.parse(isObj(raw) ? raw : {})
  const warnings: string[] = []
  const lineCount = ctx.code ? ctx.code.split("\n").length : 0
  const input = `${ctx.errorText}\n${ctx.code}`

  // ── never-claim-execution: strip wording that says the code was run ───────
  let scrubbed = 0
  const clean = (s: string) => {
    const r = scrubExecutionClaims(s)
    scrubbed += r.removed
    return r.text
  }

  // ── evidence ──────────────────────────────────────────────────────────────
  const evidence: Evidence[] = m.evidence
    .map((e) => {
      const base = { source: e.source, line: e.line, quote: e.quote, note: clean(e.note) }
      return partial ? { ...base, line: undefined, verified: null } : verifyEvidence(base, ctx)
    })
    .filter((e) => e.quote || e.note)
  const verifiedCount = evidence.filter((e) => e.verified).length

  // ── certainty ─────────────────────────────────────────────────────────────
  let certainty: Certainty = m.rootCause.certainty
  const statement = clean(m.rootCause.statement)
  if (!partial) {
    if (certainty === "confirmed" && verifiedCount === 0) {
      certainty = "likely"
      warnings.push("The model called this cause confirmed, but none of its evidence could be matched to your input, so it is shown as likely.")
    }
    if (certainty === "likely" && evidence.length === 0) certainty = "hypothesis"
    if (statement && restatesSymptom(statement, ctx.errorText)) {
      if (certainty === "confirmed") certainty = "likely"
      warnings.push("This root cause mostly repeats the error message. That is the symptom; the underlying reason may be different.")
    }
    const unverified = evidence.length - verifiedCount
    if (unverified > 0) warnings.push(`${unverified} evidence item${unverified > 1 ? "s" : ""} could not be found in your input and ${unverified > 1 ? "are" : "is"} marked unverified.`)
  }

  // ── missing context: essential only ───────────────────────────────────────
  const seen = new Set<string>()
  let missingContext = m.missingContext.filter((q) => {
    const k = words(q.question)
    if (!q.question || seen.has(k)) return false
    seen.add(k)
    return true
  })

  // ── fix ───────────────────────────────────────────────────────────────────
  let fix: Fix | null = null
  let unsafeRemoved = 0
  if (m.fix) {
    const f = m.fix
    const safe = (c: string) => {
      if (isUnsafeCommand(c)) {
        unsafeRemoved++
        return false
      }
      return true
    }
    fix = {
      summary: clean(f.summary),
      changes: f.changes
        .map((c) => ({
          line: !partial && c.line && c.line <= lineCount ? c.line : undefined,
          description: clean(c.description),
          why: clean(c.why),
        }))
        .filter((c) => c.description),
      correctedCode: f.correctedCode,
      steps: f.steps.filter(safe).map(clean).filter(Boolean),
      risk: f.risk,
      preserves: clean(f.preserves),
    }
    if (!partial && fix.correctedCode) {
      if (ctx.code && fix.correctedCode.trim() === ctx.code.trim()) {
        warnings.push("The suggested code is identical to your code, so no corrected code is shown.")
        fix.correctedCode = ""
      } else if (ctx.code) {
        const d = lineDiff(ctx.code, fix.correctedCode)
        const changed = d.added + d.removed
        if (changed > 40 && changed / Math.max(lineCount, 1) > 0.4) {
          warnings.push(`This fix changes ${changed} lines. Smaller is safer. Use Try Again and ask for a minimal fix if this is more than you want.`)
        }
      } else {
        warnings.push("No code was provided, so the corrected code is an illustration, not a patch to your file.")
      }
    }
    if (!partial && !fix.correctedCode && !fix.summary && !fix.steps.length && !fix.changes.length) fix = null
  }

  const verification = m.verification.filter((c) => {
    if (isUnsafeCommand(c)) {
      unsafeRemoved++
      return false
    }
    return true
  })
  if (unsafeRemoved) warnings.push(`Removed ${unsafeRemoved} potentially destructive command${unsafeRemoved > 1 ? "s" : ""} from the suggestions.`)

  // ── status ────────────────────────────────────────────────────────────────
  let status: DebugResult["status"] = m.status
  if (!partial) {
    if (status === "diagnosed" && !statement && missingContext.length) status = "needs_context"
    if (status === "needs_context" && certainty === "confirmed") certainty = "likely"
    if (status === "needs_context") certainty = certainty === "likely" && verifiedCount > 0 ? "likely" : "hypothesis"
    // If the cause is already confirmed from evidence, extra questions are not essential.
    if (certainty === "confirmed" && status === "diagnosed") missingContext = []
  }

  // ── alternatives ──────────────────────────────────────────────────────────
  const alternatives = m.alternatives
    .map((a) => ({ ...a, cause: clean(a.cause), check: clean(a.check) }))
    .filter((a) => a.cause && words(a.cause) !== words(statement))

  // ── confidence: derived in code, not self-reported ───────────────────────
  let level: DebugResult["confidence"]["level"] = "low"
  if (certainty === "confirmed" && status === "diagnosed") level = "high"
  else if (certainty === "likely") level = "medium"
  const total = evidence.length
  const reason = partial
    ? ""
    : level === "high"
      ? `${verifiedCount} of ${total} evidence quote${total === 1 ? "" : "s"} found in your input and they directly prove the cause.`
      : level === "medium"
        ? `${verifiedCount} of ${total} evidence quote${total === 1 ? "" : "s"} found in your input. Strong signs, but not proof. Check it with the steps below.`
        : total === 0
          ? "No quotable evidence, so this is a lead to investigate, not a conclusion."
          : `${verifiedCount} of ${total} evidence quote${total === 1 ? "" : "s"} found in your input. Not enough to be sure. Treat this as a hypothesis and compare it with the other possible causes.`

  // ── detection (checked against the input, never trusted blindly) ─────────
  const heurLang = detectLanguage(ctx.errorText, ctx.code)
  const heurFw = detectFramework(ctx.errorText, ctx.code)
  const language = !isAuto(ctx.language)
    ? { v: ctx.language as string, source: "user" as const }
    : m.detected.language
      ? { v: m.detected.language, source: "model" as const }
      : heurLang
        ? { v: heurLang.language, source: "heuristic" as const }
        : { v: "unknown", source: "unknown" as const }
  const framework = !isAuto(ctx.framework)
    ? ctx.framework!
    : m.detected.framework || heurFw || ""
  const dependencyIssues = m.dependencyIssues
    .filter((d) => d.name && input.toLowerCase().includes(d.name.toLowerCase()))
    .map((d) => ({ name: d.name, problem: clean(d.problem) }))

  const inputKinds = detectInputKinds(ctx.errorText, ctx.code)
  const headline = clean(m.summary.headline) || firstErrorLine(ctx.errorText).slice(0, 300)

  if (scrubbed > 0) warnings.push("Removed wording that implied the code was run. Errorless does not execute code.")

  const result: DebugResult = {
    status,
    summary: { headline, symptoms: m.summary.symptoms.map(clean).filter(Boolean), inputKinds },
    detected: { language: language.v, framework, source: language.source },
    dependencyIssues,
    rootCause: { statement, certainty, basis: clean(m.rootCause.basis), explanation: clean(m.rootCause.explanation) },
    evidence,
    confidence: { level, reason },
    alternatives,
    fix,
    verification,
    prevention: m.prevention.map(clean).filter(Boolean),
    missingContext,
    executed: false,
    warnings,
  }
  // Last gate: nothing leaves the engine unless it matches the strict schema.
  return DebugResultSchema.parse(result)
}
