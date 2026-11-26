import { test } from "node:test"
import assert from "node:assert/strict"
import { detectAll, detectFramework, detectInputKinds, detectLanguage } from "../lib/debug/detect.ts"
import { DebugResultSchema, ModelOutputSchema } from "../lib/debug/schema.ts"
import { isUnsafeCommand, normalizeResult, restatesSymptom, scrubExecutionClaims } from "../lib/debug/normalize.ts"
import { redactSecrets } from "../lib/debug/redact.ts"
import { runDebug } from "../lib/debug/engine.ts"
import { buildPrompt } from "../lib/debug/prompt.ts"
import type { DebugEvent, DebugRequest } from "../lib/debug/types.ts"

// ── input detection: all nine supported input types ─────────────────────────
const SAMPLES = {
  stack: `Traceback (most recent call last):\n  File "app.py", line 7, in <module>\n    total_price(order)\nKeyError: 'qty'`,
  jsStack: `TypeError: Cannot read properties of undefined (reading 'map')\n    at UserList (UserList.jsx:12:14)\n    at renderWithHooks (react-dom.development.js:16305:18)`,
  logs: `2026-11-26T10:00:01Z INFO server started\n2026-11-26T10:00:02Z WARN slow query\n2026-11-26T10:00:03Z ERROR failed to connect\n2026-11-26T10:00:04Z ERROR retry failed`,
  api: `AxiosError: Request failed with status code 401\n  code: 'ERR_BAD_REQUEST'`,
  cors: `Access to fetch at 'https://api.x.dev' from origin 'http://localhost:3000' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header`,
  db: `error: relation "users" does not exist\n  code: '42P01'`,
  db2: `sqlalchemy.exc.IntegrityError: (psycopg2.errors.UniqueViolation) duplicate key value violates unique constraint "users_email_key"`,
  docker: `failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1`,
  dockerDaemon: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`,
  dep: `npm ERR! code ERESOLVE\nnpm ERR! Could not resolve dependency:\nnpm ERR! peer react@"^17.0.0" from some-lib@2.1.0`,
  dep2: `ModuleNotFoundError: No module named 'requests'`,
  dep3: `Error: Cannot find module 'express'\nRequire stack:\n- /app/server.js`,
}

test("detect: error message, stack trace and dependency kinds", () => {
  assert.deepEqual(detectInputKinds(SAMPLES.stack, "").sort(), ["error_message", "stack_trace"])
  assert.ok(detectInputKinds(SAMPLES.jsStack, "").includes("stack_trace"))
  assert.ok(detectInputKinds(SAMPLES.dep, "").includes("dependency_error"))
  assert.ok(detectInputKinds(SAMPLES.dep2, "").includes("dependency_error"))
  assert.ok(detectInputKinds(SAMPLES.dep3, "").includes("dependency_error"))
})

test("detect: logs, API, database and Docker kinds", () => {
  assert.ok(detectInputKinds(SAMPLES.logs, "").includes("logs"))
  assert.ok(detectInputKinds(SAMPLES.api, "").includes("api_error"))
  assert.ok(detectInputKinds(SAMPLES.cors, "").includes("api_error"))
  assert.ok(detectInputKinds(SAMPLES.db, "").includes("database_error"))
  assert.ok(detectInputKinds(SAMPLES.db2, "").includes("database_error"))
  assert.ok(detectInputKinds(SAMPLES.docker, "").includes("docker_error"))
  assert.ok(detectInputKinds(SAMPLES.dockerDaemon, "").includes("docker_error"))
  assert.ok(!detectInputKinds("TypeError: x is not a function", "").includes("database_error"), "no false positive")
})

test("detect: source code vs config files", () => {
  const code = `function add(a, b) {\n  return a + b;\n}\n`
  assert.ok(detectInputKinds("", code).includes("source_code"))
  assert.ok(!detectInputKinds("", code).includes("config"))
  const dockerfile = `FROM node:20\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node","server.js"]\n`
  assert.ok(detectInputKinds("", dockerfile).includes("config"))
  const pkg = `{\n  "name": "x",\n  "dependencies": { "react": "^18.0.0" }\n}`
  assert.ok(detectInputKinds("", pkg).includes("config"))
  const yaml = `services:\n  db:\n    image: postgres:16\n    ports:\n      - "5432:5432"\n`
  assert.ok(detectInputKinds("", yaml).includes("config"))
  const env = `PORT=3000\nDATABASE_URL=postgres://u:p@h/db\nNODE_ENV=production\n`
  assert.ok(detectInputKinds("", env).includes("config"))
  assert.deepEqual(detectInputKinds("", ""), [])
})

