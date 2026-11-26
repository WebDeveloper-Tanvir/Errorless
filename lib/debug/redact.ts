/**
 * Secret redaction applied to anything sent to the AI model.
 * Rule: line COUNT is preserved, so line numbers the model reports stay valid.
 */

export interface RedactionFinding {
  kind: string
  count: number
}

interface Rule {
  kind: string
  re: RegExp
  /** Keep a captured prefix (e.g. `password=`) and only replace the secret value. */
  keepGroup?: number
}

const RULES: Rule[] = [
  { kind: "AWS access key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: "GitHub token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g },
  { kind: "Slack token", re: /\bxox[abposr]-[A-Za-z0-9-]{10,}\b/g },
  { kind: "Razorpay key", re: /\brzp_(?:live|test)_[A-Za-z0-9]{8,}\b/g },
  { kind: "Secret key (sk-/sk_)", re: /\bsk[-_](?:live_|test_|ant-|proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { kind: "JWT", re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  { kind: "Bearer token", re: /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{20,}/gi, keepGroup: 1 },
  { kind: "Credentials in URL", re: /(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s@/]{3,}(?=@)/gi, keepGroup: 1 },
  {
    kind: "Secret assignment",
    // name = "value"  /  name: 'value'  (quoted values only, to avoid mangling ordinary code)
    re: /\b((?:[A-Za-z0-9_]*(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?key|auth[_-]?token|token|private[_-]?key)[A-Za-z0-9_]*)["']?\s*[:=]\s*)(["'])[^"'\s\n]{6,}\2/gi,
    keepGroup: 1,
  },
  {
    kind: "Secret in .env style line",
    re: /^([A-Z][A-Z0-9_]*(?:PASSWORD|SECRET|API_KEY|ACCESS_KEY|TOKEN|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*)[^\s#'"][^\s#]{5,}/gm,
    keepGroup: 1,
  },
]

const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g

export function redactSecrets(input: string): { text: string; findings: RedactionFinding[] } {
  const counts = new Map<string, number>()
  const bump = (kind: string) => counts.set(kind, (counts.get(kind) ?? 0) + 1)
  let text = input

  // Private key blocks span lines: replace with the same number of lines.
  text = text.replace(PRIVATE_KEY_BLOCK, (block) => {
    bump("Private key")
    const lines = block.split("\n")
    return ["[REDACTED PRIVATE KEY]", ...lines.slice(1).map(() => "")].join("\n")
  })

  for (const rule of RULES) {
    text = text.replace(rule.re, (...args: unknown[]) => {
      bump(rule.kind)
      const prefix = rule.keepGroup ? String(args[rule.keepGroup]) : ""
      const quote = rule.kind === "Secret assignment" ? String(args[2]) : ""
      return `${prefix}${quote}[REDACTED]${quote}`
    })
  }

  return { text, findings: [...counts].map(([kind, count]) => ({ kind, count })) }
}

export function countRedactions(findings: RedactionFinding[]): number {
  return findings.reduce((n, f) => n + f.count, 0)
}
