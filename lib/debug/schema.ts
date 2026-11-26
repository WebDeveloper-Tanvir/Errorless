import { z } from "zod"
import { LIMITS } from "./types.ts"

/**
 * Single source of truth for the debugging response.
 *
 *  - ModelOutputSchema: LENIENT. Parses whatever the model returned; bad or missing fields
 *    fall back to safe defaults instead of failing, so a partly good answer is still usable.
 *  - DebugResultSchema: STRICT. The final validated shape the API sends and the UI renders.
 *    The engine refuses to emit a result that does not pass it.
 *
 * The nine product sections map to fields as:
 *  1 Error Summary → summary          2 Root Cause → rootCause        3 Supporting Evidence → evidence
 *  4 Confidence → confidence          5 Recommended Fix → fix         6 Corrected Code → fix.correctedCode
 *  7 Explanation of Changes → fix.changes   8 Verification Steps → verification   9 Prevention → prevention
 */

export const INPUT_KINDS = [
  "error_message", "stack_trace", "source_code", "logs", "config",
  "api_error", "database_error", "docker_error", "dependency_error",
] as const
export const InputKindSchema = z.enum(INPUT_KINDS)
export type InputKind = z.infer<typeof InputKindSchema>

export const CertaintySchema = z.enum(["confirmed", "likely", "hypothesis"])
export type Certainty = z.infer<typeof CertaintySchema>

export const ConfidenceLevelSchema = z.enum(["high", "medium", "low"])

// ── lenient building blocks ────────────────────────────────────────────────
const text = (max: number) => z.string().transform((s) => s.trim().slice(0, max)).catch("")
const optLine = z.number().int().positive().optional().catch(undefined)
const list = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .array(item.nullable().catch(null))
    .catch([])
    .transform((a) => (a.filter((x) => x !== null) as z.infer<T>[]).slice(0, max))
const strList = (max: number, each: number) => list(text(each), max).transform((a) => a.filter(Boolean))
function enumOr<const T extends string>(values: readonly [T, ...T[]], fallback: T) {
  return z.enum(values as unknown as [T, ...T[]]).catch(fallback)
}

// ── final (strict) shape ───────────────────────────────────────────────────
export const EvidenceSchema = z.object({
  source: z.enum(["code", "error"]),
  /** 1-based line in the submitted code. Only present when the quote was found there. */
  line: z.number().int().positive().optional(),
  quote: z.string(),
  note: z.string(),
  /** true: found in the input. false: not found. null: not checked yet (streaming). */
  verified: z.boolean().nullable(),
})
export type Evidence = z.infer<typeof EvidenceSchema>

export const FixChangeSchema = z.object({
  line: z.number().int().positive().optional(),
  description: z.string(),
  why: z.string(),
})
export type FixChange = z.infer<typeof FixChangeSchema>

export const FixSchema = z.object({
  summary: z.string(),
  changes: z.array(FixChangeSchema),
  correctedCode: z.string(),
  steps: z.array(z.string()),
  risk: z.enum(["low", "medium", "high"]),
  /** What the fix deliberately leaves alone, so the developer's intended behavior is kept. */
  preserves: z.string(),
})
export type Fix = z.infer<typeof FixSchema>

export const AlternativeSchema = z.object({
  cause: z.string(),
  likelihood: z.enum(["likely", "possible", "unlikely"]),
  /** A concrete way for the developer to confirm or rule this cause out. */
  check: z.string(),
})
export type Alternative = z.infer<typeof AlternativeSchema>

export const MissingContextSchema = z.object({ question: z.string(), why: z.string() })
export type MissingContext = z.infer<typeof MissingContextSchema>

export const DependencyIssueSchema = z.object({ name: z.string(), problem: z.string() })