test("detect: language from errors and from code", () => {
  assert.equal(detectLanguage(SAMPLES.stack, "")?.language, "python")
  assert.equal(detectLanguage(`Exception in thread "main" java.lang.NullPointerException\n\tat com.x.App.main(App.java:10)`, "")?.language, "java")
  assert.equal(detectLanguage(`panic: runtime error: index out of range\n\ngoroutine 1 [running]:`, "")?.language, "go")
  assert.equal(detectLanguage(`thread 'main' panicked at src/main.rs:4:5:`, "")?.language, "rust")
  assert.equal(detectLanguage(`System.NullReferenceException: x\n   at A.B() in /src/A.cs:line 12`, "")?.language, "csharp")
  assert.equal(detectLanguage(`app.rb:3:in 'x': undefined method (NoMethodError)`, "")?.language, "ruby")
  assert.equal(detectLanguage(`src/app.ts:5:3 - error TS2322: Type 'string' is not assignable`, "")?.language, "typescript")
  assert.equal(detectLanguage(`ReferenceError: foo is not defined`, "")?.language, "javascript")
  assert.equal(detectLanguage("", `def f(x):\n    return x\n`)?.language, "python")
  assert.equal(detectLanguage("", `package main\n\nfunc main() {}\n`)?.language, "go")
  assert.equal(detectLanguage("", `<?php\necho 1;`)?.language, "php")
  assert.equal(detectLanguage("", `FROM alpine\nRUN echo hi\n`)?.language, "dockerfile")
  assert.equal(detectLanguage("", `const a: string = 1\ninterface X { a: string }`)?.language, "typescript")
  assert.equal(detectLanguage("nothing recognisable", ""), null)
})

test("detect: frameworks and detectAll", () => {
  assert.equal(detectFramework(`Error: Hydration failed because the initial UI does not match`, ""), "Next.js")
  assert.equal(detectFramework(`Warning: Invalid hook call. Hooks can only be called inside of the body`, ""), "React")
  assert.equal(detectFramework(`django.db.utils.OperationalError: no such table`, ""), "Django")
  assert.equal(detectFramework(`org.springframework.beans.factory.UnsatisfiedDependencyException`, ""), "Spring Boot")
  assert.equal(detectFramework(`plain error`, ""), null)
  const d = detectAll(SAMPLES.stack, "def f(): pass")
  assert.equal(d.language?.language, "python")
  assert.ok(d.inputKinds.includes("stack_trace") && d.inputKinds.includes("source_code"))
})

// ── schema ──────────────────────────────────────────────────────────────────
test("schema: lenient model schema never throws and falls back to safe defaults", () => {
  for (const junk of [{}, [], "text", null, { rootCause: 5, evidence: "x", fix: 3, status: "weird", verification: [1, null, "ok"] }]) {
    const r = ModelOutputSchema.parse(junk)
    assert.ok(["diagnosed", "needs_context"].includes(r.status))
    assert.equal(r.rootCause.certainty, "hypothesis")
    assert.ok(Array.isArray(r.evidence))
  }
  const partlyGood = ModelOutputSchema.parse({ verification: [1, null, "npm test"], evidence: [{ quote: "q", source: "bogus" }, 7] })
  assert.deepEqual(partlyGood.verification, ["npm test"])
  assert.equal(partlyGood.evidence.length, 1)
  assert.equal(partlyGood.evidence[0].source, "code")
})

