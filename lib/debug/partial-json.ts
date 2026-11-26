/**
 * Best-effort parser for a JSON document that is still streaming in.
 * Closes any open string/array/object and drops a dangling key or comma, then
 * JSON.parse. Returns undefined when nothing useful can be recovered yet.
 */
export function parsePartialJson(text: string): unknown {
  const start = text.search(/[{[]/)
  if (start === -1) return undefined
  const s = text.slice(start)

  const stack: string[] = []
  let inString = false
  let escaped = false
  for (const ch of s) {
    if (inString) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === "{") stack.push("}")
    else if (ch === "[") stack.push("]")
    else if (ch === "}" || ch === "]") stack.pop()
  }

  let out = s
  if (inString) {
    if (escaped) out = out.slice(0, -1) // trailing lone backslash
    // a half-written \uXXXX escape would be invalid
    out = out.replace(/\\u[0-9a-fA-F]{0,3}$/, "")
    out += '"'
  }
  const closers = stack.reverse().join("")
  const tidy = (t: string) => t.replace(/,\s*$/, "")
  // Candidates, best first: as-is; without a dangling `"key":`; without a dangling bare token
  // (a key whose colon has not arrived yet, or a half-written literal like `tru`).
  const candidates = [
    tidy(out),
    tidy(out.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*:\s*$/, "")),
    tidy(out.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*$/, "")),
    tidy(out.replace(/,?\s*[A-Za-z0-9.+-]*$/, "")),
  ]
  for (const c of candidates) {
    try {
      return JSON.parse(c + closers)
    } catch {
      /* try next */
    }
  }
  return undefined
}
