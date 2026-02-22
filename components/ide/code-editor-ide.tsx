"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

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

  useEffect(() => {
    setContent(file?.content || "")
    if (file?.name) {
      const ext = file.name.split(".").pop()?.toLowerCase()
      if (ext && languageExtensions[ext]) {
        setLanguage(languageExtensions[ext])
      }
    }
  }, [file])

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    onContentChange(newContent)
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{file.name}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{language}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <textarea
          value={content}
          onChange={handleContentChange}
          className="w-full h-full p-4 bg-background text-foreground font-mono text-sm resize-none focus:outline-none border-none"
          spellCheck="false"
          style={{
            lineHeight: "1.5",
            tabSize: 2,
          }}
        />
      </div>
    </div>
  )
}