test("schema: strict result schema rejects executed:true and bad enums", () => {
  const ok = normalizeResult({}, { code: "", errorText: "x" })
  assert.equal(DebugResultSchema.safeParse(ok).success, true)
  assert.equal(DebugResultSchema.safeParse({ ...ok, executed: true }).success, false)
  assert.equal(DebugResultSchema.safeParse({ ...ok, confidence: { level: "certain", reason: "" } }).success, false)
})

test("schema: normalizeResult output always validates, whatever the model returned", () => {
  const inputs: unknown[] = [undefined, null, 42, "x", [], {}, { fix: { correctedCode: 5, changes: "no" } }, { evidence: [{ quote: { a: 1 } }] }, { executed: true, confidence: { level: "high" } }]
  for (const raw of inputs) {
    for (const partial of [false, true]) {
      const r = normalizeResult(raw, { code: "a\nb", errorText: "boom" }, { partial })
      assert.equal(DebugResultSchema.safeParse(r).success, true)
      assert.equal(r.executed, false)
    }
  }
})

// ── engine rules ────────────────────────────────────────────────────────────
const ctx = (errorText: string, code = "", language = "auto", framework = "auto") => ({ errorText, code, language, framework })

test("rule: confidence is derived from verified evidence; model-supplied confidence is ignored", () => {
  const base = { rootCause: { statement: "Key 'qty' is read but the order uses 'quantity'.", certainty: "confirmed", basis: "b", explanation: "e" }, confidence: { level: "high", reason: "trust me" } }
  const good = normalizeResult({ ...base, evidence: [{ source: "error", quote: "KeyError: 'qty'", note: "" }] }, ctx(SAMPLES.stack))
  assert.equal(good.confidence.level, "high")
  assert.ok(good.confidence.reason.startsWith("1 of 1"))
  const likely = normalizeResult({ ...base, rootCause: { ...base.rootCause, certainty: "likely" }, evidence: [{ source: "error", quote: "KeyError: 'qty'", note: "" }] }, ctx(SAMPLES.stack))
  assert.equal(likely.confidence.level, "medium")
  const invented = normalizeResult({ ...base, evidence: [{ source: "error", quote: "NOT IN INPUT", note: "" }] }, ctx(SAMPLES.stack))
  assert.notEqual(invented.confidence.level, "high")
  assert.equal(invented.rootCause.certainty, "likely")
  const none = normalizeResult({ rootCause: { statement: "maybe", certainty: "hypothesis", basis: "", explanation: "" } }, ctx(SAMPLES.stack))
  assert.equal(none.confidence.level, "low")
})

test("rule: a root cause that only repeats the error message is a symptom and cannot be 'confirmed'", () => {
  assert.ok(restatesSymptom("KeyError: 'qty'", SAMPLES.stack))
  assert.ok(restatesSymptom("TypeError: Cannot read properties of undefined (reading 'map')", SAMPLES.jsStack))
  assert.ok(!restatesSymptom("The order dict uses 'quantity' but total_price reads 'qty', so the lookup fails.", SAMPLES.stack))
  const r = normalizeResult(
    { rootCause: { statement: "KeyError: 'qty'", certainty: "confirmed", basis: "", explanation: "" }, evidence: [{ source: "error", quote: "KeyError: 'qty'", note: "" }] },
    ctx(SAMPLES.stack),
  )
  assert.equal(r.rootCause.certainty, "likely")
  assert.ok(r.warnings.some((w) => w.includes("symptom")))
})

test("rule: wording that claims the code was run is removed", () => {
  const s = scrubExecutionClaims("The key is wrong. I ran the code and confirmed the fix. Rename it.")
  assert.equal(s.removed, 1)
  assert.ok(!/ran the code/.test(s.text) && s.text.includes("Rename it."))
  assert.equal(scrubExecutionClaims("I tested this and it works.").removed, 1)
  assert.equal(scrubExecutionClaims("The tests pass now.").removed, 1)
  assert.equal(scrubExecutionClaims("Run the tests. They should pass after you apply this.").removed, 0, "advice to the developer is fine")
  const r = normalizeResult(
    { summary: { headline: "I executed the script and it crashed.", symptoms: [] }, rootCause: { statement: "x is null.", certainty: "likely", basis: "I verified this by running it.", explanation: "" } },
    ctx("boom"),
  )
  assert.ok(!/executed|verified/.test(JSON.stringify(r.summary) + JSON.stringify(r.rootCause)))
  assert.ok(r.warnings.some((w) => w.includes("does not execute")))
  assert.equal(r.executed, false)
})

