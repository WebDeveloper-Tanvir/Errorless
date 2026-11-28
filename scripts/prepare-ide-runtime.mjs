// Copies the browser runtimes the IDE needs into public/ide-runtime/ (git-ignored, ~15 MB):
//   - Pyodide (Python/WebAssembly) core files from the `pyodide` package
//   - the TypeScript compiler (typescript.js) from the `typescript` package
// Self-hosting keeps the IDE working without a third-party CDN and lets the files be served with
// the CORS headers the sandboxed Python frame needs. Safe to run repeatedly; exits 0 if a package
// is not installed (e.g. a production-only install) so it can never break `npm install`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const out = join(process.cwd(), "public", "ide-runtime")
const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
}

try {
  const pyDir = dirname(require.resolve("pyodide/package.json"))
  for (const f of ["pyodide.js", "pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) {
    if (existsSync(join(pyDir, f))) copy(join(pyDir, f), join(out, "pyodide", f))
  }
  console.log("[ide-runtime] pyodide copied")
} catch {
  console.warn("[ide-runtime] pyodide package not found; Python runner will be unavailable")
}

try {
  const tsDir = dirname(require.resolve("typescript/package.json"))
  copy(join(tsDir, "lib", "typescript.js"), join(out, "typescript.js"))
  console.log("[ide-runtime] typescript copied")
} catch {
  console.warn("[ide-runtime] typescript package not found; TypeScript runner will be unavailable")
}
