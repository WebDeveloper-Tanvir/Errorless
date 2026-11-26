"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Ctrl/⌘ + Enter", action: "Analyze" },
  { keys: "Esc", action: "Cancel a running analysis" },
  { keys: "Alt + V", action: "Paste error from clipboard" },
  { keys: "Alt + E", action: "Load an example" },
  { keys: "Alt + Backspace", action: "Clear everything" },
  { keys: "Alt + /", action: "Show this list" },
]

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work anywhere inside the debug workspace.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{s.action}</dt>
              <dd><kbd className="rounded border border-border bg-surface-elevated px-2 py-0.5 font-mono text-xs text-foreground">{s.keys}</kbd></dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
