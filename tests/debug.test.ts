import { test } from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import { redactSecrets } from "../lib/debug/redact.ts"
import { parsePartialJson } from "../lib/debug/partial-json.ts"
import { SseParser, encodeSse } from "../lib/debug/sse.ts"
import { lineDiff, collapseDiff } from "../lib/debug/diff.ts"
import { normalizeResult, verifyEvidence } from "../lib/debug/normalize.ts"
import { buildPrompt } from "../lib/debug/prompt.ts"
import { runDebug } from "../lib/debug/engine.ts"
import type { DebugEvent } from "../lib/debug/types.ts"

// ── redaction ───────────────────────────────────────────────────────────────
test("redact: known token formats are removed and line count is preserved", () => {
  const src = [
    'const aws = "AKIAABCDEFGHIJKLMNOP"',
    'const g = "AIzaSyA1234567890abcdefghijklmnopqrstuv"',
    "const rz = 'rzp_live_abcdefgh12345678'",
    "fetch(url, { headers: { Authorization: 'Bearer abcdefghijklmnopqrstuvwxyz0123' } })",
    "const db = 'postgres://admin:hunter22@db.example.com/app'",
    'password = "supersecret1"',
    "const ok = tokens[0]",
  ].join("\n")
  const { text, findings } = redactSecrets(src)
  assert.equal(text.split("\n").length, src.split("\n").length)
  for (const leak of ["AKIAABCDEFGHIJKLMNOP", "AIzaSyA1234567890", "rzp_live_abcdefgh", "abcdefghijklmnopqrstuvwxyz0123", "hunter22", "supersecret1"]) {
    assert.ok(!text.includes(leak), `${leak} leaked`)
  }
  assert.ok(text.includes("const ok = tokens[0]"), "ordinary code must be untouched")
  assert.ok(text.includes("postgres://admin:[REDACTED]@db.example.com/app"))
  assert.ok(findings.length >= 5)
})

test("redact: private key block keeps line count; .env lines redacted; clean code unchanged", () => {
  const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\nDEFghi\n-----END RSA PRIVATE KEY-----\nafter"
  const r = redactSecrets(key)
  assert.equal(r.text.split("\n").length, key.split("\n").length)
  assert.ok(!r.text.includes("MIIabc"))
  assert.ok(r.text.endsWith("after"))
  assert.ok(!redactSecrets("STRIPE_SECRET_KEY=abcdef123456\nPORT=3000").text.includes("abcdef123456"))
  assert.ok(redactSecrets("PORT=3000").text === "PORT=3000")
  const clean = "def add(a, b):\n    return a + b\n"
  assert.deepEqual(redactSecrets(clean), { text: clean, findings: [] })
})

// ── partial JSON ────────────────────────────────────────────────────────────
test("partial json: recovers objects from truncated streams", () => {
  assert.deepEqual(parsePartialJson('{"a": "hel'), { a: "hel" })
  assert.deepEqual(parsePartialJson('{"a": 1, "b": [1, 2'), { a: 1, b: [1, 2] })
  assert.deepEqual(parsePartialJson('{"a": 1, "b"'), { a: 1 })
  assert.deepEqual(parsePartialJson('{"a": 1, "b":'), { a: 1 })
  assert.deepEqual(parsePartialJson('{"a": [{"x": "q\\"'), { a: [{ x: 'q"' }] })
  assert.deepEqual(parsePartialJson('{"a": "line\\n2\\u00'), { a: "line\n2" })
  assert.equal(parsePartialJson("no json here"), undefined)
  assert.deepEqual(parsePartialJson('{"a":1}'), { a: 1 })
})

// ── SSE ─────────────────────────────────────────────────────────────────────
test("sse: parses events split across arbitrary chunks", () => {
  const wire = encodeSse("partial", { n: 1 }) + encodeSse("result", { ok: true })
  const p = new SseParser()
  const out = []
  for (let i = 0; i < wire.length; i += 7) out.push(...p.push(wire.slice(i, i + 7)))
  assert.deepEqual(out.map((m) => m.event), ["partial", "result"])
  assert.deepEqual(JSON.parse(out[1].data), { ok: true })
})

