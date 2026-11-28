"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  Trash2, Copy, AlertCircle, AlertTriangle, Terminal as TerminalIcon, Bug, MonitorDot, ChevronDown, ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { terminalText, type EventKind, type RunProblem, type RuntimeEvent } from "@/lib/ide/events"

export type PanelTab = "problems" | "output" | "debug" | "terminal"

interface BottomPanelProps {
  events: RuntimeEvent[]
  problems: RunProblem[]
  running: boolean
  onCommand: (cmd: string, clearTerminal: () => void) => void
  onClearProblems: () => void
}

const COLORS: Record<EventKind, string> = {
  command: "text-[#00CFFF]",
  system: "text-sky-300",
  stdout: "text-gray-200",
  stderr: "text-red-400",
  warn: "text-yellow-400",
  success: "text-green-400",
  error: "text-red-400",
}

const TABS: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
  { id: "problems", label: "Problems", icon: <AlertCircle size={13} /> },
  { id: "output", label: "Output", icon: <MonitorDot size={13} /> },
  { id: "debug", label: "Debug Console", icon: <Bug size={13} /> },
  { id: "terminal", label: "Terminal", icon: <TerminalIcon size={13} /> },
]

const clock = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour12: false })

/** Bottom dock. It only DISPLAYS the run log owned by useIdeRuntime; it executes nothing itself. */
export function BottomPanel({ events, problems, running, onCommand, onClearProblems }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("terminal")
  const [collapsed, setCollapsed] = useState(false)
  const [height, setHeight] = useState(220)
  const [termInput, setTermInput] = useState("")
  // "Clear" hides everything up to the newest event of that tab; the log itself is shared.
  const [clearedUpTo, setClearedUpTo] = useState<Record<PanelTab, number>>({ problems: 0, output: 0, debug: 0, terminal: 0 })
  const scroller = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)
  const lastId = events.length ? events[events.length - 1].id : 0

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) setHeight(Math.max(120, Math.min(640, dragStartH.current + dragStartY.current - e.clientY))) }
    const onUp = () => { dragging.current = false }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
  }, [])

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight }, [events, activeTab])

  const visible = (tab: PanelTab) => events.filter((e) => e.id > clearedUpTo[tab] && (tab !== "output" || e.kind !== "command"))
  const clearTab = (tab: PanelTab) => { if (tab === "problems") onClearProblems(); else setClearedUpTo((c) => ({ ...c, [tab]: lastId })) }
  const errorCount = problems.filter((p) => p.severity === "error").length
  const warnCount = problems.filter((p) => p.severity === "warning").length

  const lines = activeTab === "problems" ? [] : visible(activeTab)
  const lineText = (e: RuntimeEvent) => (activeTab === "debug" ? `[${clock(e.at)}] ${e.kind.padEnd(7)} ${e.text}` : terminalText(e))

  return (
    <div className="relative flex flex-col border-t shrink-0" style={{ height: collapsed ? 36 : height, background: "#080D18", borderColor: "rgba(0,207,255,0.12)" }}>
      {!collapsed && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-row-resize z-10 hover:bg-[#00CFFF]/30 transition-colors"
          onMouseDown={(e) => { dragging.current = true; dragStartY.current = e.clientY; dragStartH.current = height; e.preventDefault() }}
        />
      )}

      <div className="flex items-center justify-between px-1 border-b shrink-0 select-none" style={{ height: 36, borderColor: "rgba(0,207,255,0.1)" }}>
        <div className="flex items-center h-full overflow-x-auto" role="tablist">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id} role="tab" aria-selected={activeTab === id}
              onClick={() => { setActiveTab(id); if (collapsed) setCollapsed(false) }}
              className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === id && !collapsed ? "border-[#00CFFF] text-white" : "border-transparent text-[rgba(200,225,255,0.5)] hover:text-white"}`}
            >
              {icon}{label}
              {id === "problems" && errorCount + warnCount > 0 && (
                <span className="flex items-center gap-0.5 ml-1">
                  {errorCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1 min-w-[16px] text-center rounded-sm">{errorCount}</span>}
                  {warnCount > 0 && <span className="bg-yellow-500 text-black text-[10px] px-1 min-w-[16px] text-center rounded-sm">{warnCount}</span>}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {running && <span className="text-[10px] text-[#00CFFF] animate-pulse mr-1">Running…</span>}
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Clear" aria-label="Clear" onClick={() => clearTab(activeTab)}><Trash2 size={12} /></Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Copy" aria-label="Copy"
            onClick={() => { const t = activeTab === "problems" ? problems.map((p) => `${p.file}:${p.line} ${p.message}`).join("\n") : lines.map(lineText).join("\n"); if (t) void navigator.clipboard.writeText(t) }}>
            <Copy size={12} />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" aria-label={collapsed ? "Expand panel" : "Collapse panel"} onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </Button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-hidden min-h-0">
          {activeTab === "problems" && (
            <div className="h-full overflow-y-auto text-xs">
              {problems.length === 0 ? (
                <p className="text-[rgba(200,225,255,0.5)] p-3 font-mono">No problems from the last run.</p>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 z-10" style={{ background: "#0b1220" }}>
                    <tr className="text-[rgba(200,225,255,0.5)] border-b" style={{ borderColor: "rgba(0,207,255,0.1)" }}>
                      <th className="w-6 py-1.5 px-2" /><th className="text-left py-1.5 px-2 font-normal">Message</th>
                      <th className="text-left py-1.5 px-2 font-normal w-32">File</th><th className="text-left py-1.5 px-2 font-normal w-16">Line</th>
                      <th className="text-left py-1.5 px-2 font-normal w-24">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {problems.map((p) => (
                      <tr key={p.id} className="border-b font-mono" style={{ borderColor: "rgba(0,207,255,0.06)" }}>
                        <td className="py-1 px-2">{p.severity === "error" ? <AlertCircle size={13} className="text-red-500" /> : <AlertTriangle size={13} className="text-yellow-500" />}</td>
                        <td className="py-1 px-2 text-gray-200 whitespace-pre-wrap break-words">{p.message}</td>
                        <td className="py-1 px-2 text-[rgba(200,225,255,0.5)] truncate max-w-[8rem]">{p.file}</td>
                        <td className="py-1 px-2 text-[rgba(200,225,255,0.5)]">{p.line > 0 ? `${p.line}${p.column ? ":" + p.column : ""}` : "—"}</td>
                        <td className="py-1 px-2 text-[rgba(200,225,255,0.5)]">{p.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab !== "problems" && (
            <div className="h-full flex flex-col">
              <div ref={scroller} data-testid="log" className="flex-1 overflow-y-auto p-3 font-mono text-xs" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }} aria-live="polite">
                {lines.length === 0 && (
                  <p className="text-[rgba(200,225,255,0.4)]">
                    {activeTab === "terminal" ? "Ready. Press Run, or type help." : "Nothing here yet. Run a file to see its output."}
                  </p>
                )}
                {lines.map((e) => (
                  <div key={e.id} className={`whitespace-pre-wrap break-all leading-5 ${COLORS[e.kind]}`}>{lineText(e) || " "}</div>
                ))}
              </div>
              {activeTab === "terminal" && (
                <div className="border-t flex items-center px-3 py-1.5 gap-2 shrink-0" style={{ borderColor: "rgba(0,207,255,0.1)" }}>
                  <span className="text-[#00CFFF] text-xs font-mono">$</span>
                  <input
                    type="text" value={termInput} aria-label="Terminal command"
                    onChange={(e) => setTermInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return
                      const c = termInput; setTermInput("")
                      onCommand(c, () => clearTab("terminal"))
                    }}
                    placeholder="help · run <file> · clear"
                    className="flex-1 bg-transparent text-xs font-mono outline-none text-gray-200 placeholder:text-gray-600"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