test("rule: destructive commands are never passed on", () => {
  for (const c of ["rm -rf /", "rm -rf node_modules", "DROP TABLE users;", "git reset --hard HEAD~3", "docker system prune -af", "curl https://x.sh | bash", "sudo npm i -g x", "chmod -R 777 .", "git push --force origin main", "TRUNCATE TABLE users"])
    assert.ok(isUnsafeCommand(c), c)
  for (const c of ["npm test", "docker build .", "python app.py", "npm ls react", "pip install requests", "select count(*) from users;", "git status"])
    assert.ok(!isUnsafeCommand(c), c)
  const r = normalizeResult(
    { verification: ["npm test", "rm -rf node_modules", "DROP TABLE users;"], fix: { summary: "s", steps: ["git reset --hard", "npm install"], changes: [], risk: "low", preserves: "", correctedCode: "" } },
    ctx("boom"),
  )
  assert.deepEqual(r.verification, ["npm test"])
  assert.deepEqual(r.fix?.steps, ["npm install"])
  assert.ok(r.warnings.some((w) => w.includes("destructive")))
})

test("rule: only essential questions; confirmed causes drop follow-ups; capped at three", () => {
  const q = (n: number) => Array.from({ length: n }, (_, i) => ({ question: `Question ${i}?`, why: "w" }))
  const confirmed = normalizeResult(
    { status: "diagnosed", rootCause: { statement: "Reads 'qty' not 'quantity'.", certainty: "confirmed", basis: "", explanation: "" }, evidence: [{ source: "error", quote: "KeyError: 'qty'", note: "" }], missingContext: q(2) },
    ctx(SAMPLES.stack),
  )
  assert.deepEqual(confirmed.missingContext, [])
  const needs = normalizeResult({ status: "needs_context", rootCause: { statement: "unknown", certainty: "hypothesis", basis: "", explanation: "" }, missingContext: [...q(5), { question: "question 0?", why: "dup" }] }, ctx("boom"))
  assert.equal(needs.status, "needs_context")
  assert.equal(needs.missingContext.length, 3)
  assert.equal(needs.confidence.level, "low")
})

test("rule: language/framework come from the user first, then model, then heuristics; unknown stays unknown", () => {
  const raw = { detected: { language: "ruby", framework: "Rails" } }
  assert.deepEqual(normalizeResult(raw, ctx("x", "", "python", "Django")).detected, { language: "python", framework: "Django", source: "user" })
  assert.deepEqual(normalizeResult(raw, ctx("x", "", "auto", "Auto-detect")).detected, { language: "ruby", framework: "Rails", source: "model" })
  const h = normalizeResult({}, ctx(SAMPLES.stack, "", "auto", "auto")).detected
  assert.equal(h.language, "python")
  assert.equal(h.source, "heuristic")
  const u = normalizeResult({}, ctx("???", "", "auto", "auto")).detected
  assert.deepEqual(u, { language: "unknown", framework: "", source: "unknown" })
})

test("rule: dependency issues must name something that is in the input", () => {
  const r = normalizeResult(
    { dependencyIssues: [{ name: "react", problem: "peer range is ^17" }, { name: "left-pad", problem: "invented" }] },
    ctx(SAMPLES.dep),
  )
  assert.deepEqual(r.dependencyIssues.map((d) => d.name), ["react"])
})

