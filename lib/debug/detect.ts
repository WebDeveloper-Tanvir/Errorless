import type { InputKind } from "./schema.ts"

/**
 * Deterministic detection of what the user pasted, which language it is, and the likely
 * framework. These are HINTS: they are passed to the model labelled as heuristics and used
 * as a fallback when the model does not say. They never override a language the user chose.
 */

const any = (re: RegExp, s: string) => re.test(s)

const STACK = [
  /^\s+at .+\(.+:\d+:\d+\)/m,
  /^\s+at .+:\d+:\d+$/m,
  /Traceback \(most recent call last\)/,
  /^\s+at [\w.$<>]+\([\w$]+\.java:\d+\)/m,
  /\bgoroutine \d+ \[/,
  /thread '.+' panicked at/,
  /^\s+at [\w.`<>]+\(.*\) in .+:line \d+/m,
  /^Stack trace:\s*$/m,
  /^\s+from .+\.rb:\d+:in /m,
  /^Caused by: /m,
]
const API = /\b(?:HTTP\/\d(?:\.\d)?\s+[45]\d\d|status(?: code)?[:= ]+[45]\d\d|[45]\d\d (?:Bad Request|Unauthorized|Forbidden|Not Found|Method Not Allowed|Too Many Requests|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Time-?out)|AxiosError|FetchError|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|CORS|Access-Control-Allow-Origin|Failed to fetch|NetworkError)\b/i
const DB = /(?:SQLSTATE|\bORA-\d{4,5}|psycopg2|\bPG::|PostgreSQL|\bMySQL|mysqli|SQLITE_|sqlite3\.|MongoServerError|\bE11000\b|duplicate key value|relation ".+" does not exist|deadlock detected|PrismaClient\w*Error|\bP\d{4}\b.*(?:prisma|Unique|constraint)|Sequelize\w*Error|foreign key constraint|Unknown column|no such table|SequelizeDatabaseError|ProgrammingError|OperationalError|IntegrityError|QueryFailedError)/i
const DOCKER = /(?:\bdocker\b|Dockerfile|docker-compose|compose\.ya?ml|failed to solve|OCI runtime|Cannot connect to the Docker daemon|pull access denied|manifest unknown|exec format error|COPY failed|executor failed running)/i
const DEPENDENCY = /(?:Cannot find module|ModuleNotFoundError|No module named|\bERESOLVE\b|npm ERR!|\bpeer dep|Could not resolve dependency|No matching distribution|ImportError|cannot find package|Could not find artifact|Unresolved reference|version solving failed|failed to select a version|unmet dependency|ERR_PNPM|DLL load failed|incompatible with|requires a peer|Module not found: Error: Can't resolve|Package .+ not found|Could not resolve (?:host|dependency))/i
const LOGLINE = /^\s*(?:\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}|\d{2}:\d{2}:\d{2}[.,]\d+|\[(?:INFO|WARN|WARNING|ERROR|DEBUG|FATAL)\]|(?:INFO|WARN|WARNING|ERROR|DEBUG|FATAL)\b)/

export function looksLikeConfig(code: string): boolean {
  const t = code.trim()
  if (!t) return false
  if (/^FROM\s+\S+/im.test(t) && /^(?:RUN|COPY|CMD|ENTRYPOINT|WORKDIR|ADD)\b/im.test(t)) return true // Dockerfile
  if ((t.startsWith("{") || t.startsWith("[")) && !/[;]\s*$/m.test(t)) {
    try {
      JSON.parse(t)
      return true
    } catch {
      if (/"(?:dependencies|devDependencies|compilerOptions|scripts|extends|services|version)"\s*:/.test(t)) return true
    }
  }
  const lines = t.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"))
  if (lines.length === 0) return true
  const kv = lines.filter((l) => /^\s*[A-Za-z_][\w.-]*\s*[:=]\s*\S?/.test(l) || /^\s*-\s+\S/.test(l) || /^\s*\[[\w.-]+\]\s*$/.test(l)).length
  const codey = lines.filter((l) => /[;{}()]\s*$|^\s*(?:def|function|class|import|from|const|let|var|public|private|func|fn|package|using|return)\b/.test(l)).length
  return kv / lines.length > 0.7 && codey / lines.length < 0.15
}

export function detectInputKinds(errorText: string, code: string): InputKind[] {
  const all = `${errorText}\n${code}`
  const kinds = new Set<InputKind>()
  if (errorText.trim()) kinds.add("error_message")
  if (STACK.some((r) => r.test(errorText))) kinds.add("stack_trace")
  const logLines = errorText.split("\n").filter((l) => LOGLINE.test(l)).length
  if (logLines >= 3) kinds.add("logs")
  if (any(API, errorText)) kinds.add("api_error")
  if (any(DB, errorText)) kinds.add("database_error")
  if (any(DOCKER, all)) kinds.add("docker_error")
  if (any(DEPENDENCY, errorText)) kinds.add("dependency_error")
  if (code.trim()) kinds.add(looksLikeConfig(code) ? "config" : "source_code")
  if (looksLikeConfig(errorText) && !kinds.has("stack_trace") && errorText.split("\n").length > 3) kinds.add("config")
  return [...kinds]
}

export interface LanguageGuess {
  language: string
  confidence: "high" | "medium" | "low"
}

const BY_EXT: [RegExp, string][] = [
  [/\.(?:tsx?|mts|cts)\b[:)]/, "typescript"],
  [/\.(?:jsx?|mjs|cjs)\b[:)]/, "javascript"],
  [/\.py\b[",:)]/, "python"],
  [/\.java:\d+/, "java"],
  [/\.kt:\d+/, "kotlin"],
  [/\.go:\d+/, "go"],
  [/\.rs:\d+/, "rust"],
  [/\.rb:\d+/, "ruby"],
  [/\.php\b/, "php"],
  [/\.cs:line \d+/, "csharp"],
  [/\.swift:\d+/, "swift"],
  [/\.(?:cpp|cc|cxx|hpp):\d+/, "cpp"],
]

export function detectLanguage(errorText: string, code: string): LanguageGuess | null {
  const t = errorText
  if (/Traceback \(most recent call last\)/.test(t) || /\b(?:ModuleNotFoundError|IndentationError|NameError|KeyError|AttributeError|ImportError):/.test(t))
    return { language: "python", confidence: "high" }
  if (/\bat [\w.$]+\([\w$]+\.java:\d+\)/.test(t) || /\bException in thread\b|\bjava\.lang\./.test(t)) return { language: "java", confidence: "high" }
  if (/\bgoroutine \d+ \[|^panic: /m.test(t)) return { language: "go", confidence: "high" }
  if (/thread '.+' panicked at|error\[E\d{4}\]/.test(t)) return { language: "rust", confidence: "high" }
  if (/System\.\w+Exception|\bat .+ in .+\.cs:line \d+/.test(t)) return { language: "csharp", confidence: "high" }
  if (/\bNoMethodError\b|\.rb:\d+:in /.test(t)) return { language: "ruby", confidence: "high" }
  if (/\bPHP (?:Fatal|Parse|Warning)|Stack trace:\s*\n#0 /.test(t)) return { language: "php", confidence: "high" }
  for (const [re, lang] of BY_EXT) if (re.test(t)) return { language: lang, confidence: "medium" }
  if (/\b(?:TypeError|ReferenceError|SyntaxError|RangeError): |node:internal|Unhandled(?:Promise)?Rejection|npm ERR!/.test(t)) {
    return { language: /\bTS\d{4}\b|\.tsx?\b/.test(t + code) ? "typescript" : "javascript", confidence: "medium" }
  }
  if (/\bTS\d{4}:/.test(t)) return { language: "typescript", confidence: "high" }

  const c = code
  if (!c.trim()) return null
  if (/^FROM\s+\S+/im.test(c) && /^(?:RUN|COPY|CMD)\b/im.test(c)) return { language: "dockerfile", confidence: "high" }
  if (/<\?php/.test(c)) return { language: "php", confidence: "high" }
  if (/^\s*package\s+\w+\s*$/m.test(c) && /\bfunc\s+\w+\(/.test(c)) return { language: "go", confidence: "high" }
  if (/\bfn\s+\w+\s*\(.*\)\s*(?:->|\{)/.test(c) && /\blet\s+(?:mut\s+)?\w+/.test(c)) return { language: "rust", confidence: "high" }
  if (/^\s*using\s+System\b|\bnamespace\s+[\w.]+\s*[{;]/m.test(c)) return { language: "csharp", confidence: "high" }
  if (/\bpublic\s+(?:static\s+)?(?:class|void|interface)\b/.test(c) && /;\s*$/m.test(c)) return { language: /\bnamespace\b/.test(c) ? "csharp" : "java", confidence: "medium" }
  if (/^\s*def\s+\w+\(.*\)\s*:\s*$/m.test(c) || /^\s*(?:import|from)\s+\w+.*$/m.test(c) && /:\s*$/m.test(c) && !/[;{]\s*$/m.test(c)) return { language: "python", confidence: "medium" }
  if (/^\s*def\s+\w+/m.test(c) && /^\s*end\s*$/m.test(c)) return { language: "ruby", confidence: "medium" }
  if (/\b(?:interface|type)\s+\w+\s*(?:=|\{)|:\s*(?:string|number|boolean)\b|\bas\s+const\b/.test(c)) return { language: "typescript", confidence: "medium" }
  if (/\b(?:const|let|var|function)\b|=>|require\(|\bimport\s.+from\s/.test(c)) return { language: "javascript", confidence: "medium" }
  if (/^\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE)\b/im.test(c)) return { language: "sql", confidence: "medium" }
  return null
}

const FRAMEWORKS: [RegExp, string][] = [
  [/\bnext\/(?:dist|server|navigation|router)|getServerSideProps|Hydration failed|app\/.+\/(?:page|layout)\.tsx|NEXT_PUBLIC_/, "Next.js"],
  [/@angular\/|\bNG\d{4}\b|ExpressionChangedAfterItHasBeenChecked/, "Angular"],
  [/\bvue(?:-router)?\b.*(?:warn|error)|\[Vue warn\]|defineComponent|<script setup/i, "Vue"],
  [/react-dom|Invalid hook call|\buse(?:State|Effect|Memo|Callback)\(|Minified React error|\bReact\.|from ["']react["']/, "React"],
  [/\bsvelte\b|\$:\s|<script lang="ts">\s*\n\s*export let/i, "Svelte"],
  [/\bdjango\b|django\.|manage\.py/i, "Django"],
  [/\bfastapi\b|pydantic|uvicorn/i, "FastAPI"],
  [/\bflask\b|werkzeug/i, "Flask"],
  [/org\.springframework|\bSpring Boot\b|@SpringBootApplication|@RestController/, "Spring Boot"],
  [/Microsoft\.AspNetCore|\bASP\.NET\b/, "ASP.NET Core"],
  [/ActionController|ActiveRecord|\bRails\b/, "Rails"],
  [/Illuminate\\|\bLaravel\b|artisan/, "Laravel"],
  [/\bexpress\b.*(?:Cannot|Error)|node_modules\/express|require\(["']express["']\)/, "Node.js / Express"],
  [/\bflutter\b|Dart VM|RenderFlex overflowed/i, "Flutter"],
  [/\bAndroidRuntime\b|android\.|\.gradle\b/, "Android"],
]

export function detectFramework(errorText: string, code: string): string | null {
  const all = `${errorText}\n${code}`
  for (const [re, name] of FRAMEWORKS) if (re.test(all)) return name
  return null
}

export interface Detection {
  inputKinds: InputKind[]
  language: LanguageGuess | null
  framework: string | null
}

export function detectAll(errorText: string, code: string): Detection {
  return { inputKinds: detectInputKinds(errorText, code), language: detectLanguage(errorText, code), framework: detectFramework(errorText, code) }
}
