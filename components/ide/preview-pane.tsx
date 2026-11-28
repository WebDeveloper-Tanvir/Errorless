"use client"

import { useState, type RefObject } from "react"
import { Maximize2, Minimize2, RefreshCw, Square, Smartphone, Tablet, Monitor, X } from "lucide-react"
import type { PreviewState } from "./use-ide-runtime"

type Width = "full" | "tablet" | "mobile"
const WIDTHS: Record<Width, string> = { full: "100%", tablet: "768px", mobile: "375px" }

interface Props {
  preview: PreviewState | null
  open: boolean
  running: boolean
  iframeRef: RefObject<HTMLIFrameElement | null>
  onClose: () => void
  onRefresh: () => void
  onStop: () => void
}

/**
 * Browser preview. The iframe is ALWAYS mounted (hidden when the pane is closed) so JavaScript runs
 * can use it without showing it. `sandbox` has no allow-same-origin: the page gets an opaque origin,
 * so it cannot read this app's cookies, storage, tokens or DOM. allow-modals lets alert() work.
 */
export function PreviewPane({ preview, open, running, iframeRef, onClose, onRefresh, onStop }: Props) {
  const [full, setFull] = useState(false)
  const [width, setWidth] = useState<Width>("full")
  const btn = "h-6 w-6 flex items-center justify-center rounded text-[rgba(200,225,255,0.6)] hover:text-[#00CFFF] hover:bg-white/5 disabled:opacity-40"

  return (
    <div
      className={`${open ? "flex" : "hidden"} flex-col min-w-0 ${full ? "fixed inset-0 z-50" : "w-[38%] min-w-[300px] max-w-[640px] shrink-0"}`}
      style={{ background: "#080D18", borderLeft: "1px solid rgba(0,207,255,0.12)" }}
      role="region" aria-label="Browser preview"
    >
      <div className="flex items-center gap-1 px-2 shrink-0" style={{ height: 36, borderBottom: "1px solid rgba(0,207,255,0.1)" }}>
        <span className="text-[11px] font-semibold text-[rgba(200,225,255,0.8)] mr-1">Preview</span>
        <span className="text-[10px] font-mono text-[rgba(200,225,255,0.4)] truncate flex-1">{preview?.label || "—"}</span>
        <button className={btn} title="Full width" aria-label="Full width" onClick={() => setWidth("full")}><Monitor size={13} color={width === "full" ? "#00CFFF" : undefined} /></button>
        <button className={btn} title="Tablet (768px)" aria-label="Tablet width" onClick={() => setWidth("tablet")}><Tablet size={13} color={width === "tablet" ? "#00CFFF" : undefined} /></button>
        <button className={btn} title="Mobile (375px)" aria-label="Mobile width" onClick={() => setWidth("mobile")}><Smartphone size={13} color={width === "mobile" ? "#00CFFF" : undefined} /></button>
        <button className={btn} title="Re-run and refresh" aria-label="Refresh preview" onClick={onRefresh}><RefreshCw size={13} /></button>
        <button className={btn} title="Stop" aria-label="Stop" disabled={!running} onClick={onStop}><Square size={12} /></button>
        <button className={btn} title={full ? "Exit full screen" : "Full screen"} aria-label="Toggle full screen" onClick={() => setFull((f) => !f)}>{full ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>
        <button className={btn} title="Close preview" aria-label="Close preview" onClick={() => { setFull(false); onClose() }}><X size={13} /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto flex justify-center" style={{ background: "#0b1220" }}>
        {!preview?.html && (
          <p className="text-xs text-[rgba(200,225,255,0.35)] mt-10">Run an HTML, CSS or JavaScript file to see it here.</p>
        )}
        <iframe
          ref={iframeRef}
          key={preview?.key ?? 0}
          title="Preview"
          sandbox="allow-scripts allow-modals"
          referrerPolicy="no-referrer"
          srcDoc={preview?.html || ""}
          className="h-full border-0 bg-white"
          style={{ width: WIDTHS[width], maxWidth: "100%", display: preview?.html ? "block" : "none" }}
        />
      </div>
    </div>
  )
}
