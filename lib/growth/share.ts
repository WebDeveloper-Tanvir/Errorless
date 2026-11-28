import { z } from "zod"
import { redactSecrets } from "../debug/redact.ts"
import type { DebugResult } from "../debug/schema.ts"
import { SHARE } from "./config.ts"

/**
 * Shareable debugging results. Private by default: nothing is public until the owner
 * explicitly consents; the link is an unguessable token (only its SHA-256 is stored);
 * it expires and can be revoked. The submitted code and error text are NEVER included.
 * Evidence quotes and corrected code (which contain the owner's code) are opt-in extras.
 */

const str = (max: number) => z.string().max(max)
export const SharedResultSchema = z.object({
  v: z.literal(1),
  title: str(120),
  language: str(40),
  framework: str(60),
  headline: str(400),
  symptoms: z.array(str(300)).max(5),
  rootCause: z.object({ statement: str(900), certainty: z.enum(["confirmed", "likely", "hypothesis"]), explanation: str(2100) }),
  confidence: z.object({ level: z.enum(["high", "medium", "low"]), reason: str(500) }),
  fix: z
    .object({
      summary: str(600),
      steps: z.array(str(400)).max(10),
      risk: z.enum(["low", "medium", "high"]),
      changes: z.array(z.object({ description: str(400), why: str(500) })).max(8),
      /** Only when the owner ticked "include corrected code". */
      correctedCode: str(30_000).optional(),
    })
    .nullable(),
  /** Only when the owner ticked "include evidence quotes". */
  evidence: z.array(z.object({ quote: str(500), note: str(600) })).max(8).optional(),
  alternatives: z.array(z.object({ cause: str(500), check: str(500) })).max(4),
  verification: z.array(str(400)).max(8),
  prevention: z.array(str(400)).max(8),
  includes: z.object({ evidence: z.boolean(), correctedCode: z.boolean() }),
})
export type SharedResult = z.infer<typeof SharedResultSchema>

export interface ShareOptions {
  title?: string
  includeEvidence: boolean
  includeCorrectedCode: boolean
}

const clean = (s: string) => redactSecrets(s).text

export function buildSharePayload(r: DebugResult, o: ShareOptions): SharedResult {
  const out: SharedResult = {
    v: 1,
    title: clean((o.title || r.summary.headline || "Debugging result").trim()).slice(0, 120),
    language: r.detected.language,
    framework: r.detected.framework,
    headline: clean(r.summary.headline),
    symptoms: r.summary.symptoms.map(clean),
    rootCause: { statement: clean(r.rootCause.statement), certainty: r.rootCause.certainty, explanation: clean(r.rootCause.explanation) },
    confidence: { level: r.confidence.level, reason: clean(r.confidence.reason) },
    fix: r.fix
      ? {
          summary: clean(r.fix.summary),
          steps: r.fix.steps.map(clean),
          risk: r.fix.risk,
          changes: r.fix.changes.map((c) => ({ description: clean(c.description), why: clean(c.why) })),
          ...(o.includeCorrectedCode && r.fix.correctedCode ? { correctedCode: clean(r.fix.correctedCode) } : {}),
        }
      : null,
    ...(o.includeEvidence ? { evidence: r.evidence.filter((e) => e.verified !== false).map((e) => ({ quote: clean(e.quote), note: clean(e.note) })) } : {}),
    alternatives: r.alternatives.map((a) => ({ cause: clean(a.cause), check: clean(a.check) })),
    verification: r.verification.map(clean),
    prevention: r.prevention.map(clean),
    includes: { evidence: o.includeEvidence, correctedCode: o.includeCorrectedCode && !!r.fix?.correctedCode },
  }
  return out
}

export type ParseShare = { ok: true; value: SharedResult; bytes: number } | { ok: false; error: string }

/** Server-side gate: validates shape, re-redacts every string, enforces the size cap. */
export function parseSharePayload(input: unknown): ParseShare {
  const parsed = SharedResultSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "The result to share is not in the expected format." }
  const value = redactDeep(parsed.data)
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length
  if (bytes > SHARE.maxPayloadBytes) return { ok: false, error: "This result is too large to share." }
  return { ok: true, value, bytes }
}

function redactDeep<T>(v: T): T {
  if (typeof v === "string") return clean(v) as T
  if (Array.isArray(v)) return v.map(redactDeep) as T
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redactDeep(x)])) as T
  return v
}

// ── tokens ─────────────────────────────────────────────────────────────────
const B64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

/** 192 bits of randomness, URL-safe. Shown to the owner once; only its hash is stored. */
export function generateShareToken(): string {
  return B64(globalThis.crypto.getRandomValues(new Uint8Array(24)))
}
export const isShareToken = (t: string) => /^[A-Za-z0-9_-]{32}$/.test(t)

export async function hashToken(token: string): Promise<string> {
  const d = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("")
}

export function clampDays(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : SHARE.defaultDays
  return Math.min(SHARE.maxDays, Math.max(1, n))
}
