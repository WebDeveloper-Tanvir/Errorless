import { test } from "node:test"
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import { detectLanguage, cannotRunReason, starterContent, extensionOf } from "../lib/ide/language.ts"

// ── language detection (never defaults to Python) ───────────────────────────
test("language: html is html, not python", () => {
  const l = detectLanguage("index.html")
  assert.equal(l.id, "html")
  assert.equal(l.runtime, "html")
  assert.notEqual(detectLanguage("page.HTM").runtime, "python")
})

test("language: each supported extension maps to its own runtime", () => {
  const rt = (f: string) => detectLanguage(f).runtime
  assert.equal(rt("style.css"), "css")
  assert.equal(rt("script.js"), "browser-js")
  assert.equal(rt("main.ts"), "browser-ts")
  assert.equal(rt("app.py"), "python")
  assert.equal(rt("main.c"), "remote")
  assert.equal(rt("main.cpp"), "remote")
  assert.equal(rt("Main.java"), "remote")
  assert.equal(detectLanguage("main.cpp").remote, "c++")
})

test("language: unknown or non-runnable files say so instead of running", () => {
  assert.equal(detectLanguage("README").runtime, "unsupported")
  assert.equal(detectLanguage("archive.xyz").runtime, "unsupported")
  assert.equal(detectLanguage("notes.md").runtime, "none")
  assert.ok(cannotRunReason("notes.md").includes("nothing to execute"))
  assert.ok(cannotRunReason("main.go").includes("no runtime"))
  assert.ok(cannotRunReason("App.jsx").includes("JSX"))
  assert.equal(cannotRunReason("app.py"), "")
  assert.equal(cannotRunReason("index.html"), "")
})

test("language: dotfiles, paths and double extensions resolve by the last extension", () => {
  assert.equal(extensionOf("a/b/c.test.ts"), "ts")
  assert.equal(extensionOf(".gitignore"), "")
  assert.equal(extensionOf("Makefile"), "")
})

test("language: starter content uses the file's own comment syntax", () => {
  assert.ok(starterContent("app.py").startsWith("#"))
  assert.ok(starterContent("x.js").startsWith("//"))
  assert.ok(starterContent("s.css").startsWith("/*"))
  assert.ok(starterContent("index.html").includes("<!DOCTYPE html>"))
  assert.ok(!starterContent("app.py").includes("//"))
})

// ── project builder: index.html, style.css, scripts ─────────────────────────
import { flattenProject, resolveRef, buildPreview, pageFor, PREVIEW_CSP, type TreeNode } from "../lib/ide/project.ts"
import { bridgeScript } from "../lib/ide/bridge.ts"
import { transpileWith } from "../lib/ide/typescript.ts"
import ts from "typescript"

const tree = (files: Record<string, string>): TreeNode[] => Object.entries(files).map(([name, content], i) => ({ id: String(i + 1), name, type: "file" as const, content }))
const proj = (files: Record<string, string>) => flattenProject(tree(files))
const entryOf = (files: ReturnType<typeof proj>, name: string) => files.find((f) => f.name === name)!
const run = (files: Record<string, string>, entry: string, compiled?: Record<string, string>) => {
  const p = proj(files)
  return buildPreview({ files: p, entry: entryOf(p, entry), nonce: "N0NCE", parentOrigin: "https://app.test", compiled })
}

test("preview: index.html renders as a real page with bridge and CSP injected first", () => {
  const r = run({ "index.html": "<!DOCTYPE html><html><head><title>t</title></head><body><h1>Hi</h1></body></html>" }, "index.html")
  assert.ok(r.html.includes("<h1>Hi</h1>"))
  const head = r.html.indexOf("<head>")
  assert.ok(r.html.indexOf("Content-Security-Policy") > head && r.html.indexOf("Content-Security-Policy") < r.html.indexOf("<title>"), "CSP is first in <head>")
  assert.ok(r.html.indexOf("errorless-preview") < r.html.indexOf("<title>"))
  assert.equal(r.page, "index.html")
  assert.ok(!r.html.includes("python"))
})

