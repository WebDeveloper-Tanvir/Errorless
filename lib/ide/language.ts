/**
 * The single source of truth for "what is this file and how can it run".
 * Detection is by file extension only. Nothing falls back to Python: an unknown or
 * non-runnable file reports that it cannot run instead of pretending it did.
 */
export type RuntimeKind =
  | "html"        // rendered in the sandboxed preview
  | "css"         // applied to the project's HTML in the preview
  | "browser-js"  // executed in the sandboxed browser frame
  | "browser-ts"  // transpiled in the browser, then executed like JavaScript
  | "python"      // Pyodide (WebAssembly) in a sandboxed worker
  | "remote"      // needs the isolated compiler service (/api/ide/execute)
  | "none"        // known file type with nothing to execute (data, docs, config)
  | "unsupported" // code we have no runtime for

export interface LanguageInfo {
  id: string
  label: string
  /** Monaco language id for syntax highlighting. */
  monaco: string
  runtime: RuntimeKind
  /** Piston-style language name for remote runtimes. */
  remote?: string
}

const L = (id: string, label: string, runtime: RuntimeKind, monaco = id, remote?: string): LanguageInfo => ({ id, label, monaco, runtime, remote })

const BY_EXT: Record<string, LanguageInfo> = {
  html: L("html", "HTML", "html"),
  htm: L("html", "HTML", "html"),
  css: L("css", "CSS", "css"),
  js: L("javascript", "JavaScript", "browser-js"),
  mjs: L("javascript", "JavaScript", "browser-js"),
  cjs: L("javascript", "JavaScript", "browser-js"),
  ts: L("typescript", "TypeScript", "browser-ts"),
  mts: L("typescript", "TypeScript", "browser-ts"),
  py: L("python", "Python", "python"),
  c: L("c", "C", "remote", "c", "c"),
  cpp: L("cpp", "C++", "remote", "cpp", "c++"),
  cc: L("cpp", "C++", "remote", "cpp", "c++"),
  cxx: L("cpp", "C++", "remote", "cpp", "c++"),
  java: L("java", "Java", "remote", "java", "java"),
  // JSX/TSX need React and a bundler, which the in-browser runner does not provide.
  jsx: L("javascript", "JSX", "unsupported", "javascript"),
  tsx: L("typescript", "TSX", "unsupported", "typescript"),
  go: L("go", "Go", "unsupported"),
  rs: L("rust", "Rust", "unsupported"),
  rb: L("ruby", "Ruby", "unsupported"),
  php: L("php", "PHP", "unsupported"),
  swift: L("swift", "Swift", "unsupported"),
  sql: L("sql", "SQL", "none"),
  json: L("json", "JSON", "none"),
  md: L("markdown", "Markdown", "none"),
  txt: L("plaintext", "Text", "none"),
  xml: L("xml", "XML", "none"),
  yml: L("yaml", "YAML", "none"),
  yaml: L("yaml", "YAML", "none"),
  h: L("c", "C header", "none", "c"),
  hpp: L("cpp", "C++ header", "none", "cpp"),
}

const UNKNOWN: LanguageInfo = L("plaintext", "Plain text", "unsupported")

export function extensionOf(filename: string): string {
  const base = filename.split("/").pop() ?? filename
  const i = base.lastIndexOf(".")
  return i > 0 ? base.slice(i + 1).toLowerCase() : ""
}

export function detectLanguage(filename: string): LanguageInfo {
  return BY_EXT[extensionOf(filename)] ?? UNKNOWN
}

/** Why a file can't be run, in words fit for the terminal. Empty string when it can run. */
export function cannotRunReason(filename: string): string {
  const info = detectLanguage(filename)
  switch (info.runtime) {
    case "none":
      return `${filename} is a ${info.label} file. There is nothing to execute.`
    case "unsupported":
      return extensionOf(filename) === "jsx" || extensionOf(filename) === "tsx"
        ? `${filename}: JSX/TSX needs React and a bundler, which the in-browser runner does not include.`
        : `${filename}: no runtime is available for ${info.label}. Supported: HTML, CSS, JavaScript, TypeScript, Python, and C/C++/Java when a compiler service is configured.`
    default:
      return ""
  }
}

/** Starter text in the file's own comment syntax (a `//` line in a .py file is a syntax error). */
export function starterContent(filename: string): string {
  const info = detectLanguage(filename)
  switch (info.id) {
    case "html":
      return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${filename}</title>\n</head>\n<body>\n  <h1>Hello Errorless!</h1>\n</body>\n</html>\n`
    case "css":
      return `/* ${filename} */\n`
    case "python":
      return `# ${filename}\n`
    case "json":
      return `{}\n`
    case "markdown":
      return `# ${filename}\n`
    case "yaml":
      return `# ${filename}\n`
    case "plaintext":
    case "xml":
      return ``
    default:
      return `// ${filename}\n`
  }
}
