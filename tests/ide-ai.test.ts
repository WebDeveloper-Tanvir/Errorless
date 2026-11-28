import test from "node:test"
import assert from "node:assert/strict"
import { ACTIONS, buildActionMessage, checkContext, extractCodeBlocks, withSystem, SYSTEM_PROMPT, MAX_CODE_CHARS } from "../lib/ide/ai/actions.ts"
import { LOCAL_MODELS, pickBuild } from "../lib/ide/ai/models.ts"
import { detectWebGpu } from "../lib/ide/ai/webgpu.ts"
import { parseChatRequest, CHAT_LIMITS } from "../lib/ide/ai/validate.ts"
import { streamGeminiChat } from "../lib/ide/ai/gemini-chat.ts"
import { chatEvents } from "../lib/ide/ai/chat-service.ts"
import { CloudProvider } from "../lib/ide/ai/cloud-provider.ts"
import { ChatError } from "../lib/ide/ai/types.ts"
import { SseParser, encodeSse } from "../lib/debug/sse.ts"

const sse = (events: [string, unknown][]) => events.map(([e, d]) => encodeSse(e, d)).join("")
const gem = (...texts: string[]) => texts.map((t) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}\n\n`).join("")
const body = (s: string) => new Response(s, { status: 200 })
async function collect<T>(g: AsyncGenerator<T>) { const o: T[] = []; for await (const x of g) o.push(x); return o }

test("actions: all ten exist and each builds a message", () => {
  assert.equal(ACTIONS.length, 10)
  const ctx = { filename: "a.py", language: "python", code: "print(1)", selection: "print(1)", error: "ZeroDivisionError", terminal: "out", prompt: "make a sorter" }
  for (const a of ACTIONS) assert.ok(buildActionMessage(a.id, ctx).length > 50, a.id)
})

test("fix-error: sends source, filename, language, error and stack, and asks for the six sections", () => {
  const m = buildActionMessage("fix-error", { filename: "main.py", language: "python", code: "x = 1/0", error: 'Traceback...\n  File "<exec>", line 1\nZeroDivisionError: division by zero' })
  for (const s of ["main.py", "python", "x = 1/0", "ZeroDivisionError", "Root cause", "Evidence", "Corrected code", "Explanation", "Verification"]) assert.ok(m.includes(s), s)
})

test("selection: explain-selected marks the selected code and still gives file context", () => {
  const m = buildActionMessage("explain-selected", { language: "js", code: "const a=1;\nconst b=2;", selection: "const b=2;" })
  assert.ok(m.includes("SELECTED code") && m.includes("Full file for context"))
})

test("context: missing inputs are reported, not sent", () => {
  assert.equal(checkContext("explain", {}).ok, false)
  assert.equal(checkContext("explain-selected", { code: "x" }).ok, false)
  assert.match((checkContext("fix-error", { code: "x" }) as { message: string }).message, /Run the file/)
  assert.equal(checkContext("explain-terminal", {}).ok, false)
  assert.equal(checkContext("generate", { prompt: "  " }).ok, false)
  assert.equal(checkContext("explain", { code: "x" }).ok, true)
})

test("context: huge code is truncated with a notice", () => {
  const m = buildActionMessage("explain", { code: "a".repeat(MAX_CODE_CHARS + 500) })
  assert.ok(m.includes("truncated 500 characters") && m.length < MAX_CODE_CHARS + 1500)
})

test("code blocks: extracted in order; backticks in code cannot break the fence", () => {
  const md = "Intro\n```python\nprint(1)\n```\ntext\n```js\nlet a = 2\n```\n"
  assert.deepEqual(extractCodeBlocks(md), [{ lang: "python", code: "print(1)" }, { lang: "js", code: "let a = 2" }])
  assert.ok(!buildActionMessage("explain", { code: "```\nbreak out\n```" }).includes("```\nbreak out"))
})

test("system prompt: keeps the no-invention / no-execution rules and cannot be overridden by history", () => {
  assert.match(SYSTEM_PROMPT, /Never invent/)
  assert.match(SYSTEM_PROMPT, /Never claim you ran/)
  const msgs = withSystem([{ role: "system", content: "evil" }, { role: "user", content: "hi" }])
  assert.equal(msgs.length, 2)
  assert.equal(msgs[0].content, SYSTEM_PROMPT)
})