test("preview: style.css linked from index.html is inlined; edits to the css show on run", () => {
  const files = { "index.html": '<html><head><link rel="stylesheet" href="style.css"></head><body>x</body></html>', "style.css": "body{background:#123456}" }
  const r = run(files, "style.css")
  assert.ok(r.html.includes("body{background:#123456}"))
  assert.equal(r.missing.length, 0)
  assert.equal(r.notes.length, 0)
})

test("preview: css that isn't linked is applied anyway and the terminal is told", () => {
  const r = run({ "index.html": "<html><head></head><body>x</body></html>", "style.css": "p{color:red}" }, "style.css")
  assert.ok(r.html.includes("p{color:red}"))
  assert.ok(r.notes.some((n) => n.includes("not linked")))
})

test("preview: running css with no html is an honest failure, not a success", () => {
  const r = run({ "style.css": "p{}" }, "style.css")
  assert.equal(r.html, "")
  assert.ok(r.notes[0].includes("no HTML file") || r.notes[0].includes("There is no HTML"))
})

test("preview: scripts referenced by the page run inside it; missing files are reported", () => {
  const r = run({ "index.html": '<html><head></head><body><script src="app.js"></script><script src="nope.js"></script></body></html>', "app.js": "document.title='x'" }, "app.js")
  assert.equal(r.page, "index.html")
  assert.ok(r.html.includes("document.title='x'"))
  assert.deepEqual(r.missing, ["nope.js"])
})

test("preview: a standalone script gets a blank page and no python", () => {
  const r = run({ "script.js": 'console.log("Hello Errorless!")' }, "script.js")
  assert.equal(r.page, "(blank page)")
  assert.ok(r.html.includes('console.log("Hello Errorless!")'))
})

test("preview: </script> inside user code cannot break out of the script tag", () => {
  const r = run({ "script.js": 'document.write("</script><img src=x onerror=alert(1)>")' }, "script.js")
  assert.ok(!r.html.includes('"</script><img'))
})

test("preview: typescript uses its compiled output, and module syntax becomes type=module", () => {
  const r = run({ "main.ts": "const a: number = 1; console.log(a)" }, "main.ts", { "main.ts": "const a = 1; console.log(a)" })
  assert.ok(r.html.includes("const a = 1; console.log(a)") && !r.html.includes(": number"))
  const m = run({ "main.ts": "x" }, "main.ts", { "main.ts": 'import {a} from "https://esm.sh/x"; console.log(a)' })
  assert.ok(m.html.includes('<script type="module">'))
})

test("preview: CSP is restrictive and the bridge only talks to the app origin", () => {
  assert.ok(PREVIEW_CSP.includes("default-src 'none'") && PREVIEW_CSP.includes("frame-src 'none'") && PREVIEW_CSP.includes("form-action 'none'"))
  const b = bridgeScript("abc", "https://app.test")
  assert.ok(b.includes('"https://app.test"') && !b.includes('"*"'), "postMessage targetOrigin is the app, never *")
  assert.ok(!/document\.cookie|localStorage|sessionStorage/.test(b))
})

test("preview: references resolve relative to the page and never guess between duplicates", () => {
  const files = flattenProject([{ id: "1", name: "site", type: "folder", children: [
    { id: "2", name: "index.html", type: "file", content: "" }, { id: "3", name: "css", type: "folder", children: [{ id: "4", name: "a.css", type: "file", content: "" }] },
    { id: "5", name: "other", type: "folder", children: [{ id: "6", name: "a.css", type: "file", content: "" }] } ] }])
  assert.equal(resolveRef(files, "site/index.html", "css/a.css")?.id, "4")
  assert.equal(resolveRef(files, "site/index.html", "./css/a.css")?.id, "4")
  assert.equal(resolveRef(files, "site/other/x.html", "../css/a.css")?.id, "4")
  assert.equal(resolveRef(files, "site/index.html", "a.css"), null, "two a.css files: ambiguous, so not resolved")
  assert.equal(resolveRef(files, "site/index.html", "https://cdn.test/a.css"), null)
  assert.equal(pageFor(files, files.find((f) => f.id === "4")!)?.id, "2", "css is shown in the project's index.html")
})

