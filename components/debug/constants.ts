export const LANGUAGES = [
  { value: "auto", label: "Auto-detect", monaco: "plaintext" },
  { value: "javascript", label: "JavaScript", monaco: "javascript" },
  { value: "typescript", label: "TypeScript", monaco: "typescript" },
  { value: "python", label: "Python", monaco: "python" },
  { value: "java", label: "Java", monaco: "java" },
  { value: "csharp", label: "C#", monaco: "csharp" },
  { value: "cpp", label: "C++", monaco: "cpp" },
  { value: "c", label: "C", monaco: "c" },
  { value: "go", label: "Go", monaco: "go" },
  { value: "rust", label: "Rust", monaco: "rust" },
  { value: "ruby", label: "Ruby", monaco: "ruby" },
  { value: "php", label: "PHP", monaco: "php" },
  { value: "swift", label: "Swift", monaco: "swift" },
  { value: "kotlin", label: "Kotlin", monaco: "kotlin" },
  { value: "sql", label: "SQL", monaco: "sql" },
  { value: "bash", label: "Shell", monaco: "shell" },
  { value: "html", label: "HTML", monaco: "html" },
  { value: "css", label: "CSS", monaco: "css" },
  { value: "dockerfile", label: "Dockerfile", monaco: "dockerfile" },
  { value: "yaml", label: "YAML", monaco: "yaml" },
  { value: "json", label: "JSON", monaco: "json" },
  { value: "ini", label: "TOML / INI / .env", monaco: "ini" },
  { value: "other", label: "Other", monaco: "plaintext" },
] as const

export const FRAMEWORKS = [
  "Auto-detect",
  "None / plain language",
  "React",
  "Next.js",
  "Vue",
  "Angular",
  "Svelte",
  "Node.js / Express",
  "Django",
  "Flask",
  "FastAPI",
  "Spring Boot",
  "ASP.NET Core",
  "Rails",
  "Laravel",
  "Flutter",
  "Android",
  "Unity",
  "Docker / Compose",
] as const

/** Extension → language, used when a code file is uploaded. */
export const EXT_LANGUAGE: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", py: "python", java: "java", cs: "csharp",
  cpp: "cpp", cc: "cpp", c: "c", h: "c", go: "go", rs: "rust", rb: "ruby", php: "php",
  swift: "swift", kt: "kotlin", sql: "sql", sh: "bash", html: "html", css: "css",
  yml: "yaml", yaml: "yaml", json: "json", toml: "ini", ini: "ini", env: "ini", dockerfile: "dockerfile",
}

export interface Example {
  label: string
  language: string
  framework: string
  errorText: string
  code: string
}

export const EXAMPLES: Example[] = [
  {
    label: "React: map of undefined",
    language: "javascript",
    framework: "React",
    errorText: `Uncaught TypeError: Cannot read properties of undefined (reading 'map')
    at UserList (UserList.jsx:12:14)
    at renderWithHooks (react-dom.development.js:16305:18)`,
    code: `import { useEffect, useState } from "react"

export default function UserList() {
  const [users, setUsers] = useState()

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setUsers)
  }, [])

  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  )
}
`,
  },
  {
    label: "Python: KeyError",
    language: "python",
    framework: "None / plain language",
    errorText: `Traceback (most recent call last):
  File "app.py", line 7, in <module>
    print(total_price({"items": [{"price": 10, "quantity": 2}]}))
  File "app.py", line 4, in total_price
    total += item["price"] * item["qty"]
KeyError: 'qty'`,
    code: `def total_price(order):
    total = 0
    for item in order["items"]:
        total += item["price"] * item["qty"]
    return total


print(total_price({"items": [{"price": 10, "quantity": 2}]}))
`,
  },
  {
    label: "Docker: build fails",
    language: "dockerfile",
    framework: "Docker / Compose",
    errorText: `failed to solve: process "/bin/sh -c npm ci" did not complete successfully: exit code: 1
npm ERR! code EUSAGE
npm ERR! \`npm ci\` can only install packages when your package.json and package-lock.json are in sync.`,
    code: `FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm ci
COPY . .
CMD ["node", "server.js"]
`,
  },
  {
    label: "Postgres: missing table",
    language: "sql",
    framework: "None / plain language",
    errorText: `error: relation "users" does not exist
    at Parser.parseErrorMessage (node_modules/pg-protocol/dist/parser.js:287:98)
  code: '42P01'`,
    code: `SELECT id, email FROM users WHERE active = true;
`,
  },
]
