# AI Debug Workspace (Root-Cause-First engine)

It is a debugging engine, not a chatbot: it only analyzes error-related input and returns a fixed, validated structure.

## Supported input

Error messages, stack traces, source code, logs, configuration files (package.json, Dockerfile, docker-compose, YAML, .env, tsconfig), API errors, database errors, Docker errors and dependency errors. `lib/debug/detect.ts` classifies the input (`summary.inputKinds`) and guesses language and framework. Language and framework default to **Auto-detect**; a value the user picks always wins.

## Response format (Zod: `lib/debug/schema.ts`)

| # | Section | Field |
|---|---|---|
| 1 | Error Summary (symptoms kept apart from the cause) | `summary`, `detected`, `dependencyIssues` |
| 2 | Root Cause | `rootCause` (`confirmed` / `likely` / `hypothesis`) |
| 3 | Supporting Evidence | `evidence[]`, each checked against the input |
| 4 | Confidence Level | `confidence` (`high`/`medium`/`low`), computed in code |
| 5 | Recommended Fix | `fix.summary`, `fix.steps`, `fix.risk`, `fix.preserves` |
| 6 | Corrected Code | `fix.correctedCode` (shown as a diff) |
| 7 | Explanation of Changes | `fix.changes[]` (`line`, `description`, `why`) |
| 8 | Verification Steps | `verification[]`, for the developer to run |
| 9 | Prevention Tips | `prevention[]` |

Also: `alternatives[]` (other possible causes, each with a concrete check), `missingContext[]` (essential questions only, max 3), `warnings[]`, `executed: false`.

`ModelOutputSchema` is lenient (bad fields fall back to safe defaults). `DebugResultSchema` is strict, and the engine never emits a result that fails it.

## Rules enforced in code

Dev Mode → **Debug** tab. Paste an error, optionally the code, and get a root cause, evidence and a minimal fix, streamed live.

Additional engine rules:

| Rule | Enforcement |
|---|---|
| Separate symptoms from root causes | `summary.symptoms` is separate. A root cause that only repeats the error line is flagged and capped at `likely`. |
| Confidence is not self-reported | Derived from certainty and how many evidence quotes were found in the input. The model's own confidence is ignored. |
| Never claim verification without execution | Sentences like "I ran it", "verified by running", "tests pass" are removed from all prose and a warning is added. `executed` is always `false`. |
| Safe suggestions | Destructive commands (rm -rf, DROP, git reset --hard, docker prune, sudo, curl-pipe-shell, force push) are removed from `verification` and `fix.steps`. |
| Essential questions only | Max 3, deduplicated, and dropped entirely when the cause is confirmed. |
| Multiple causes when unsure | `alternatives[]` with checks; confidence stays low/medium without proof. |
| Preserve intended behavior | `fix.preserves` states what is unchanged; large rewrites trigger a warning; identical "fixes" are dropped. |
| No invented dependencies | `dependencyIssues` names must appear in the input. |
| Redact secrets | Also covers Dockerfile ENV/ARG, YAML/INI values, connection-string passwords, Basic auth, x-api-key headers, CLI flags and Docker registry auth, with line counts preserved. |

## Setup

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Server-side key. Never sent to the browser. Without it the API returns `503 ai_not_configured` (there is no mock fallback). |
| `GEMINI_MODEL` | no | Defaults to `gemini-3.8-flash`. Override if Google renames or retires the model. The old `gemini-1.5-flash` is retired. |
| `GEMINI_API_BASE` | no | Override the Gemini base URL (used by tests). |
| `ADMIN_USER_IDS` / `ADMIN_EMAILS` | no | Clerk user IDs, or verified primary emails, treated as Premium admins. |

Access requires a signed-in user with a Dev Mode plan (Basic or Premium).

## Architecture

```
components/debug/*        UI: debug-workspace, code-input (Monaco + textarea fallback),
                          results-panel, diff-view, shortcuts-dialog, use-debug-session
app/api/devmode/debug     POST, Server-Sent Events: meta → partial* → result | error
app/api/devmode/debug/feedback   POST helpful / not helpful
lib/debug/engine.ts       runDebug(): redact → prompt → stream Gemini → normalize
lib/debug/gemini.ts       Gemini streamGenerateContent (key in x-goog-api-key header)
lib/debug/prompt.ts       system instruction, prompt, JSON response schema
lib/debug/normalize.ts    evidence verification and result sanitising
lib/debug/redact.ts       secret masking (line counts preserved)
lib/debug/partial-json.ts progressive rendering of partial JSON
lib/debug/diff.ts         LCS line diff for Before/After
```

The prompt asks for these behaviors, and `normalize.ts` enforces them regardless of what the model returns.

| Rule | Enforcement |
|---|---|
| Never invent files, functions or line numbers | Each evidence quote must appear in the submitted error or code. Found quotes get a line number computed by Errorless; unmatched quotes are marked "not found" and their line numbers dropped. |
| Never claim code was executed | `executed` is forced to `false`; verification commands are shown for the user to run. |
| Never overwrite user code | Output is a read-only suggestion with a diff and Copy button. Nothing writes back. |
| Prefer minimal changes | Prompt requires the smallest fix; an identical or oversized fix is flagged with a warning. |
| Confirmed vs hypothesis | Certainty is `confirmed`/`likely`/`hypothesis`; `confirmed` is downgraded when no evidence was verified. Other causes are listed separately as unconfirmed. |
| Protect keys and sensitive code | Secrets are masked client-side (preview) and server-side before the model call; the Gemini key is server-only and sent in a header; provider error details are never returned; feedback stores no code. |
| Ask for missing context | `status: needs_context` plus specific questions. |

## Limits

Error text 20,000 chars, code 60,000, context 5,000, uploads 200 KB (text only). Larger requests get `413`.

## Keyboard shortcuts

`Ctrl/⌘+Enter` analyze · `Esc` cancel · `Alt+V` paste error · `Alt+E` example · `Alt+Backspace` clear · `Alt+/` shortcuts.

## Feedback

"Was this helpful?" stores the rating, certainty, language, framework and an optional comment (max 500 chars) in Clerk `privateMetadata.debugFeedback` (last 20). No code or error text is stored.

## Tests

`npm test` runs `tests/*.test.ts` (Node test runner, no network). `debug.test.ts`: redaction, partial JSON, SSE, diff, evidence verification, engine against a local mock Gemini SSE server. `root-cause.test.ts`: input/language/framework detection for all nine input types, schema leniency and strictness, each engine rule above, and end-to-end scenarios (Python KeyError, React undefined map, Docker lockfile, Postgres missing table, npm ERESOLVE, API 401/CORS, hallucination guard, secrets never reaching the prompt) using an injected model. Browser behaviour (streaming render, error and retry, copy, feedback, shortcuts, mobile layout) was verified with Playwright against a mocked API.

**Not covered:** a live call to the real Gemini API. Verify with a real key before relying on output quality. If Monaco's CDN is unreachable the editor falls back to a plain textarea.