// ── typescript transpile ────────────────────────────────────────────────────
test("typescript: strips types and reports syntax errors with line numbers", () => {
  const ok = transpileWith(ts as never, "const n: number = 1;\nconsole.log(n as number)", "a.ts")
  assert.equal(ok.diagnostics.length, 0)
  assert.ok(!ok.js.includes(": number"))
  const bad = transpileWith(ts as never, "const a = ;\n", "b.ts")
  assert.ok(bad.diagnostics.length > 0 && bad.diagnostics[0].line === 1)
})

// ── python protocol ─────────────────────────────────────────────────────────
import { cleanTraceback, parseFrameMessage, PYTHON_SOURCE } from "../lib/ide/python-protocol.ts"
import { pythonFrameHtml } from "../lib/ide/python-frame.ts"

test("python: tracebacks keep the user's frames and drop Pyodide internals", () => {
  const raw = `Traceback (most recent call last):
  File "/lib/python313.zip/_pyodide/_base.py", line 574, in eval_code_async
    await CodeRunner(
  File "/lib/python313.zip/_pyodide/_base.py", line 396, in run_async
    coroutine = eval(self.code, globals, locals)
  File "<exec>", line 4, in <module>
  File "<exec>", line 2, in divide
ZeroDivisionError: division by zero
`
  const c = cleanTraceback(raw)
  assert.ok(!c.text.includes("_pyodide"))
  assert.ok(c.text.includes('File "<exec>", line 4') && c.text.includes("ZeroDivisionError: division by zero"))
  assert.ok(c.text.startsWith("Traceback (most recent call last):"))
  assert.equal(c.line, 2, "reports the innermost user frame")
})

test("python: syntax errors keep their caret lines and report the line", () => {
  const c = cleanTraceback(`Traceback (most recent call last):\n  File "/lib/python313.zip/_pyodide/_base.py", line 499, in eval_code\n    .run(globals, locals)\n  File "<exec>", line 1\n    x = (\n        ^\nSyntaxError: '(' was never closed`)
  assert.ok(c.text.includes("SyntaxError") && c.text.includes("^"))
  assert.equal(c.line, 1)
})

test("python: frame messages need the right source and nonce, and are size-capped", () => {
  const ok = { source: PYTHON_SOURCE, nonce: "n1", type: "stdout", id: 3, text: "hi" }
  assert.deepEqual(parseFrameMessage(ok, "n1"), { type: "stdout", id: 3, text: "hi" })
  assert.equal(parseFrameMessage({ ...ok, nonce: "other" }, "n1"), null)
  assert.equal(parseFrameMessage({ ...ok, source: "evil" }, "n1"), null)
  assert.equal(parseFrameMessage("string", "n1"), null)
  assert.equal(parseFrameMessage({ ...ok, type: "eval" }, "n1"), null)
  assert.equal((parseFrameMessage({ ...ok, text: "x".repeat(99_999) }, "n1") as { text: string }).text.length, 20_000)
})

test("python: the sandbox frame is locked down", () => {
  const html = pythonFrameHtml({ nonce: "N", parentOrigin: "https://app.test", baseUrl: "https://app.test/ide-runtime/pyodide/" })
  assert.ok(html.includes("default-src 'none'") && html.includes("connect-src https://app.test") && !html.includes("connect-src https:;"), "network limited to the runtime origin")
  assert.ok(!/localStorage|document\.cookie/.test(html))
  assert.ok(html.includes('"https://app.test"') && !html.includes('postMessage(m,"*")'))
  const src = readFileSync(new URL("../lib/ide/python-runner.ts", import.meta.url), "utf8")
  assert.ok(src.includes('"sandbox", "allow-scripts"') && !src.includes("allow-same-origin"))
})

// ── remote execution ────────────────────────────────────────────────────────
import { runRemote, validateExecRequest } from "../lib/ide/remote-exec.ts"

test("remote: requests are validated", () => {
  assert.equal(validateExecRequest(null).ok, false)
  assert.equal(validateExecRequest({ language: "bash", code: "ls" }).ok, false)
  assert.equal(validateExecRequest({ language: "c", code: "  " }).ok, false)
  assert.equal(validateExecRequest({ language: "c", code: "x".repeat(100_001) }).ok, false)
  assert.equal(validateExecRequest({ language: "java", code: "class Main{}" }).ok, true)
})

