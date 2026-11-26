/** Shared limits, request/event types and errors for the AI debugging workspace. Result types come from schema.ts (Zod). */
import type { DebugResult } from "./schema.ts"

export const LIMITS = {
  errorText: 20_000,
  code: 60_000,
  context: 5_000,
  comment: 500,
  evidence: 8,
  steps: 12,
  commands: 8,
  questions: 3,
} as const

export type {
  Alternative, Certainty, DebugResult, Evidence, Fix, FixChange, InputKind, MissingContext,
} from "./schema.ts"

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