// ── diff ────────────────────────────────────────────────────────────────────
test("diff: minimal change shows one removal and one addition", () => {
  const a = "a\nb\nc\nd\ne"
  const b = "a\nb\nC\nd\ne"
  const d = lineDiff(a, b)
  assert.equal(d.removed, 1)
  assert.equal(d.added, 1)
  assert.deepEqual(d.ops.filter((o) => o.type === "del").map((o) => o.text), ["c"])
  assert.equal(lineDiff(a, a).added + lineDiff(a, a).removed, 0)
})

test("diff: insertions, deletions and collapsing", () => {
  const a = Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n")
  const b = a.replace("l15", "l15\nnew")
  const d = lineDiff(a, b)
  assert.equal(d.added, 1)
  assert.equal(d.removed, 0)
  const c = collapseDiff(d.ops, 2)
  assert.ok(c.some((x) => x.type === "gap"))
  assert.ok(c.length < d.ops.length)
})

// ── evidence verification / normalization ───────────────────────────────────
const CODE = "function f(items) {\n  return items.map(x => x.id)\n}\nconst r = f(undefined)"
const ERR = "TypeError: Cannot read properties of undefined (reading 'map')\n    at f (app.js:2:16)"
const ctx = { code: CODE, errorText: ERR }

test("evidence: real quote keeps/corrects line; invented quote is unverified with no line", () => {
  const ok = verifyEvidence({ source: "code", line: 9, quote: "items.map(x => x.id)", note: "n" }, ctx)
  assert.equal(ok.verified, true)
  assert.equal(ok.line, 2, "wrong claimed line is corrected to the real one")
  const bad = verifyEvidence({ source: "code", line: 2, quote: "db.connect()", note: "n" }, ctx)
  assert.equal(bad.verified, false)
  assert.equal(bad.line, undefined)
  const e = verifyEvidence({ source: "error", quote: "Cannot read properties of undefined", note: "" }, ctx)
  assert.equal(e.verified, true)
  assert.equal(verifyEvidence({ source: "error", quote: "ECONNREFUSED", note: "" }, ctx).verified, false)
})

test("normalize: 'confirmed' without verified evidence is downgraded; executed is forced false", () => {
  const raw = {
    status: "diagnosed",
    rootCause: { statement: "x", certainty: "confirmed", basis: "b" },
    explanation: "e",
    evidence: [{ source: "code", line: 3, quote: "totally invented()", note: "n" }],
    executed: true,
    verification: ["npm test"],
  }
  const r = normalizeResult(raw, ctx)
  assert.equal(r.rootCause.certainty, "likely")
  assert.equal(r.executed, false)
  assert.ok(r.warnings.length >= 1)
  const good = normalizeResult({ ...raw, evidence: [{ source: "error", quote: "reading 'map'", note: "n" }] }, ctx)
  assert.equal(good.rootCause.certainty, "confirmed")
})

test("normalize: fix identical to input is dropped; out-of-range change lines are dropped; garbage is safe", () => {
  const same = normalizeResult({ rootCause: { statement: "s", certainty: "likely", basis: "" }, fix: { summary: "s", changes: [], steps: [], risk: "low", correctedCode: CODE } }, ctx)
  assert.equal(same.fix?.correctedCode, "", "identical code is not offered as a fix")
  assert.ok(same.warnings.some((w) => w.includes("identical")))
  const f = normalizeResult(
    { rootCause: { statement: "s", certainty: "likely", basis: "" }, fix: { summary: "s", changes: [{ line: 99, description: "d" }, { line: 2, description: "d2" }], steps: ["1"], risk: "bogus", correctedCode: CODE.replace("items.map", "(items ?? []).map") } },
    ctx,
  )
  assert.equal(f.fix?.changes[0].line, undefined)
  assert.equal(f.fix?.changes[1].line, 2)
  assert.equal(f.fix?.risk, "medium")
  const junk = normalizeResult("nonsense", ctx)
  assert.equal(junk.executed, false)
  assert.deepEqual(junk.evidence, [])
})