test("remote: not configured gives a clear 501 and makes no request", async () => {
  let called = false
  const r = await runRemote({ language: "c", code: "int main(){}" }, {}, (async () => { called = true; return new Response("{}") }) as typeof fetch)
  assert.equal(r.ok, false)
  assert.equal((r as { status: number }).status, 501)
  assert.match((r as { error: string }).error, /EXEC_SERVICE_URL/)
  assert.equal(called, false)
})

test("remote: talks Piston and returns compile + run output", async () => {
  let seen: { url: string; body: any; auth: string | null } | null = null
  const fake = (async (url: string, init: RequestInit) => {
    seen = { url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") }
    return new Response(JSON.stringify({ compile: { stdout: "", stderr: "", code: 0 }, run: { stdout: "Hello\n", stderr: "", code: 0, signal: null } }))
  }) as unknown as typeof fetch
  const r = await runRemote({ language: "c++", code: "int main(){}" }, { url: "http://exec.test/", key: "k" }, fake)
  assert.ok(r.ok && r.run.stdout === "Hello\n" && r.compile?.code === 0)
  assert.equal(seen!.url, "http://exec.test/api/v2/execute")
  assert.equal(seen!.body.language, "c++")
  assert.equal(seen!.body.files[0].name, "main.cpp")
  assert.equal(seen!.auth, "k")
})

test("remote: upstream failures become honest errors, not success", async () => {
  const bad = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch
  assert.equal((await runRemote({ language: "c", code: "x" }, { url: "http://x" }, bad)).ok, false)
  const down = (async () => { throw new Error("ECONNREFUSED") }) as unknown as typeof fetch
  const r = await runRemote({ language: "c", code: "x" }, { url: "http://x" }, down)
  assert.ok(!r.ok && r.status === 502)
  const junk = (async () => new Response("{}")) as unknown as typeof fetch
  assert.equal((await runRemote({ language: "c", code: "x" }, { url: "http://x" }, junk)).ok, false)
})

// ── preview protocol ────────────────────────────────────────────────────────
import { parseBridgeMessage } from "../lib/ide/preview-protocol.ts"
import { terminalText } from "../lib/ide/events.ts"
import { BRIDGE_SOURCE } from "../lib/ide/bridge.ts"

test("preview: bridge messages are validated and capped", () => {
  const base = { source: BRIDGE_SOURCE, nonce: "n" }
  assert.deepEqual(parseBridgeMessage({ ...base, type: "console", level: "warn", text: "hi" }, "n"), { type: "console", level: "warn", text: "hi" })
  assert.equal(parseBridgeMessage({ ...base, type: "console", level: "nope", text: "x" }, "n")!.type === "console" && (parseBridgeMessage({ ...base, type: "console", level: "nope", text: "x" }, "n") as { level: string }).level, "log")
  assert.equal(parseBridgeMessage({ ...base, type: "console", text: "x" }, "zzz"), null, "wrong nonce")
  assert.equal(parseBridgeMessage({ source: "other", nonce: "n", type: "done" }, "n"), null)
  assert.equal(parseBridgeMessage({ ...base, type: "run-eval", code: "alert(1)" }, "n"), null)
  const e = parseBridgeMessage({ ...base, type: "error", message: "x".repeat(50_000), line: -4, col: "a" }, "n") as { message: string; line: number; col: number }
  assert.equal(e.message.length, 8000)
  assert.equal(e.line, 0)
  assert.equal(e.col, 0)
})

test("preview: a standalone script reports how many injected lines precede user code", () => {
  const entry = { id: "1", name: "a.js", path: "a.js", content: "console.log(1)\nthrow new Error('x')" }
  const r = buildPreview({ files: [entry], entry, nonce: "n", parentOrigin: "http://o" })
  const lines = r.html.split("\n")
  assert.equal(lines[(r.lineOffset ?? 0)].includes("console.log(1)"), true, "user line 1 sits at lineOffset")
})

test("terminal: lines are prefixed by kind", () => {
  assert.equal(terminalText({ kind: "system", text: "Starting HTML preview..." }), "> Starting HTML preview...")
  assert.equal(terminalText({ kind: "success", text: "Execution completed." }), "✓ Execution completed.")
  assert.equal(terminalText({ kind: "error", text: "boom" }), "✗ boom")
  assert.equal(terminalText({ kind: "stdout", text: "Hello Errorless!" }), "Hello Errorless!")
})