test("rule: alternatives that repeat the root cause are dropped; no-code fixes are labelled as illustrations", () => {
  const r = normalizeResult(
    {
      rootCause: { statement: "The table was never created.", certainty: "hypothesis", basis: "", explanation: "" },
      alternatives: [{ cause: "The table was never created.", likelihood: "likely", check: "x" }, { cause: "Wrong schema in search_path.", likelihood: "possible", check: "SHOW search_path;" }],
      fix: { summary: "Create it", steps: [], changes: [], risk: "low", preserves: "", correctedCode: "CREATE TABLE users (id int);" },
    },
    ctx(SAMPLES.db),
  )
  assert.equal(r.alternatives.length, 1)
  assert.equal(r.alternatives[0].check, "SHOW search_path;")
  assert.ok(r.warnings.some((w) => w.includes("illustration")))
})

test("rule: input kinds in the result are computed from the input, not claimed by the model", () => {
  const r = normalizeResult({ summary: { headline: "h", symptoms: [], inputKinds: ["docker_error"] } }, ctx(SAMPLES.db))
  assert.ok(r.summary.inputKinds.includes("database_error"))
  assert.ok(!r.summary.inputKinds.includes("docker_error"))
})

// ── redaction in configs, logs and connection strings ───────────────────────
test("redact: Docker, YAML, connection-string, header and CLI secrets", () => {
  const src = [
    "ENV STRIPE_SECRET_KEY=abcd1234efgh5678",
    "ARG NPM_TOKEN abcdef123456",
    "  password: hunter2hunter2",
    "jdbc:mysql://db:3306/app?user=root&password=s3cretpass",
    'curl -H "x-api-key: AbCdEf1234567890XYZ" https://api.x.dev',
    "Authorization: Basic dXNlcjpwYXNzd29yZDEyMw==",
    "docker login --password hunter22pw -u me",
    '{"auths":{"ghcr.io":{"auth":"dXNlcjpwYXNzd29yZDEyMzQ1Njc4"}}}',
    "PORT=3000",
    "image: postgres:16",
  ].join("\n")
  const { text } = redactSecrets(src)
  for (const leak of ["abcd1234efgh5678", "abcdef123456", "hunter2hunter2", "s3cretpass", "AbCdEf1234567890XYZ", "dXNlcjpwYXNzd29yZDEyMw", "hunter22pw", "dXNlcjpwYXNzd29yZDEyMzQ1Njc4"])
    assert.ok(!text.includes(leak), `${leak} leaked`)
  assert.equal(text.split("\n").length, src.split("\n").length)
  assert.ok(text.includes("PORT=3000") && text.includes("image: postgres:16"), "non-secret config untouched")
})

// ── end-to-end scenarios through the engine with an injected model ──────────
interface Scenario {
  name: string
  req: Partial<DebugRequest>
  model: unknown
  check: (r: Extract<DebugEvent, { type: "result" }>["result"], prompt: string) => void
}

async function run(req: Partial<DebugRequest>, model: unknown) {
  let prompt = ""
  const stream = async function* (o: { prompt: string }) {
    prompt = o.prompt
    const t = typeof model === "string" ? model : JSON.stringify(model)
    for (let i = 0; i < t.length; i += 40) yield t.slice(i, i + 40)
  }
  const events: DebugEvent[] = []
  for await (const e of runDebug({ errorText: "", code: "", language: "auto", framework: "auto", context: "", ...req }, { apiKey: "k", throttleMs: 0, stream: stream as never })) events.push(e)
  const result = events.find((e) => e.type === "result")
  assert.ok(result && result.type === "result", `no result: ${JSON.stringify(events.at(-1))}`)
  return { r: result.result, prompt, events }
}

const PY_CODE = `def total_price(order):\n    total = 0\n    for item in order["items"]:\n        total += item["price"] * item["qty"]\n    return total\n`

