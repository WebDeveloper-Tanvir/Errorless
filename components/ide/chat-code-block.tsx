"use client"

import { useEffect, useState } from "react"
import { Check, Copy, FileDiff } from "lucide-react"

/** Syntax colours come from Monaco (already loaded for the editor), so no extra highlighter is shipped. */
function useColorized(code: string, lang: string) {
  const [html, setHtml] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const { loader } = await import("@monaco-editor/react")
        const monaco = await loader.init()
        monaco.editor.setTheme("vs-dark")
        const out = await monaco.editor.colorize(code, lang || "plaintext", { tabSize: 2 })
        if (live) setHtml(out)
      } catch { if (live) setHtml(null) }
    })()
    return () => { live = false }
  }, [code, lang])
  return html
}

interface Props { code: string; lang: string; canApply: boolean; onApply: (code: string) => void }

export function ChatCodeBlock({ code, lang, canApply, onApply }: Props) {
  const [copied, setCopied] = useState(false)
  const html = useColorized(code, lang)
  return (
    <div className="my-2 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(0,207,255,0.15)", background: "#060a14" }}>
      <div className="flex items-center justify-between px-2.5 py-1 text-[10px]" style={{ background: "rgba(0,207,255,0.05)", color: "rgba(200,225,255,0.55)" }}>
        <span className="font-mono uppercase tracking-wider">{lang || "code"}</span>
        <span className="flex items-center gap-1">
          <button className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:text-[#00CFFF]" aria-label="Copy code"
            onClick={() => { void navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>
            {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copied" : "Copy"}
          </button>
          {canApply && (
            <button className="flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold" style={{ color: "#8B5CF6" }} aria-label="Review and apply code" onClick={() => onApply(code)}>
              <FileDiff size={11} /> Apply…
            </button>
          )}
        </span>
      </div>
      {html
        ? <pre className="m-0 p-2.5 overflow-x-auto text-[11.5px] leading-5" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }} dangerouslySetInnerHTML={{ __html: html }} />
        : <pre className="m-0 p-2.5 overflow-x-auto text-[11.5px] leading-5 text-gray-200" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}><code>{code}</code></pre>}
    </div>
  )
}
