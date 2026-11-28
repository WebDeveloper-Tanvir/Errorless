import type { DebugResult } from "../debug/schema.ts"

/**
 * Community showcase: educational debugging examples written by the Errorless team.
 * These are NOT user submissions and NOT live AI output; the page labels them as hand-written.
 * No private user code or session is ever added here automatically.
 * Each entry's `result` follows the same schema as real results (tests enforce it, and that
 * every evidence quote really appears in the example input).
 */
export interface ShowcaseEntry {
  slug: string
  title: string
  blurb: string
  language: string
  framework: string
  tags: string[]
  level: "beginner" | "intermediate"
  error: string
  code: string
  codeFile: string
  lesson: string[]
  /** Public tool page with more on this family of errors. */
  toolSlug: string
  result: DebugResult
}

interface Spec {
  language: string
  framework?: string
  kinds: DebugResult["summary"]["inputKinds"]
  headline: string
  symptoms: string[]
  root: { statement: string; certainty: "confirmed" | "likely" | "hypothesis"; basis: string; explanation: string }
  evidence: { source: "code" | "error"; quote: string; note: string; line?: number }[]
  confidence: { level: "high" | "medium" | "low"; reason: string }
  alternatives?: DebugResult["alternatives"]
  fix: { summary: string; changes: { line?: number; description: string; why: string }[]; correctedCode: string; steps: string[]; risk: "low" | "medium" | "high"; preserves: string }
  verification: string[]
  prevention: string[]
  missingContext?: DebugResult["missingContext"]
}

function mk(s: Spec): DebugResult {
  return {
    status: "diagnosed",
    summary: { headline: s.headline, symptoms: s.symptoms, inputKinds: s.kinds },
    detected: { language: s.language, framework: s.framework ?? "", source: "heuristic" },
    dependencyIssues: [],
    rootCause: s.root,
    evidence: s.evidence.map((e) => ({ ...e, verified: true })),
    confidence: s.confidence,
    alternatives: s.alternatives ?? [],
    fix: s.fix,
    verification: s.verification,
    prevention: s.prevention,
    missingContext: s.missingContext ?? [],
    executed: false,
    warnings: ["Hand-written example for education. Nothing here was executed."],
  }
}

