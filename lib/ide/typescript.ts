/**
 * TypeScript in the browser: syntax-level transpilation only (like the TS Playground's "JS" tab).
 * Type errors are NOT checked, and the UI says so. Nothing here executes code.
 *
 * The compiler (typescript/lib/typescript.js) is copied to /ide-runtime/typescript.js at build time
 * and loaded on demand, so it costs nothing until a .ts file is run.
 */
export interface TsDiagnostic { line: number; col: number; message: string }
export interface TsResult { js: string; diagnostics: TsDiagnostic[] }

interface TsLike {
  transpileModule(code: string, o: unknown): { outputText: string; diagnostics?: readonly { start?: number; messageText: unknown; file?: { getLineAndCharacterOfPosition(p: number): { line: number; character: number } } }[] }
  ScriptTarget: Record<string, number>
  ModuleKind: Record<string, number>
  flattenDiagnosticMessageText(m: unknown, nl: string): string
}

export function transpileWith(ts: TsLike, code: string, fileName: string): TsResult {
  const out = ts.transpileModule(code, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, sourceMap: false, esModuleInterop: true },
  })
  const diagnostics = (out.diagnostics ?? []).map((d) => {
    const pos = d.start !== undefined && d.file ? d.file.getLineAndCharacterOfPosition(d.start) : { line: 0, character: 0 }
    return { line: pos.line + 1, col: pos.character + 1, message: ts.flattenDiagnosticMessageText(d.messageText, "\n") }
  })
  return { js: out.outputText, diagnostics }
}

export const TS_RUNTIME_URL = "/ide-runtime/typescript.js"
let loading: Promise<TsLike> | null = null

/** Loads the compiler once. Rejects with a readable error if the file is not deployed. */
export function loadTypeScript(): Promise<TsLike> {
  const w = globalThis as unknown as { ts?: TsLike; document?: Document }
  if (w.ts?.transpileModule) return Promise.resolve(w.ts)
  if (loading) return loading
  loading = new Promise<TsLike>((resolve, reject) => {
    const s = w.document!.createElement("script")
    s.src = TS_RUNTIME_URL
    s.async = true
    s.onload = () => (w.ts?.transpileModule ? resolve(w.ts) : reject(new Error("The TypeScript compiler loaded but did not initialise.")))
    s.onerror = () => { loading = null; reject(new Error(`Could not load the TypeScript compiler (${TS_RUNTIME_URL}). Run the build step that copies it (npm run prepare:ide).`)) }
    w.document!.head.appendChild(s)
  })
  return loading
}

export async function transpileTs(code: string, fileName: string): Promise<TsResult> {
  return transpileWith(await loadTypeScript(), code, fileName)
}