test("normalize: partial mode never marks verified or keeps line numbers", () => {
  const p = normalizeResult({ evidence: [{ source: "code", line: 2, quote: "items.m", note: "" }] }, ctx, { partial: true })
  assert.equal(p.evidence[0].verified, null)
  assert.equal(p.evidence[0].line, undefined)
})

test("prompt: numbers real code lines and states the no-execution rule", () => {
  const p = buildPrompt({ errorText: ERR, code: CODE, language: "javascript", framework: "", context: "" })
  assert.ok(p.includes("2|   return items.map"))
  assert.ok(p.includes("<error_message>"))
})

// ── engine against a local Gemini-compatible SSE server ─────────────────────
const GOOD = {
  status: "diagnosed",
  rootCause: { statement: "`items` is undefined when f is called.", certainty: "confirmed", basis: "Call site passes undefined." },
  explanation: "f(undefined) reaches items.map.",
  evidence: [
    { source: "error", quote: "Cannot read properties of undefined (reading 'map')", note: "Matches map on undefined." },
    { source: "code", line: 4, quote: "f(undefined)", note: "Call passes undefined." },
    { source: "code", line: 77, quote: "not in the code", note: "invented" },
  ],
  fix: { summary: "Default to an empty array.", changes: [{ line: 2, description: "guard" }], steps: ["Edit line 2"], risk: "low", correctedCode: CODE.replace("items.map", "(items ?? []).map") },
  verification: ["node app.js"],
  missingContext: [],
  hypotheses: [],
}

function startServer(handler: http.RequestListener): Promise<{ url: string; close: () => void; reqs: { url?: string; headers: http.IncomingHttpHeaders; body: any }[] }> {
  const reqs: { url?: string; headers: http.IncomingHttpHeaders; body: any }[] = []
  const server = http.createServer((req, res) => {
    let b = ""
    req.on("data", (c) => (b += c))
    req.on("end", () => {
      reqs.push({ url: req.url, headers: req.headers, body: b ? JSON.parse(b) : null })
      handler(req, res)
    })
  })
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as { port: number }).port
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close(), reqs })
    }),
  )
}

