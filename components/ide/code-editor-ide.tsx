"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const Editor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.default), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-muted-foreground">Loading editor...</div>,
})

interface CodeEditorIDEProps {
  file: {
    id: string
    name: string
    content?: string
    language?: string
  } | null
  onContentChange: (content: string) => void
  onClose: () => void
}

const languageExtensions: Record<string, string> = {
  py: "python",
  js: "javascript",
  ts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  java: "java",
  cpp: "cpp",
  c: "c",
  swift: "swift",
  go: "go",
  rs: "rust",
  php: "php",
  rb: "ruby",
  sql: "sql",
  html: "html",
  css: "css",
  json: "json",
  xml: "xml",
  yaml: "yaml",
  md: "markdown",
}

export function CodeEditorIDE({ file, onContentChange, onClose }: CodeEditorIDEProps) {
  const [content, setContent] = useState(file?.content || "")
  const [language, setLanguage] = useState(file?.language || "python")
  const [theme, setTheme] = useState("vs-dark")
  const [fontSize, setFontSize] = useState(14)

  useEffect(() => {
    setContent(file?.content || "")
    if (file?.name) {
      const ext = file.name.split(".").pop()?.toLowerCase()
      if (ext && languageExtensions[ext]) {
        setLanguage(languageExtensions[ext])
      }
    }
  }, [file])

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setTheme(e.matches ? "vs-dark" : "vs")
    }
    handleThemeChange(mediaQuery)
    mediaQuery.addEventListener("change", handleThemeChange)
    return () => mediaQuery.removeEventListener("change", handleThemeChange)
  }, [])

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setContent(value)
        onContentChange(value)
      }
    },
    [onContentChange]
  )

  const handleFontSizeChange = (delta: number) => {
    setFontSize((prev) => Math.max(10, Math.min(32, prev + delta)))
  }

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-muted-foreground">
        <p>Select a file to start editing</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{file.name}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{language}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => handleFontSizeChange(-2)}
              className="px-2 py-1 hover:bg-muted rounded"
              title="Decrease font size"
            >
              −
            </button>
            <span className="w-8 text-center">{fontSize}px</span>
            <button
              onClick={() => handleFontSizeChange(2)}
              className="px-2 py-1 hover:bg-muted rounded"
              title="Increase font size"
            >
              +
            </button>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage={language}
          language={language}
          value={content}
          onChange={handleEditorChange}
          theme={theme}
          options={{
            minimap: { enabled: true },
            fontSize: fontSize,
            fontFamily: "Fira Code, monospace",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            folding: true,
            foldingStrategy: "indentation",
            lineDecorationsWidth: 20,
            lineNumbersMinChars: 3,
            renderLineHighlight: "line",
            roundedSelection: false,
            smoothScrolling: true,
            showUnused: true,
            bracketPairColorization: {
              enabled: true,
            },
          }}
        />
      </div>
    </div>
  )
}
