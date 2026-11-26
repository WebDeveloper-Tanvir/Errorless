/** Line diff (LCS) used for the Before/After view. Pure. */

export type DiffOp =
  | { type: "same"; aLine: number; bLine: number; text: string }
  | { type: "del"; aLine: number; text: string }
  | { type: "add"; bLine: number; text: string }

export interface DiffResult {
  ops: DiffOp[]
  added: number
  removed: number
}

const MAX_CELLS = 4_000_000

export function lineDiff(before: string, after: string): DiffResult {
  const a = before.split("\n")
  const b = after.split("\n")

  let pre = 0
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++
  let suf = 0
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++

  const am = a.slice(pre, a.length - suf)
  const bm = b.slice(pre, b.length - suf)
  const ops: DiffOp[] = []

  for (let i = 0; i < pre; i++) ops.push({ type: "same", aLine: i + 1, bLine: i + 1, text: a[i] })

  const n = am.length
  const m = bm.length
  if (n * m > MAX_CELLS) {
    // Too large for LCS: report the middle as one replaced block.
    am.forEach((t, i) => ops.push({ type: "del", aLine: pre + i + 1, text: t }))
    bm.forEach((t, i) => ops.push({ type: "add", bLine: pre + i + 1, text: t }))
  } else {
    const w = m + 1
    const lcs = new Uint32Array((n + 1) * w)
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        lcs[i * w + j] = am[i] === bm[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1])
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (am[i] === bm[j]) {
        ops.push({ type: "same", aLine: pre + i + 1, bLine: pre + j + 1, text: am[i] })
        i++
        j++
      } else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) {
        ops.push({ type: "del", aLine: pre + i + 1, text: am[i] })
        i++
      } else {
        ops.push({ type: "add", bLine: pre + j + 1, text: bm[j] })
        j++
      }
    }
    while (i < n) ops.push({ type: "del", aLine: pre + ++i, text: am[i - 1] })
    while (j < m) ops.push({ type: "add", bLine: pre + ++j, text: bm[j - 1] })
  }

  for (let k = 0; k < suf; k++) {
    const ai = a.length - suf + k
    const bi = b.length - suf + k
    ops.push({ type: "same", aLine: ai + 1, bLine: bi + 1, text: a[ai] })
  }

  return {
    ops,
    added: ops.filter((o) => o.type === "add").length,
    removed: ops.filter((o) => o.type === "del").length,
  }
}

/** Keep changed lines plus `context` unchanged lines around them; gaps become `gap` entries. */
export function collapseDiff(ops: DiffOp[], context = 3): (DiffOp | { type: "gap"; hidden: number })[] {
  const keep = new Array(ops.length).fill(false)
  ops.forEach((o, i) => {
    if (o.type === "same") return
    for (let k = Math.max(0, i - context); k <= Math.min(ops.length - 1, i + context); k++) keep[k] = true
  })
  const out: (DiffOp | { type: "gap"; hidden: number })[] = []
  let hidden = 0
  ops.forEach((o, i) => {
    if (keep[i]) {
      if (hidden) out.push({ type: "gap", hidden })
      hidden = 0
      out.push(o)
    } else hidden++
  })
  if (hidden) out.push({ type: "gap", hidden })
  return out
}