const sse = (res: http.ServerResponse, text: string, chunk = 25) => {
  res.writeHead(200, { "Content-Type": "text/event-stream" })
  for (let i = 0; i < text.length; i += chunk) {
    res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: text.slice(i, i + chunk) }] } }] })}\n\n`)
  }
  res.end()
}

async function collect(gen: AsyncGenerator<DebugEvent>) {
  const out: DebugEvent[] = []
  for await (const e of gen) out.push(e)
  return out
}

const REQ = { errorText: ERR, code: CODE, language: "javascript", framework: "", context: "" }

test("engine: streams partials, then a verified final result; key sent in header not URL", async () => {
  const s = await startServer((_q, res) => sse(res, JSON.stringify(GOOD)))
  try {
    const ev = await collect(runDebug(REQ, { apiKey: "test-key-123", baseUrl: s.url, model: "m1", throttleMs: 0 }))
    assert.equal(ev[0].type, "meta")
    assert.ok(ev.filter((e) => e.type === "partial").length >= 2, "should stream several partial updates")
    const last = ev[ev.length - 1]
    assert.equal(last.type, "result")
    if (last.type !== "result") return
    const r = last.result
    assert.equal(r.rootCause.certainty, "confirmed")
    assert.equal(r.evidence[1].line, 4)
    assert.equal(r.evidence[2].verified, false)
    assert.equal(r.evidence[2].line, undefined)
    assert.equal(r.executed, false)
    assert.ok(r.fix?.correctedCode.includes("(items ?? [])"))
    assert.equal(s.reqs[0].headers["x-goog-api-key"], "test-key-123")
    assert.ok(!s.reqs[0].url?.includes("test-key-123"), "API key must not be in the URL")
    assert.ok(s.reqs[0].url?.includes("/models/m1:streamGenerateContent"))
    assert.equal(s.reqs[0].body.generationConfig.responseMimeType, "application/json")
  } finally {
    s.close()
  }
})

test("engine: redacts secrets BEFORE they reach the model and reports it", async () => {
  const s = await startServer((_q, res) => sse(res, JSON.stringify(GOOD)))
  try {
    const dirty = { ...REQ, code: `${CODE}\nconst k = "AIzaSyA1234567890abcdefghijklmnopqrstuv"`, errorText: `${ERR}\nAuthorization: Bearer abcdefghijklmnopqrstuvwxyz0123` }
    const ev = await collect(runDebug(dirty, { apiKey: "k", baseUrl: s.url, throttleMs: 0 }))
    const sent = JSON.stringify(s.reqs[0].body)
    assert.ok(!sent.includes("AIzaSyA1234567890"))
    assert.ok(!sent.includes("abcdefghijklmnopqrstuvwxyz0123"))
    const meta = ev[0]
    assert.equal(meta.type, "meta")
    if (meta.type === "meta") assert.ok(meta.redactions.length >= 2)
  } finally {
    s.close()
  }
})

for (const [status, code, retryable] of [
  [429, "rate_limited", true],
  [404, "ai_model", false],
  [403, "ai_auth", false],
  [503, "ai_unavailable", true],
] as const) {
  test(`engine: HTTP ${status} becomes a ${code} error event (retryable=${retryable})`, async () => {
    const s = await startServer((_q, res) => {
      res.writeHead(status, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: { message: "secret provider detail" } }))
    })
    try {
      const ev = await collect(runDebug(REQ, { apiKey: "k", baseUrl: s.url }))
      const e = ev[ev.length - 1]
      assert.equal(e.type, "error")
      if (e.type === "error") {
        assert.equal(e.code, code)
        assert.equal(e.retryable, retryable)
        assert.ok(!e.message.includes("secret provider detail"), "provider details must not leak to the client")
      }
    } finally {
      s.close()
    }
  })
}

test("engine: malformed model output and empty stream yield retryable errors", async () => {
  const s1 = await startServer((_q, res) => sse(res, "this is not json at all"))
  const s2 = await startServer((_q, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" })
    res.end()
  })
  try {
    const a = await collect(runDebug(REQ, { apiKey: "k", baseUrl: s1.url }))
    const b = await collect(runDebug(REQ, { apiKey: "k", baseUrl: s2.url }))
    for (const ev of [a, b]) {
      const e = ev[ev.length - 1]
      assert.equal(e.type, "error")
      if (e.type === "error") assert.equal(e.retryable, true)
    }
  } finally {
    s1.close()
    s2.close()
  }
})

test("engine: needs_context result passes through with questions", async () => {
  const ask = { status: "needs_context", rootCause: { statement: "", certainty: "hypothesis", basis: "" }, explanation: "Not enough info.", evidence: [], verification: [], hypotheses: ["Missing env var?"], missingContext: [{ question: "Which Node version?", why: "Behaviour differs." }] }
  const s = await startServer((_q, res) => sse(res, JSON.stringify(ask)))
  try {
    const ev = await collect(runDebug({ ...REQ, code: "" }, { apiKey: "k", baseUrl: s.url }))
    const last = ev[ev.length - 1]
    assert.equal(last.type, "result")
    if (last.type === "result") {
      assert.equal(last.result.status, "needs_context")
      assert.equal(last.result.missingContext[0].question, "Which Node version?")
      assert.equal(last.result.fix, null)
    }
  } finally {
    s.close()
  }
})

test("engine: aborting stops the request without an error event", async () => {
  const s = await startServer((_q, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" })
    res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"status":' }] } }] })}\n\n`)
    // never ends
  })
  try {
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 150)
    const ev = await collect(runDebug(REQ, { apiKey: "k", baseUrl: s.url, signal: ac.signal }))
    assert.ok(!ev.some((e) => e.type === "error" || e.type === "result"))
  } finally {
    s.close()
  }
})
