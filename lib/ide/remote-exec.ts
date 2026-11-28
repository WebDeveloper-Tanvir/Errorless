/**
 * Client for an isolated, Piston-compatible code-execution service (POST {base}/api/v2/execute).
 * User code is NEVER run in the Next.js process: it is sent to a separate service you operate.
 * Pure of Next/Clerk so it can be unit-tested with an injected fetch.
 */
export const REMOTE_LANGUAGES = ["c", "c++", "java"] as const
export type RemoteLanguage = (typeof REMOTE_LANGUAGES)[number]

export const LIMITS = { maxCodeChars: 100_000, maxOutputChars: 100_000, compileMs: 10_000, runMs: 5_000, requestMs: 25_000 }
const FILE_NAMES: Record<RemoteLanguage, string> = { c: "main.c", "c++": "main.cpp", java: "Main.java" }

export interface ExecRequest { language: RemoteLanguage; code: string; filename?: string }
export type ExecResult =
  | { ok: true; compile?: StageOut; run: StageOut }
  | { ok: false; status: number; error: string }
export interface StageOut { stdout: string; stderr: string; code: number | null; signal: string | null }

export function validateExecRequest(b: unknown): { ok: true; value: ExecRequest } | { ok: false; error: string } {
  if (!b || typeof b !== "object") return { ok: false, error: "Send a JSON body." }
  const { language, code, filename } = b as Record<string, unknown>
  if (typeof language !== "string" || !(REMOTE_LANGUAGES as readonly string[]).includes(language)) return { ok: false, error: `language must be one of: ${REMOTE_LANGUAGES.join(", ")}.` }
  if (typeof code !== "string" || !code.trim()) return { ok: false, error: "code must be a non-empty string." }
  if (code.length > LIMITS.maxCodeChars) return { ok: false, error: `code is larger than ${LIMITS.maxCodeChars} characters.` }
  return { ok: true, value: { language: language as RemoteLanguage, code, filename: typeof filename === "string" ? filename.slice(0, 100) : undefined } }
}

const clip = (s: unknown) => (typeof s === "string" ? s.slice(0, LIMITS.maxOutputChars) : "")
const stage = (s: any): StageOut => ({ stdout: clip(s?.stdout), stderr: clip(s?.stderr), code: typeof s?.code === "number" ? s.code : null, signal: typeof s?.signal === "string" ? s.signal : null })

export async function runRemote(
  req: ExecRequest,
  cfg: { url?: string; key?: string },
  doFetch: typeof fetch = fetch,
): Promise<ExecResult> {
  if (!cfg.url) {
    return { ok: false, status: 501, error: "No code-execution service is configured on this deployment (EXEC_SERVICE_URL). C, C++ and Java cannot run here; HTML, CSS, JavaScript, TypeScript and Python run in your browser." }
  }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), LIMITS.requestMs)
  try {
    const res = await doFetch(`${cfg.url.replace(/\/$/, "")}/api/v2/execute`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", ...(cfg.key ? { authorization: cfg.key } : {}) },
      body: JSON.stringify({
        language: req.language,
        version: "*",
        files: [{ name: FILE_NAMES[req.language], content: req.code }],
        compile_timeout: LIMITS.compileMs,
        run_timeout: LIMITS.runMs,
        compile_memory_limit: 256_000_000,
        run_memory_limit: 256_000_000,
      }),
    })
    if (!res.ok) return { ok: false, status: 502, error: `The execution service returned ${res.status}.` }
    const j: any = await res.json().catch(() => null)
    if (!j?.run) return { ok: false, status: 502, error: "The execution service sent an unexpected response." }
    return { ok: true, compile: j.compile ? stage(j.compile) : undefined, run: stage(j.run) }
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError"
    return { ok: false, status: aborted ? 504 : 502, error: aborted ? "The execution service timed out." : "The execution service could not be reached." }
  } finally {
    clearTimeout(timer)
  }
}