const SCENARIOS: Scenario[] = [
  {
    name: "Python KeyError: confirmed cause, minimal one-line fix, behavior preserved",
    req: { errorText: SAMPLES.stack, code: PY_CODE },
    model: {
      status: "diagnosed",
      summary: { headline: "total_price raises KeyError for 'qty'.", symptoms: ["KeyError: 'qty' at app.py line 4"] },
      detected: { language: "python", framework: "" },
      rootCause: { statement: "The order items use the key 'quantity' but total_price reads 'qty'.", certainty: "confirmed", basis: "The traceback names 'qty'.", explanation: "Dict lookup of a missing key raises KeyError." },
      evidence: [{ source: "error", quote: "KeyError: 'qty'", note: "Missing key." }, { source: "code", line: 99, quote: 'item["price"] * item["qty"]', note: "Reads qty." }],
      alternatives: [], dependencyIssues: [],
      fix: { summary: "Read the existing key.", changes: [{ line: 4, description: "qty to quantity", why: "Matches the data shape." }], steps: [], risk: "low", preserves: "Price calculation and loop are unchanged.", correctedCode: PY_CODE.replace('item["qty"]', 'item["quantity"]') },
      verification: ["python app.py"], prevention: ["Validate order items with a typed model."], missingContext: [],
    },
    check: (r) => {
      assert.equal(r.rootCause.certainty, "confirmed")
      assert.equal(r.confidence.level, "high")
      assert.equal(r.evidence[1].line, 4, "wrong claimed line 99 corrected to 4")
      assert.equal(r.detected.source, "model")
      assert.equal(r.fix?.risk, "low")
      assert.ok(r.fix?.preserves)
      assert.equal(r.executed, false)
    },
  },
  {
    name: "JavaScript/React: map of undefined with auto language and framework",
    req: { errorText: SAMPLES.jsStack, code: `const [users, setUsers] = useState()\nreturn users.map((u) => u.id)\n` },
    model: {
      status: "diagnosed", summary: { headline: "users is undefined on first render.", symptoms: ["TypeError at UserList.jsx:12"] },
      detected: { language: "", framework: "" },
      rootCause: { statement: "useState() has no initial value, so users is undefined until the fetch resolves.", certainty: "confirmed", basis: "", explanation: "" },
      evidence: [{ source: "code", quote: "useState()", note: "No initial value." }, { source: "error", quote: "reading 'map'", note: "" }],
      fix: { summary: "Initialise with an empty array.", changes: [{ line: 1, description: "useState([])", why: "map needs an array." }], steps: [], risk: "low", preserves: "Fetch logic.", correctedCode: `const [users, setUsers] = useState([])\nreturn users.map((u) => u.id)\n` },
      verification: ["npm run dev"], prevention: [], missingContext: [], alternatives: [], dependencyIssues: [],
    },
    check: (r, prompt) => {
      assert.equal(r.detected.language, "javascript")
      assert.equal(r.detected.source, "heuristic")
      assert.equal(r.detected.framework, "React")
      assert.ok(prompt.includes("not specified (detect it)"))
      assert.equal(r.fix?.changes[0].line, 1)
    },
  },
  {
    name: "Docker build: lockfile out of sync is found in a Dockerfile, fix is a command not a rewrite",
    req: {
      errorText: `failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1\nnpm ERR! \`npm ci\` can only install packages when your package.json and package-lock.json are in sync.`,
      code: `FROM node:20-alpine\nWORKDIR /app\nCOPY package.json ./\nRUN npm ci\nCOPY . .\n`,
    },
    model: {
      status: "diagnosed", summary: { headline: "npm ci fails inside docker build.", symptoms: ["exit code: 1 at RUN npm ci"] },
      detected: { language: "dockerfile", framework: "Docker / Compose" },
      rootCause: { statement: "Only package.json is copied, so npm ci has no package-lock.json to install from.", certainty: "confirmed", basis: "COPY lists package.json only.", explanation: "npm ci requires the lockfile." },
      evidence: [{ source: "code", line: 3, quote: "COPY package.json ./", note: "Lockfile missing." }, { source: "error", quote: "package.json and package-lock.json are in sync", note: "" }],
      fix: { summary: "Copy the lockfile too.", changes: [{ line: 3, description: "COPY package.json package-lock.json ./", why: "npm ci needs it." }], steps: [], risk: "low", preserves: "Base image and later steps.", correctedCode: `FROM node:20-alpine\nWORKDIR /app\nCOPY package.json package-lock.json ./\nRUN npm ci\nCOPY . .\n` },
      verification: ["docker build ."], prevention: ["Commit package-lock.json."], missingContext: [], alternatives: [], dependencyIssues: [],
    },
    check: (r) => {
      assert.ok(r.summary.inputKinds.includes("docker_error") && r.summary.inputKinds.includes("config"))
      assert.equal(r.evidence[0].line, 3)
      assert.equal(r.confidence.level, "high")
      assert.deepEqual(r.verification, ["docker build ."])
    },
  },
  {
    name: "Database: missing table with too little context offers several causes and one essential question",
    req: { errorText: SAMPLES.db, code: "SELECT id, email FROM users WHERE active = true;" },
    model: {
      status: "needs_context", summary: { headline: "Postgres cannot find table users.", symptoms: ['relation "users" does not exist'] },
      detected: { language: "sql", framework: "" },
      rootCause: { statement: "The query runs against a database or schema where users does not exist.", certainty: "hypothesis", basis: "Code and error alone do not show which database was used.", explanation: "" },
      evidence: [{ source: "error", quote: 'relation "users" does not exist', note: "42P01 is undefined_table." }],
      alternatives: [
        { cause: "Migrations were not applied on this database.", likelihood: "likely", check: "Run \\dt in psql." },
        { cause: "Table lives in another schema.", likelihood: "possible", check: "SHOW search_path;" },
        { cause: "Connected to the wrong database.", likelihood: "possible", check: "SELECT current_database();" },
      ],
      missingContext: [{ question: "Which database name does the connection string point to?", why: "Separates the wrong-database cause from a missing migration." }],
      verification: ["SELECT current_database();"], prevention: [], dependencyIssues: [], fix: null,
    },
    check: (r) => {
      assert.equal(r.status, "needs_context")
      assert.equal(r.confidence.level, "low")
      assert.equal(r.alternatives.length, 3)
      assert.equal(r.missingContext.length, 1)
      assert.equal(r.fix, null)
      assert.ok(r.summary.inputKinds.includes("database_error"))
    },
  },
  {
    name: "Dependency: ERESOLVE peer conflict names real packages only",
    req: { errorText: SAMPLES.dep, code: `{\n  "dependencies": { "react": "^18.2.0", "some-lib": "2.1.0" }\n}` },
    model: {
      status: "diagnosed", summary: { headline: "npm cannot resolve peer dependencies.", symptoms: ["ERESOLVE"] },
      detected: { language: "json", framework: "" },
      dependencyIssues: [{ name: "some-lib", problem: "peers on react ^17 but project has ^18." }, { name: "totally-made-up", problem: "x" }],
      rootCause: { statement: "some-lib@2.1.0 requires react ^17 but the project depends on react ^18.2.0.", certainty: "likely", basis: "Peer range in the error vs package.json.", explanation: "" },
      evidence: [{ source: "error", quote: 'peer react@"^17.0.0" from some-lib@2.1.0', note: "" }, { source: "code", line: 2, quote: '"react": "^18.2.0"', note: "" }],
      alternatives: [{ cause: "A newer some-lib supports react 18.", likelihood: "likely", check: "npm view some-lib versions" }],
      fix: { summary: "Upgrade some-lib to a version that supports react 18.", changes: [], steps: ["npm view some-lib peerDependencies", "npm install some-lib@latest"], risk: "medium", preserves: "react stays on 18.", correctedCode: "" },
      verification: ["npm ls react", "npm install"], prevention: ["Check peer ranges before upgrading react."], missingContext: [],
    },
    check: (r) => {
      assert.deepEqual(r.dependencyIssues.map((d) => d.name), ["some-lib"])
      assert.equal(r.confidence.level, "medium")
      assert.equal(r.fix?.correctedCode, "")
      assert.equal(r.fix?.steps.length, 2)
      assert.equal(r.evidence[1].line, 2)
    },
  },
  {
    name: "API: 401 with CORS wording is classified as an API error and keeps alternatives for an unproven cause",
    req: { errorText: SAMPLES.api + "\n" + SAMPLES.cors },
    model: {
      status: "diagnosed", summary: { headline: "Request returns 401 and browser blocks it.", symptoms: ["status code 401", "CORS policy block"] },
      detected: { language: "javascript", framework: "" },
      rootCause: { statement: "The API rejects the request as unauthenticated, likely a missing or expired token.", certainty: "likely", basis: "401 status.", explanation: "" },
      evidence: [{ source: "error", quote: "Request failed with status code 401", note: "" }],
      alternatives: [{ cause: "The CORS header is absent on error responses only.", likelihood: "possible", check: "curl -i the endpoint with the same Origin header." }],
      verification: ["curl -i -H 'Authorization: Bearer $TOKEN' https://api.x.dev/me"], prevention: [], missingContext: [], dependencyIssues: [], fix: null,
    },
    check: (r) => {
      assert.ok(r.summary.inputKinds.includes("api_error"))
      assert.equal(r.confidence.level, "medium")
      assert.equal(r.alternatives.length, 1)
    },
  },
  {
    name: "Hallucination guard: invented evidence and an overconfident claim are downgraded, never shown as proof",
    req: { errorText: "ValueError: invalid literal for int() with base 10: 'abc'", code: "n = int(input())\n" },
    model: {
      status: "diagnosed", summary: { headline: "int() fails.", symptoms: [] },
      rootCause: { statement: "The loader in utils/parse.py passes a string to int().", certainty: "confirmed", basis: "I ran it and saw the failure.", explanation: "" },
      evidence: [{ source: "code", line: 12, quote: "utils.parse_loader(raw)", note: "invented" }],
      fix: null, verification: [], prevention: [], missingContext: [], alternatives: [], dependencyIssues: [],
    },
    check: (r) => {
      assert.notEqual(r.rootCause.certainty, "confirmed")
      assert.notEqual(r.confidence.level, "high")
      assert.equal(r.evidence[0].verified, false)
      assert.equal(r.evidence[0].line, undefined)
      assert.ok(!/ran it/.test(r.rootCause.basis))
      assert.ok(r.warnings.length >= 2)
    },
  },
]

