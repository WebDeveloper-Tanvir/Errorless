"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

const Monaco = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false })

interface Props {
  value: string
  onChange: (v: string) => void
  language: string
  maxLength: number
  label: string
  height?: number
}

/**
 * Monaco editor with a plain textarea fallback. Monaco's loader fetches its
 * runtime from a CDN, so if it has not become ready after a few seconds
 * (offline, blocked network) the textarea takes over and nothing is lost.
 */
export function CodeInput({ value, onChange, language, maxLength, label, height = 280 }: Props) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // Surface a failed CDN load immediately instead of leaving an unhandled rejection.
    import("@monaco-editor/react")
      .then((m) => m.loader.init())
      .catch(() => setFailed(true))
  }, [])

  useEffect(() => {
    if (ready) return
    const t = setTimeout(() => setFailed(true), 8000)
    return () => clearTimeout(t)
  }, [ready])

  if (failed && !ready) {
    return (
      <textarea
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        spellCheck={false}
        style={{ height }}
        placeholder="Paste the code that produces the error…"
        className="w-full resize-y rounded-lg border border-border bg-background p-3 font-mono text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      />
    )
  }

  return (
    <div
      role="group"
      aria-label={label}
      style={{ height }}
      className="relative overflow-hidden rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-primary/60"
    >
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading editor…
        </div>
      )}
      <Monaco
        height="100%"
        language={language}
        value={value}
        theme="vs-dark"
        onChange={(v) => onChange((v ?? "").slice(0, maxLength))}
        onMount={() => setReady(true)}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "var(--font-mono), JetBrains Mono, monospace",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          automaticLayout: true,
          padding: { top: 10, bottom: 10 },
          lineNumbersMinChars: 3,
          tabSize: 2,
          ariaLabel: label,
        }}
      />
    </div>
  )
}