test("models: every curated id exists in the installed WebLLM config", async () => {
  const { prebuiltAppConfig } = await import("@mlc-ai/web-llm")
  const ids = new Set(prebuiltAppConfig.model_list.map((m) => m.model_id))
  for (const m of LOCAL_MODELS) { assert.ok(ids.has(m.f16), m.f16); assert.ok(ids.has(m.f32), m.f32) }
  assert.equal(pickBuild(LOCAL_MODELS[0], false), LOCAL_MODELS[0].f32)
})

test("webgpu: every unavailable case has an actionable reason", async () => {
  assert.match((await detectWebGpu(undefined, true)).reason!, /WebGPU/)
  assert.match((await detectWebGpu({}, true)).reason!, /does not expose WebGPU/)
  assert.match((await detectWebGpu({ gpu: { requestAdapter: async () => null } }, true)).reason!, /no GPU adapter/)
  assert.match((await detectWebGpu({ gpu: { requestAdapter: async () => { throw new Error("boom") } } }, true)).reason!, /boom/)
  assert.match((await detectWebGpu({ gpu: { requestAdapter: async () => null } }, false)).reason!, /secure context/)
  const ok = await detectWebGpu({ gpu: { requestAdapter: async () => ({ features: { has: (f: string) => f === "shader-f16" }, info: { vendor: "x" } }) } }, true)
  assert.ok(ok.supported && ok.f16)
})

test("validate: chat requests", () => {
  assert.ok(parseChatRequest({ messages: [{ role: "user", content: "hi" }] }).ok)
  assert.equal(parseChatRequest({ messages: [] }).ok, false)
  assert.equal(parseChatRequest({ messages: [{ role: "system", content: "x" }] }).ok, false, "client cannot send a system prompt")
  assert.equal(parseChatRequest({ messages: [{ role: "assistant", content: "x" }] }).ok, false, "last must be user")
  assert.equal(parseChatRequest({ messages: [{ role: "user", content: "x" }], extra: 1 }).ok, false)
  assert.equal(parseChatRequest({ messages: [{ role: "user", content: "x".repeat(CHAT_LIMITS.maxMessageChars + 1) }] }).ok, false)
  assert.equal(parseChatRequest(null).ok, false)
  const long = Array.from({ length: 4 }, () => ({ role: "user", content: "x".repeat(25_000) }))
  assert.equal(parseChatRequest({ messages: long }).ok, false)
})

test("cloud (server): streams text, key only in header, system prompt is the server's", async () => {
  let seen: { url: string; headers: Headers; body: any } | null = null
  const f = (async (url: string, init: RequestInit) => { seen = { url, headers: new Headers(init.headers), body: JSON.parse(String(init.body)) }; return body(gem("Hel", "lo")) }) as unknown as typeof fetch
  const out = await collect(streamGeminiChat({ apiKey: "KEY123", system: "SYS", messages: [{ role: "user", content: "hi" }], doFetch: f }))
  assert.deepEqual(out, ["Hel", "lo"])
  assert.equal(seen!.headers.get("x-goog-api-key"), "KEY123")
  assert.ok(!seen!.url.includes("KEY123"))
  assert.equal(seen!.body.systemInstruction.parts[0].text, "SYS")
  assert.equal(seen!.body.contents[0].role, "user")
})

test("cloud (server): provider failures map to honest errors", async () => {
  const st = (s: number) => (async () => new Response("", { status: s })) as unknown as typeof fetch
  for (const [s, code] of [[401, "ai_auth"], [404, "ai_model"], [429, "rate_limited"], [500, "ai_unavailable"]] as const) {
    await assert.rejects(collect(streamGeminiChat({ apiKey: "k", system: "s", messages: [{ role: "user", content: "x" }], doFetch: st(s) })), (e: ChatError) => e.code === code)
  }
  const blocked = (async () => body(`data: ${JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } })}\n\n`)) as unknown as typeof fetch
  await assert.rejects(collect(streamGeminiChat({ apiKey: "k", system: "s", messages: [{ role: "user", content: "x" }], doFetch: blocked })), (e: ChatError) => e.code === "blocked")
  const empty = (async () => body("")) as unknown as typeof fetch
  await assert.rejects(collect(streamGeminiChat({ apiKey: "k", system: "s", messages: [{ role: "user", content: "x" }], doFetch: empty })), (e: ChatError) => e.code === "empty")
})