export const DebugResultSchema = z.object({
  status: z.enum(["diagnosed", "needs_context"]),
  /** 1. Error Summary: what the developer sees (symptoms), kept apart from the cause. */
  summary: z.object({
    headline: z.string(),
    symptoms: z.array(z.string()),
    inputKinds: z.array(InputKindSchema),
  }),
  detected: z.object({
    language: z.string(),
    framework: z.string(),
    source: z.enum(["model", "heuristic", "user", "unknown"]),
  }),
  dependencyIssues: z.array(DependencyIssueSchema),
  /** 2. Root Cause */
  rootCause: z.object({ statement: z.string(), certainty: CertaintySchema, basis: z.string(), explanation: z.string() }),
  /** 3. Supporting Evidence */
  evidence: z.array(EvidenceSchema),
  /** 4. Confidence Level: derived from verified evidence in code, never self-reported by the model. */
  confidence: z.object({ level: ConfidenceLevelSchema, reason: z.string() }),
  /** Other possible causes. Present when evidence is insufficient. */
  alternatives: z.array(AlternativeSchema),
  /** 5-7. Recommended fix, corrected code, explanation of changes. */
  fix: FixSchema.nullable(),
  /** 8. Verification: commands/checks for the developer to run. Errorless never runs them. */
  verification: z.array(z.string()),
  /** 9. Prevention */
  prevention: z.array(z.string()),
  missingContext: z.array(MissingContextSchema),
  /** Always false: results come from model reasoning, nothing is executed. */
  executed: z.literal(false),
  warnings: z.array(z.string()),
})
export type DebugResult = z.infer<typeof DebugResultSchema>

// ── lenient model output ───────────────────────────────────────────────────
const ModelOutputObject = z.object({
  status: enumOr(["diagnosed", "needs_context"], "diagnosed"),
  summary: z
    .object({ headline: text(300), symptoms: strList(5, 300) })
    .catch({ headline: "", symptoms: [] }),
  detected: z
    .object({ language: text(40), framework: text(60) })
    .catch({ language: "", framework: "" }),
  dependencyIssues: list(z.object({ name: text(120), problem: text(300) }), 5),
  rootCause: z
    .object({ statement: text(800), certainty: enumOr(["confirmed", "likely", "hypothesis"], "hypothesis"), basis: text(800), explanation: text(2000) })
    .catch({ statement: "", certainty: "hypothesis", basis: "", explanation: "" }),
  evidence: list(
    z.object({ source: enumOr(["code", "error"], "code"), line: optLine, quote: text(500), note: text(600) }),
    LIMITS.evidence,
  ),
  alternatives: list(
    z.object({ cause: text(500), likelihood: enumOr(["likely", "possible", "unlikely"], "possible"), check: text(500) }),
    4,
  ),
  fix: z
    .object({
      summary: text(800),
      changes: list(z.object({ line: optLine, description: text(500), why: text(500) }), 20),
      steps: strList(LIMITS.steps, 600),
      risk: enumOr(["low", "medium", "high"], "medium"),
      preserves: text(500),
      correctedCode: z.string().transform((s) => s.slice(0, LIMITS.code * 2)).catch(""),
    })
    .nullable()
    .catch(null),
  verification: strList(LIMITS.commands, 300),
  prevention: strList(5, 400),
  missingContext: list(z.object({ question: text(400), why: text(400) }), LIMITS.questions),
})
/** Anything that is not an object (null, text, arrays) is treated as an empty answer. */
export const ModelOutputSchema = z.preprocess((v) => (typeof v === "object" && v !== null && !Array.isArray(v) ? v : {}), ModelOutputObject)
export type ModelOutput = z.infer<typeof ModelOutputObject>

// ── request ────────────────────────────────────────────────────────────────
export const DebugRequestSchema = z.object({
  errorText: z.string().max(LIMITS.errorText),
  code: z.string().max(LIMITS.code),
  language: z.string().max(40).catch("auto"),
  framework: z.string().max(60).catch("auto"),
  context: z.string().max(LIMITS.context),
})
