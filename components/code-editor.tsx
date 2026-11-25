"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy, Download } from "lucide-react"

export const EDITOR_LANGUAGES = [
  { value: "javascript", label: "JavaScript", ext: "js" },
  { value: "typescript", label: "TypeScript", ext: "ts" },
  { value: "python", label: "Python", ext: "py" },
  { value: "java", label: "Java", ext: "java" },
] as const

export type EditorLanguage = (typeof EDITOR_LANGUAGES)[number]["value"]

interface CodeEditorProps {
  code: string
  language: EditorLanguage
  onCodeChange: (code: string) => void
  onLanguageChange: (language: EditorLanguage) => void
}

export function CodeEditor({ code, language, onCodeChange, onLanguageChange }: CodeEditorProps) {
  const [copied, setCopied] = useState(false)
  const ext = EDITOR_LANGUAGES.find((l) => l.value === language)?.ext ?? "txt"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable (insecure context / permission denied) */
    }
  }

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `code.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5 md:px-4">
        <div className="flex items-center gap-2">
          <label htmlFor="editor-language" className="sr-only">Language</label>
          <select
            id="editor-language"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as EditorLanguage)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
          >
            {EDITOR_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">code.{ext}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download aria-hidden />
            Download
          </Button>
        </div>
      </div>

      <label htmlFor="editor-code" className="sr-only">Code</label>
      <textarea
        id="editor-code"
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        spellCheck={false}
        placeholder="Paste or type code to analyze…"
        className="scrollbar-thin min-h-64 w-full flex-1 resize-none bg-background p-4 font-mono text-[13px] leading-6 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />
    </div>
  )
}