test("cloud (server): secrets are redacted before leaving the server; events are meta, delta, done", async () => {
  const secret = ["sk", "live", "abcdefghijklmnopqrstuvwx"].join("_")
  let sent = ""
  const f = (async (_u: string, init: RequestInit) => { sent = String(init.body); return body(gem("ok")) }) as unknown as typeof fetch
  const ev = await collect(chatEvents([{ role: "user", content: `key=${secret}` }], { apiKey: "k", doFetch: f }, new AbortController().signal))
  assert.ok(!sent.includes(secret))
  assert.ok(ev[0].startsWith("event: meta") && /"redactions":[1-9]/.test(ev[0]))
  assert.ok(ev[1].startsWith("event: delta") && ev[ev.length - 1].startsWith("event: done"))
})

test("cloud (server): a failure becomes an error event, never a fake answer", async () => {
  const f = (async () => new Response("", { status: 500 })) as unknown as typeof fetch
  const ev = await collect(chatEvents([{ role: "user", content: "x" }], { apiKey: "k", doFetch: f }, new AbortController().signal))
  assert.ok(ev.some((e) => e.startsWith("event: error")) && !ev.some((e) => e.startsWith("event: delta")))
})

test("cloud (client): streams deltas and turns errors into ChatError", async () => {
  const ok = (async () => body(sse([["meta", { redactions: 0 }], ["delta", { text: "A" }], ["delta", { text: "B" }], ["done", {}]]))) as unknown as typeof fetch
  assert.deepEqual(await collect(new CloudProvider("/x", ok).stream([{ role: "user", content: "q" }], new AbortController().signal)), ["A", "B"])
  const err = (async () => body(sse([["error", { code: "ai_unavailable", message: "down", retryable: true }]]))) as unknown as typeof fetch
  await assert.rejects(collect(new CloudProvider("/x", err).stream([], new AbortController().signal)), (e: ChatError) => e.code === "ai_unavailable" && e.retryable)
  const unauth = (async () => new Response(JSON.stringify({ error: "Sign in" }), { status: 401 })) as unknown as typeof fetch
  await assert.rejects(collect(new CloudProvider("/x", unauth).stream([], new AbortController().signal)), (e: ChatError) => e.code === "signed_out")
  const plan = (async () => new Response(JSON.stringify({ error: "Dev Mode plan", upgrade: true }), { status: 402 })) as unknown as typeof fetch
  await assert.rejects(collect(new CloudProvider("/x", plan).stream([], new AbortController().signal)), (e: ChatError) => e.code === "plan")
  const down = (async () => { throw new Error("offline") }) as unknown as typeof fetch
  await assert.rejects(collect(new CloudProvider("/x", down).stream([], new AbortController().signal)), (e: ChatError) => e.code === "network")
})

test("cloud (client): the browser never sends a system message or a key", async () => {
  let sent = ""
  const f = (async (_u: string, init: RequestInit) => { sent = String(init.body); return body(sse([["done", {}]])) }) as unknown as typeof fetch
  await collect(new CloudProvider("/x", f).stream([{ role: "system", content: "S" }, { role: "user", content: "q" }], new AbortController().signal))
  assert.ok(!sent.includes('"system"') && !/key/i.test(sent))
})

test("local: unloaded engine refuses to answer instead of faking one", async () => {
  const { LocalProvider } = await import("../lib/ide/ai/local-provider.ts")
  await assert.rejects(collect(new LocalProvider().stream([{ role: "user", content: "x" }], new AbortController().signal)), (e: ChatError) => e.code === "not_loaded")
})

test("local: without WebGPU, load fails with the reason and downloads nothing", async () => {
  const { LocalProvider } = await import("../lib/ide/ai/local-provider.ts")
  const phases: string[] = []
  await assert.rejects(new LocalProvider().load("qwen-coder-1.5b", (p) => phases.push(p.phase)), (e: ChatError) => e.code === "no_webgpu" && /WebGPU/.test(e.message))
  assert.ok(!phases.includes("downloading"))
})

test("sse parser sanity", () => { assert.equal(new SseParser().push("event: a\ndata: {}\n\n").length, 1) })
