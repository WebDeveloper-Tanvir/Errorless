"use client"

import { AlertTriangle } from "lucide-react"
import { DiffView } from "@/components/debug/diff-view"

export interface PendingApply { fileName: string; before: string; after: string; scopeLabel: string; next: string; fileId: string }

/** Shows exactly what would change. Nothing is written until the user confirms. */
export function ApplyFixDialog({ pending, onConfirm, onCancel }: { pending: PendingApply; onConfirm: () => void; onCancel: () => void }) {
  const beforeLines = pending.before.split("\n").length
  const afterLines = pending.after.split("\n").length
  const shrinks = pending.scopeLabel === "whole file" && beforeLines > 8 && afterLines < beforeLines * 0.4
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(3,6,12,0.7)" }} role="dialog" aria-modal="true" aria-label="Review changes">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl overflow-hidden" style={{ background: "#080D18", border: "1px solid rgba(0,207,255,0.25)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(0,207,255,0.12)" }}>
          <h2 className="text-sm font-semibold text-white">Apply to {pending.fileName}?</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(200,225,255,0.55)" }}>This replaces the {pending.scopeLabel}. Review the diff; you can undo with Ctrl+Z in the editor.</p>
        </div>
        {shrinks && (
          <p className="flex items-start gap-2 mx-4 mt-3 text-xs rounded-md p-2" style={{ background: "rgba(255,209,102,0.1)", color: "#ffd166" }}>
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> The new code is much shorter than the current file. If it is only a snippet, applying will remove the rest. Select the part to replace first, or cancel.
          </p>
        )}
        <div className="p-4 overflow-auto min-h-0"><DiffView before={pending.before} after={pending.after} /></div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: "rgba(0,207,255,0.12)" }}>
          <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-md text-gray-300 hover:bg-white/5">Cancel</button>
          <button onClick={onConfirm} className="px-3 py-1.5 text-xs rounded-md font-semibold" style={{ background: "#00CFFF", color: "#080D18" }}>Apply to editor</button>
        </div>
      </div>
    </div>
  )
}