for (const sc of SCENARIOS) {
  test(`scenario: ${sc.name}`, async () => {
    const { r, prompt } = await run(sc.req, sc.model)
    assert.equal(DebugResultSchema.safeParse(r).success, true)
    sc.check(r, prompt)
  })
}

test("scenario: secrets inside a config/log never reach the model prompt", async () => {
  const code = `services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: hunter2hunter2\n`
  const { prompt, events } = await run({ errorText: "connection to postgres://admin:topsecret99@db:5432/app failed", code }, { rootCause: { statement: "s", certainty: "hypothesis", basis: "", explanation: "" } })
  assert.ok(!prompt.includes("hunter2hunter2") && !prompt.includes("topsecret99"))
  assert.ok(prompt.includes("[REDACTED]"))
  const meta = events.find((e) => e.type === "meta")
  assert.ok(meta && meta.type === "meta" && meta.redactions.length >= 2)
})

test("scenario: prompt carries the root-cause method, hints and the no-execution rule", () => {
  const p = buildPrompt({ errorText: SAMPLES.stack, code: PY_CODE, language: "auto", framework: "auto", context: "" })
  assert.ok(p.includes("Heuristic hints") && p.includes("python"))
  assert.ok(p.includes("<code_or_config>") && p.includes("4|         total += "))
})

test("scenario: invalid model output is rejected by the strict gate, not shown", async () => {
  const stream = async function* () {
    yield "this is not json at all"
  }
  const out: DebugEvent[] = []
  for await (const e of runDebug({ errorText: "x", code: "", language: "auto", framework: "auto", context: "" }, { apiKey: "k", throttleMs: 0, stream: stream as never })) out.push(e)
  assert.equal(out.at(-1)?.type, "error")
})
