import type { DebugResult, Evidence, Fix, MissingContext, Certainty } from "./types.ts"
import { LIMITS } from "./types.ts"
import { lineDiff } from "./diff.ts"

/**
 * Turns whatever the model returned into a DebugResult we can trust the shape of,
 * and enforces the product rules:
 *  - evidence is only "verified" if its quote really appears in the user's input
 *  - line numbers are only kept when they point at that quote
 *  - "confirmed" needs verified evidence, otherwise it is downgraded
 *  - `executed` is always false
 */

export interface NormalizeContext {
  code: string
  errorText: string
}

const str = (v: unknown, max = 4000): string => (typeof v === "string" ? v.slice(0, max) : "")
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const squash = (s: string) => s.replace(/\s+/g, " ").trim()

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

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

export function normalizeResult(raw: unknown, ctx: NormalizeContext, opts: { partial?: boolean } = {}): DebugResult {
  const partial = !!opts.partial
  const r = isObj(raw) ? raw : {}
  const warnings: string[] = []
  const lineCount = ctx.code ? ctx.code.split("\n").length : 0

  const rc = isObj(r.rootCause) ? r.rootCause : {}
  let certainty: Certainty = oneOf(rc.certainty, ["confirmed", "likely", "hypothesis"] as const, "hypothesis")

  const evidence: Evidence[] = arr(r.evidence)
    .filter(isObj)
    .slice(0, LIMITS.evidence)
    .map((e) => {
      const base = {
        source: oneOf(e.source, ["code", "error"] as const, "code"),
        line: Number.isInteger(e.line) ? (e.line as number) : undefined,
        quote: str(e.quote, 500),
        note: str(e.note, 600),
      }
      return partial ? { ...base, line: undefined, verified: null } : verifyEvidence(base, ctx)
    })
    .filter((e) => e.quote || e.note)

  if (!partial) {
    const verifiedCount = evidence.filter((e) => e.verified).length
    if (certainty === "confirmed" && verifiedCount === 0) {
      certainty = "likely"
      warnings.push("The model called this cause confirmed, but none of its evidence could be matched to your input, so it is shown as likely.")
    }
    if (certainty === "likely" && verifiedCount === 0 && evidence.length === 0) certainty = "hypothesis"
    const unverified = evidence.length - verifiedCount
    if (unverified > 0) warnings.push(`${unverified} evidence item${unverified > 1 ? "s" : ""} could not be found in your input and ${unverified > 1 ? "are" : "is"} marked unverified.`)
  }

  let fix: Fix | null = null
  if (isObj(r.fix)) {
    const f = r.fix
    const correctedCode = typeof f.correctedCode === "string" ? f.correctedCode.slice(0, LIMITS.code * 2) : ""
    fix = {
      summary: str(f.summary, 800),
      changes: arr(f.changes)
        .filter(isObj)
        .slice(0, 20)
        .map((c) => ({
          line: !partial && Number.isInteger(c.line) && (c.line as number) >= 1 && (c.line as number) <= lineCount ? (c.line as number) : undefined,
          description: str(c.description, 500),
        }))
        .filter((c) => c.description),
      correctedCode,
      steps: arr(f.steps).filter((s): s is string => typeof s === "string").slice(0, LIMITS.steps).map((s) => s.slice(0, 600)),
      risk: oneOf(f.risk, ["low", "medium", "high"] as const, "medium"),
    }
    if (!partial && fix.correctedCode) {
      if (ctx.code && fix.correctedCode.trim() === ctx.code.trim()) {
        warnings.push("The suggested code is identical to your code, so no fix is shown.")
        fix = null
      } else if (ctx.code) {
        const d = lineDiff(ctx.code, fix.correctedCode)
        const changed = d.added + d.removed
        if (changed > 40 && changed / Math.max(lineCount, 1) > 0.4) {
          warnings.push(`This fix changes ${changed} lines. Smaller is safer. Use Try Again and ask for a minimal fix if this is more than you want.`)
        }
      }
    } else if (!partial && !fix.correctedCode && !fix.summary && !fix.steps.length) {
      fix = null
    }
  }

  const missingContext: MissingContext[] = arr(r.missingContext)
    .filter(isObj)
    .slice(0, LIMITS.questions)
    .map((q) => ({ question: str(q.question, 400), why: str(q.why, 400) }))
    .filter((q) => q.question)

  let status = oneOf(r.status, ["diagnosed", "needs_context"] as const, missingContext.length && !fix ? "needs_context" : "diagnosed")
  if (!partial && status === "diagnosed" && !str(rc.statement) && missingContext.length) status = "needs_context"

  return {
    status,
    rootCause: { statement: str(rc.statement, 800), certainty, basis: str(rc.basis, 800) },
    explanation: str(r.explanation, 3000),
    evidence,
    fix,
    verification: arr(r.verification).filter((s): s is string => typeof s === "string").slice(0, LIMITS.commands).map((s) => s.slice(0, 300)),
    missingContext,
    hypotheses: arr(r.hypotheses).filter((s): s is string => typeof s === "string").slice(0, 5).map((s) => s.slice(0, 500)),
    executed: false,
    warnings,
  }
}
