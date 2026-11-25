"use client"

import { useMemo, useState } from "react"
import { CodeEditor, EDITOR_LANGUAGES, type EditorLanguage } from "@/components/code-editor"
import { ErrorPanel } from "@/components/error-panel"
import { Header } from "@/components/header"
import { analyzeCode } from "@/lib/code-analyzer"

const STARTER = `function helloWorld() {
  console.log("Hello, World!")
  return 42
}

helloWorld()`

export default function EditorPage() {
  const [code, setCode] = useState(STARTER)
  const [language, setLanguage] = useState<EditorLanguage>("javascript")

  const ext = EDITOR_LANGUAGES.find((l) => l.value === language)?.ext ?? "txt"
  const result = useMemo(() => analyzeCode(code, `code.${ext}`), [code, ext])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="flex h-[calc(100dvh-4rem)] flex-col md:flex-row">
        <div className="flex min-h-0 flex-1 flex-col border-b border-border md:border-b-0 md:border-r">
          <CodeEditor code={code} language={language} onCodeChange={setCode} onLanguageChange={setLanguage} />
        </div>
        <ErrorPanel result={result} className="h-72 shrink-0 md:h-auto md:w-96" />
      </main>
    </div>
  )
}
