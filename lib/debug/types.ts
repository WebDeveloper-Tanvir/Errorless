/** Shared types and limits for the AI debugging workspace. Pure: no imports. */

export const LIMITS = {
  errorText: 20_000,
  code: 60_000,
  context: 5_000,
  comment: 500,
  evidence: 8,
  steps: 12,
  commands: 8,
  questions: 4,
} as const

export type Certainty = "confirmed" | "likely" | "hypothesis"

export interface Evidence {
  source: "code" | "error"
  /** 1-based line in the submitted code. Only present when the quote was found there. */
  line?: number
  quote: string
  note: string
  /** true: quote found in the input. false: not found. null: not checked yet (streaming). */
  verified: boolean | null
}

export interface FixChange {
  line?: number
  description: string
}

export interface Fix {
  summary: string
  changes: FixChange[]
  correctedCode: string
  steps: string[]
  risk: "low" | "medium" | "high"
}

export interface MissingContext {
  question: string
  why: string
}

export interface DebugResult {
  status: "diagnosed" | "needs_context"
  rootCause: { statement: string; certainty: Certainty; basis: string }
  explanation: string
  evidence: Evidence[]
  fix: Fix | null
  /** Commands the developer can run. Errorless never runs them. */
  verification: string[]
  missingContext: MissingContext[]
  /** Other possible causes that are NOT confirmed. */
  hypotheses: string[]
  /** Always false: results come from model reasoning, nothing is executed. */
  executed: false
  warnings: string[]
}

export interface DebugRequest {
  errorText: string
  code: string
  language: string
  framework: string
  context: string
}

export type DebugEvent =
  | { type: "meta"; model: string; redactions: { kind: string; count: number }[] }
  | { type: "partial"; result: Partial<DebugResult> }
  | { type: "result"; result: DebugResult }
  | { type: "error"; code: string; message: string; retryable: boolean }

export class DebugError extends Error {
  code: string
  status: number
  retryable: boolean
  constructor(code: string, message: string, status = 500, retryable = false) {
    super(message)
    this.name = "DebugError"
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}
