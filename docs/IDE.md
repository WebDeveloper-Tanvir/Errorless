# Errorless IDE: runtime and AI assistant

How code runs, how the assistant works, what you must configure, and what is *not* supported.

## What runs where

| File type | Runs in | Notes |
|---|---|---|
| `.html` / `.htm` | Sandboxed preview iframe | Linked `style.css` / `.js` files from the project are inlined. |
| `.css` | Same preview | Shown inside the project's HTML page; if none exists you are told. |
| `.js` `.mjs` `.cjs` | Sandboxed preview iframe | `console.*` and runtime errors are captured. DOM is available. |
| `.ts` `.mts` | Transpiled in the browser, then as JS | **Syntax-only**: no type checking. Syntax errors stop the run. |
| `.py` | Pyodide (WebAssembly) in a Web Worker inside a sandboxed iframe | Standard library only by default; no `input()` (raises `EOFError`). |
| `.c` `.cpp` `.java` | An external execution service | Needs `EXEC_SERVICE_URL`; otherwise a clear "not configured" error. |
| everything else | not runnable | The terminal says so; nothing is reported as success. |

A run only prints `✓ Execution completed.` when code actually executed and finished without error.

## Terminal

`help`, `clear`, `run <file>`, `run` (re-runs the active file). It is **not a shell**: `npm`, `git`, `pip` etc. are refused with an explanation.

## Security model

- Untrusted code never runs in the Next.js process or on the app origin.
- The preview and Python frames use `sandbox="allow-scripts"` (preview also `allow-modals`) **without** `allow-same-origin`: they get an opaque origin, so no cookies, storage, tokens or DOM access to the app.
- Messages from frames are validated (source, per-run nonce, type, size caps) and treated as text; nothing is evaluated in the parent.
- The preview CSP and the Python frame CSP are injected into each document. Python can only fetch its own runtime files.
- Stop / timeout destroys the Python iframe (the only dependable way to interrupt WebAssembly). Browser JS in the preview is stopped by clearing the preview.
- C/C++/Java: server route requires sign-in, validates input, rate-limits (20 runs/min/user), and forwards to a **separate** Piston-compatible service. Run that service isolated (containers, no network, resource limits).

## Setup and deployment

`npm install` runs `postinstall` → `scripts/prepare-ide-runtime.mjs`, which copies Pyodide (~20 MB) and TypeScript into `public/ide-runtime/` (git-ignored). If it fails it warns; Python/TS then show a load error instead of running. CI/hosting must run `npm install` with scripts enabled (or `npm run prepare:ide`).

`next.config.mjs` serves `/ide-runtime/*` with `Access-Control-Allow-Origin: *` and `Cross-Origin-Resource-Policy: cross-origin` (the sandboxed worker has an opaque origin, so it fetches cross-origin). `middleware.ts` makes `/ide-runtime` public. If you put the runtime on a CDN instead, set `NEXT_PUBLIC_PYODIDE_BASE_URL` (must end with the Pyodide folder and send the same CORS headers).

| Variable | Purpose | Required |
|---|---|---|
| `EXEC_SERVICE_URL` | Base URL of a Piston-compatible service (`POST /api/v2/execute`) | Only for C/C++/Java |
| `EXEC_SERVICE_KEY` | Sent as the `Authorization` header to that service | Optional |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_API_BASE` | Cloud AI provider (server-side only) | Only for Cloud AI |
| `IDE_AI_DAILY_LIMIT` | Cloud AI requests per user per day (default 100) | Optional |
| `NEXT_PUBLIC_PYODIDE_BASE_URL` | Alternate Pyodide location | Optional |

## AI assistant

Two providers behind one interface (`lib/ide/ai/types.ts`):

- **Local (free)**: WebLLM + WebGPU. Nothing downloads until the user presses *Download & load*; weights are cached by the browser; your code never leaves the device. Models are a curated list (`lib/ide/ai/models.ts`), verified against the installed WebLLM by a test. Needs a WebGPU browser (recent Chrome/Edge) and roughly 1–5 GB of free GPU memory depending on the model. Without WebGPU the panel explains why.
- **Cloud**: `/api/ide/chat` (sign-in + Dev Mode plan). The provider key stays on the server; the server owns the system prompt, validates input (size/shape), redacts secrets before sending, and applies per-minute (8) and daily limits. **Limits are per server instance** (in-memory), so on multi-instance serverless they are best-effort brakes; use a shared store if you need hard quotas.

There is no fake or canned fallback. With no model available the panel says what to do.

Ten actions (Explain Code, Find Bugs, Fix This Error, Optimize, Generate Code, Explain Selected, Refactor, Write Documentation, Generate Unit Tests, Explain Terminal Output) send the relevant context: the file, language, selection, last error/stack, or terminal tail. Replies are asked to separate CONFIRMED causes from HYPOTHESES and to never claim code was run.

**Apply** never writes automatically: it opens a diff, verifies the selection has not changed, and writes only after you confirm (undo with Ctrl+Z).

Conversation history is **off by default**. If enabled it is saved in this browser only, keyed by account, and deleted when switched off.

## Known limitations

- TypeScript is not type-checked.
- Python: no stdin; extra packages need network access to Pyodide's package index, which the sandbox CSP blocks, so only the standard library is supported out of the box.
- Infinite loops: Python is hard-stopped after 20 s or on Stop. Browser JS stops on Stop; a loop in the preview is isolated from the app in Chrome (verified), but other browsers may share a thread with the page.
- The in-memory file system does not persist across reloads (pre-existing).
- Local AI quality depends on the small model chosen; always review suggestions.
- WebLLM generation and a real Piston service could not be exercised in the build sandbox (no GPU/network); they are covered by interface tests with fakes, and the Python/JS/HTML/CSS/TS runtimes and the chat UI were exercised in real Chrome.
