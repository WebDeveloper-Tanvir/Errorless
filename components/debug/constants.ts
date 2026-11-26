export const LANGUAGES = [
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
  { value: "other", label: "Other", monaco: "plaintext" },
] as const

export const FRAMEWORKS = [
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
] as const

/** Extension → language, used when a code file is uploaded. */
export const EXT_LANGUAGE: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", py: "python", java: "java", cs: "csharp",
  cpp: "cpp", cc: "cpp", c: "c", h: "c", go: "go", rs: "rust", rb: "ruby", php: "php",
  swift: "swift", kt: "kotlin", sql: "sql", sh: "bash", html: "html", css: "css",
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
]