export const SHOWCASE: ShowcaseEntry[] = [
  {
    slug: "python-mutable-default-argument",
    title: "A Python list that remembers the previous call",
    blurb: "A function returns items from earlier calls because a default argument is created only once.",
    language: "python", framework: "", tags: ["python", "default arguments", "state"], level: "beginner",
    toolSlug: "python-error-fixer", codeFile: "cart.py",
    error: "Expected ['pen'] but got ['book', 'pen']",
    code: `def add_item(item, items=[]):
    items.append(item)
    return items

cart_a = add_item("book")
cart_b = add_item("pen")
print(cart_b)`,
    lesson: ["Default values are evaluated once, when the function is defined, not on every call.", "Use None as the default and create the mutable object inside the function."],
    result: mk({
      language: "python", kinds: ["error_message", "source_code"],
      headline: "The second call returns items from the first call.",
      symptoms: ["cart_b contains 'book' although only 'pen' was added to it"],
      root: {
        statement: "The default argument items=[] is one list shared by every call that omits items.",
        certainty: "confirmed",
        basis: "The signature uses a list literal as a default and the function mutates it with append.",
        explanation: "Python builds the default value once when def runs. Each call without an items argument receives that same list, so the first call's append is still there during the second call.",
      },
      evidence: [
        { source: "code", line: 1, quote: "def add_item(item, items=[]):", note: "A mutable list is used as a default value." },
        { source: "code", line: 2, quote: "items.append(item)", note: "The shared list is mutated in place." },
        { source: "error", quote: "['book', 'pen']", note: "Both calls ended up in one list." },
      ],
      confidence: { level: "high", reason: "Two independent pieces of evidence agree: the mutable default and the output that contains both items." },
      fix: {
        summary: "Default to None and create a new list on each call.",
        changes: [
          { line: 1, description: "Change the default from [] to None.", why: "None is immutable, so it cannot carry state between calls." },
          { line: 2, description: "Create a fresh list when items is None.", why: "Each call now gets its own list." },
        ],
        correctedCode: `def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items

cart_a = add_item("book")
cart_b = add_item("pen")
print(cart_b)`,
        steps: ["Replace the default with None.", "Create the list inside the function."],
        risk: "low",
        preserves: "Callers that pass their own list keep working exactly as before.",
      },
      verification: ["Run the script and confirm it prints ['pen'].", "Call add_item('x', my_list) and confirm my_list is still updated."],
      prevention: ["Never use [], {} or set() as a default argument.", "Enable the flake8-bugbear rule B006 to catch this automatically."],
    }),
  },
  {
    slug: "react-effect-request-loop",
    title: "A React effect that fetches forever",
    blurb: "The network tab shows the same request many times per second because a dependency is rebuilt on every render.",
    language: "javascript", framework: "React", tags: ["react", "useEffect", "dependencies"], level: "intermediate",
    toolSlug: "react-error-debugger", codeFile: "Results.jsx",
    error: `GET /api/search?q=hooks&limit=20 200 in 41ms
GET /api/search?q=hooks&limit=20 200 in 38ms
GET /api/search?q=hooks&limit=20 200 in 40ms
(the same line keeps repeating several times per second)`,
    code: `function Results({ query }) {
  const [rows, setRows] = useState([]);
  const options = { q: query, limit: 20 };

  useEffect(() => {
    fetch("/api/search?" + new URLSearchParams(options))
      .then((r) => r.json())
      .then(setRows);
  }, [options]);

  return <List rows={rows} />;
}`,
    lesson: ["React compares dependencies by identity. An object literal is a new object on every render.", "Depend on the primitive inputs (query), and build derived objects inside the effect."],
    result: mk({
      language: "javascript", framework: "React", kinds: ["logs", "source_code"],
      headline: "The search endpoint is requested again and again without any user action.",
      symptoms: ["The same request repeats several times per second", "The component re-renders after every response"],
      root: {
        statement: "The effect depends on options, an object created during every render, so it re-runs after each render and each response triggers another render.",
        certainty: "confirmed",
        basis: "options is declared with an object literal in the component body and listed in the dependency array.",
        explanation: "setRows re-renders the component, which builds a new options object. React sees a different identity, runs the effect again, fetches again, and calls setRows again. The loop only stops when the component unmounts.",
      },
      evidence: [
        { source: "code", line: 3, quote: "const options = { q: query, limit: 20 };", note: "A new object is created on every render." },
        { source: "code", line: 9, quote: "}, [options]);", note: "The effect re-runs whenever that object's identity changes." },
        { source: "error", quote: "the same line keeps repeating", note: "The log shows the effect re-running continuously." },
      ],
      confidence: { level: "high", reason: "The code shows the unstable dependency and the log shows the loop it would cause." },
      fix: {
        summary: "Depend on query and build the parameters inside the effect.",
        changes: [
          { line: 3, description: "Remove the options object from the component body.", why: "It is the unstable dependency." },
          { line: 9, description: "List query in the dependency array.", why: "A string compares by value, so the effect only runs when the query changes." },
        ],
        correctedCode: `function Results({ query }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const options = { q: query, limit: 20 };
    fetch("/api/search?" + new URLSearchParams(options))
      .then((r) => r.json())
      .then(setRows);
  }, [query]);

  return <List rows={rows} />;
}`,
        steps: ["Move options into the effect.", "Use [query] as the dependency list."],
        risk: "low",
        preserves: "The same endpoint, parameters and rendering. It now fetches once per query change.",
      },
      verification: ["Open the network tab and confirm one request appears when the query changes.", "Type a new query and confirm exactly one new request is sent."],
      prevention: ["Enable the react-hooks/exhaustive-deps ESLint rule.", "Add an AbortController so an older request cannot overwrite a newer one."],
    }),
  },
  {
    slug: "nextjs-hydration-mismatch",
    title: "Next.js hydration failed because of the clock",
    blurb: "Server and browser render different text for the same component, so React discards the server HTML.",
    language: "javascript", framework: "Next.js", tags: ["next.js", "hydration", "ssr"], level: "intermediate",
    toolSlug: "react-error-debugger", codeFile: "Clock.jsx",
    error: "Error: Hydration failed because the server rendered HTML didn't match the client.",
    code: `export default function Clock() {
  return <p>Rendered at {new Date().toLocaleTimeString()}</p>;
}`,
    lesson: ["Anything that differs between server and browser (time, random values, locale, window) cannot be rendered directly.", "Render a stable placeholder first, then fill the real value in an effect."],
    result: mk({
      language: "javascript", framework: "Next.js", kinds: ["error_message", "source_code"],
      headline: "React found different HTML on the client than the server sent.",
      symptoms: ["A hydration error appears in the console", "The page may briefly show the wrong time"],
      root: {
        statement: "The component renders the current time, which differs between the server render and the client render.",
        certainty: "confirmed",
        basis: "The only dynamic value in the component is new Date(), evaluated separately on the server and in the browser.",
        explanation: "The server produces HTML with its own time and time zone. When the browser hydrates, it renders again with a different time, sees different text, and reports a mismatch.",
      },
      evidence: [
        { source: "code", line: 2, quote: "new Date().toLocaleTimeString()", note: "Time and locale formatting depend on when and where the code runs." },
        { source: "error", quote: "Hydration failed because the server rendered HTML didn't match the client.", note: "This is React's standard message for exactly this kind of difference." },
      ],
      confidence: { level: "high", reason: "The error type matches and the component contains a value that cannot be the same in both places." },
      fix: {
        summary: "Render a stable value first and set the time after the component mounts.",
        changes: [
          { line: 1, description: "Keep the time in state, empty at first, and fill it in an effect.", why: "The server and the first client render now produce identical HTML." },
          { line: 2, description: "Render a placeholder until the time is known.", why: "Avoids showing a wrong time." },
        ],
        correctedCode: `"use client";
import { useEffect, useState } from "react";

export default function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => setTime(new Date().toLocaleTimeString()), []);
  return <p>Rendered at {time || "..."}</p>;
}`,
        steps: ["Add \"use client\" and move the time into state.", "Fill it inside useEffect."],
        risk: "low",
        preserves: "The component still shows the user's local time.",
      },
      verification: ["Reload the page and confirm the hydration error is gone from the console.", "Confirm the time appears after the first paint."],
      prevention: ["Avoid Date.now(), Math.random() and window access during render.", "Use suppressHydrationWarning only for a single known-harmless text node."],
    }),
  },
  {
    slug: "docker-container-exit-137",
    title: "A Docker container that exits with code 137",
    blurb: "Shows how to reason when the evidence points to a likely cause but does not prove it.",
    language: "yaml", framework: "Docker", tags: ["docker", "memory", "exit codes"], level: "intermediate",
    toolSlug: "docker-error-debugger", codeFile: "docker-compose.yml",
    error: `$ docker ps -a
CONTAINER ID   IMAGE        STATUS                       NAMES
3f1c9a7b2d10   api:latest   Exited (137) 2 minutes ago   api`,
    code: `services:
  api:
    image: api:latest
    deploy:
      resources:
        limits:
          memory: 256M`,
    lesson: ["Exit code 137 means the process received SIGKILL (128 + 9). Memory limits are a common sender, not the only one.", "Confirm with docker inspect before changing limits."],
    result: mk({
      language: "yaml", framework: "Docker", kinds: ["docker_error", "config"],
      headline: "The api container was killed (exit code 137) shortly after starting.",
      symptoms: ["docker ps -a shows Exited (137)"],
      root: {
        statement: "The container was probably killed for exceeding its 256 MB memory limit.",
        certainty: "likely",
        basis: "Exit 137 means SIGKILL, and the compose file sets a small memory limit. The input does not show the kernel's OOM message, so this is not proven.",
        explanation: "When a container goes over its memory limit, the kernel's out-of-memory killer ends it with SIGKILL, which Docker reports as 137. A Node or JVM service often needs more than 256 MB during startup.",
      },
      evidence: [
        { source: "error", quote: "Exited (137)", note: "137 is 128 + signal 9 (SIGKILL)." },
        { source: "code", line: 7, quote: "memory: 256M", note: "A low memory ceiling that makes an out-of-memory kill plausible." },
      ],
      confidence: { level: "medium", reason: "The exit code and the limit fit together, but nothing in the input confirms who sent the signal." },
      alternatives: [
        { cause: "Someone ran docker kill or the container was stopped and did not exit in time.", likelihood: "possible", check: "Check docker events or your shell history for a kill or stop around that time." },
        { cause: "The host itself ran out of memory and the host's OOM killer chose this process.", likelihood: "possible", check: "Run dmesg | grep -i 'killed process' on the host." },
      ],
      fix: {
        summary: "Confirm the OOM kill first, then raise the limit or reduce the app's memory use.",
        changes: [{ line: 7, description: "Try a higher limit such as 512M while you measure real usage.", why: "Gives the service room to start. Choose the final value from measured usage." }],
        correctedCode: `services:
  api:
    image: api:latest
    deploy:
      resources:
        limits:
          memory: 512M`,
        steps: ["Run docker inspect --format '{{.State.OOMKilled}}' api and confirm it prints true.", "Raise the limit or reduce the app's memory use, then restart."],
        risk: "low",
        preserves: "The image, service name and everything else in the file are unchanged.",
      },
      verification: ["docker inspect --format '{{.State.OOMKilled}}' api", "docker stats api  (watch memory while the service starts)"],
      prevention: ["Set the limit from measured peak usage plus headroom.", "Alert on container restarts so a crash loop is noticed early."],
    }),
  },
  {
    slug: "postgres-column-does-not-exist",
    title: "PostgreSQL says a column does not exist, but it does",
    blurb: "A camelCase column created with quotes is not found by an unquoted query.",
    language: "sql", framework: "PostgreSQL", tags: ["postgresql", "identifiers", "case"], level: "beginner",
    toolSlug: "sql-error-explainer", codeFile: "orders.sql",
    error: `ERROR:  column "userid" does not exist
LINE 1: SELECT userId, total FROM orders WHERE userId = 42;
HINT:  Perhaps you meant to reference the column "orders.userId".`,
    code: `CREATE TABLE orders ("userId" integer, total numeric);
SELECT userId, total FROM orders WHERE userId = 42;`,
    lesson: ["PostgreSQL lower-cases unquoted identifiers. A column created as \"userId\" must be quoted every time.", "snake_case names avoid the problem entirely."],
    result: mk({
      language: "sql", framework: "PostgreSQL", kinds: ["database_error", "source_code"],
      headline: "The query asks for userid, but the table has userId.",
      symptoms: ["ERROR: column \"userid\" does not exist"],
      root: {
        statement: "The column was created with a quoted mixed-case name, but the query uses it unquoted, so PostgreSQL folds it to lower case.",
        certainty: "confirmed",
        basis: "CREATE TABLE uses \"userId\" in quotes while the SELECT writes userId without quotes, and the database hint names orders.userId.",
        explanation: "PostgreSQL folds unquoted identifiers to lower case. userId in the query becomes userid, which does not match the stored, case-sensitive name userId.",
      },
      evidence: [
        { source: "code", line: 1, quote: "\"userId\" integer", note: "The column is defined with quotes, which preserves its capital I." },
        { source: "code", line: 2, quote: "SELECT userId, total", note: "The query repeats the name without quotes." },
        { source: "error", quote: "Perhaps you meant to reference the column \"orders.userId\"", note: "The database itself points to the differently cased column." },
      ],
      confidence: { level: "high", reason: "The definition, the query and the database hint all agree." },
      fix: {
        summary: "Quote the identifier in the query, or rename the column to snake_case.",
        changes: [{ line: 2, description: "Write \"userId\" with double quotes in the SELECT and WHERE.", why: "Quoted identifiers keep their exact case." }],
        correctedCode: `CREATE TABLE orders ("userId" integer, total numeric);
SELECT "userId", total FROM orders WHERE "userId" = 42;`,
        steps: ["Quote every use of the column, or rename it with ALTER TABLE orders RENAME COLUMN \"userId\" TO user_id and update the queries."],
        risk: "low",
        preserves: "Table design and data are untouched. Only the query changes.",
      },
      verification: ["Run the corrected SELECT in psql and confirm it returns rows without an error.", "\\d orders  (lists the exact column names)"],
      prevention: ["Use lower-case snake_case names for tables and columns.", "Do not mix quoted and unquoted identifiers in the same schema."],
    }),
  },
  {
    slug: "express-async-handler-crash",
    title: "An Express server that crashes when the database is down",
    blurb: "Separates the crash (an unhandled promise rejection) from the trigger (a refused database connection).",
    language: "javascript", framework: "Express", tags: ["node.js", "express", "async"], level: "intermediate",
    toolSlug: "nodejs-error-fixer", codeFile: "server.js",
    error: `node:internal/process/promises:394
    triggerUncaughtException(err, true /* fromPromise */);
Error: connect ECONNREFUSED 127.0.0.1:5432`,
    code: `app.get("/users/:id", async (req, res) => {
  const user = await db.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
  res.json(user.rows[0]);
});`,
    lesson: ["A crash and the failure that triggered it are two different problems; fix both.", "Express 4 does not catch rejected promises from async handlers. Express 5 does."],
    result: mk({
      language: "javascript", framework: "Express", kinds: ["stack_trace", "source_code"],
      headline: "The Node process exits when a request handler's database call fails.",
      symptoms: ["The process terminates with an uncaught exception from a promise", "ECONNREFUSED on 127.0.0.1:5432"],
      root: {
        statement: "The async route handler has no error handling, so the rejected database promise becomes an unhandled rejection that ends the process.",
        certainty: "likely",
        basis: "The handler awaits db.query without try/catch or next(err). Whether Express forwards the rejection depends on the Express version, which was not provided.",
        explanation: "Express 4 ignores the promise returned by a handler, so a rejection is never routed to the error middleware. Since Node 15, an unhandled rejection stops the process. The rejection itself was caused by nothing accepting connections on port 5432.",
      },
      evidence: [
        { source: "code", line: 2, quote: "await db.query(", note: "An awaited call that can reject, with no catch around it." },
        { source: "error", quote: "ECONNREFUSED 127.0.0.1:5432", note: "The database connection was refused, which is what rejected the promise." },
        { source: "error", quote: "fromPromise", note: "Node reports that the uncaught exception originated from a promise." },
      ],
      confidence: { level: "medium", reason: "The unhandled rejection is clear, but the Express version was not given, and the database being down is a separate problem." },
      alternatives: [{ cause: "PostgreSQL is not running, or is listening on another host or port.", likelihood: "likely", check: "Run pg_isready -h 127.0.0.1 -p 5432 and check your connection settings." }],
      missingContext: [{ question: "Which Express version does the project use?", why: "Express 5 forwards rejected promises to error middleware; Express 4 does not." }],
      fix: {
        summary: "Catch the error and pass it to Express's error handler, and check that the database is reachable.",
        changes: [{ line: 1, description: "Wrap the body in try/catch and call next(err).", why: "Express can then answer with a 500 instead of the process exiting." }],
        correctedCode: `app.get("/users/:id", async (req, res, next) => {
  try {
    const user = await db.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
    res.json(user.rows[0]);
  } catch (err) {
    next(err);
  }
});`,
        steps: ["Add try/catch with next(err).", "Add an error-handling middleware that returns a 500 response.", "Start or fix the database connection."],
        risk: "low",
        preserves: "The route, query and response shape are unchanged.",
      },
      verification: ["Stop the database and request /users/1. The server should stay up and answer 500.", "pg_isready -h 127.0.0.1 -p 5432"],
      prevention: ["Upgrade to Express 5 or use one wrapper for all async handlers.", "Add a health check that reports database connectivity."],
    }),
  },
]

export const getShowcase = (slug: string) => SHOWCASE.find((e) => e.slug === slug)
/** The sample session shown to guests on /demo. Same pre-written content, clearly labelled. */
export const GUEST_SAMPLE = SHOWCASE[0]

/** Title/description for the entry's page. Titles stay ≤ 60 chars, descriptions 70-160 (tests enforce it). */
export function showcaseMeta(e: ShowcaseEntry): { title: string; description: string } {
  return { title: e.title, description: `${e.blurb} Root cause, evidence and fix.` }
}
export const showcasePath = (slug: string) => `/community/${slug}`
