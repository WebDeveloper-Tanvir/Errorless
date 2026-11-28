/**
 * Small in-memory sliding-window limiter. Best-effort abuse brake (per server instance), not a
 * security boundary; keys are hashed by callers and never stored beyond the window.
 */
export function createLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>()
  return {
    allow(key: string): boolean {
      const t = now()
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs)
      if (recent.length >= max) {
        hits.set(key, recent)
        return false
      }
      recent.push(t)
      hits.set(key, recent)
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((x) => t - x >= windowMs)) hits.delete(k)
      return true
    },
  }
}
