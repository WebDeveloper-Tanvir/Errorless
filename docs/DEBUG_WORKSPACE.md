# AI Debug Workspace

Dev Mode → **Debug** tab. Paste an error, optionally the code, and get a root cause, evidence and a minimal fix, streamed live.

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

## How the AI rules are enforced

The rules are enforced in code, not only in the prompt.

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

`npm test` runs `tests/debug.test.ts` (Node test runner, no network): redaction, partial JSON, SSE, diff, evidence verification, and the engine against a local mock Gemini SSE server. Browser behaviour (streaming render, error and retry, copy, feedback, shortcuts, mobile layout) was verified with Playwright against a mocked API.

**Not covered:** a live call to the real Gemini API. Verify with a real key before relying on output quality. If Monaco's CDN is unreachable the editor falls back to a plain textarea.
