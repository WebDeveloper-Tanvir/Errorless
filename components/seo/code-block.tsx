import { cn } from "@/lib/utils"

/** Static, accessible code block. `label` is announced to screen readers and shown above. */
export function CodeBlock({ code, label, tone = "neutral", className }: { code: string; label: string; tone?: "neutral" | "bad" | "good"; className?: string }) {
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption
        className={cn(
          "mb-1 text-xs font-medium uppercase tracking-wide",
          tone === "bad" && "text-rose-300",
          tone === "good" && "text-emerald-300",
          tone === "neutral" && "text-muted-foreground",
        )}
      >
        {label}
      </figcaption>
      <pre
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs leading-5 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <code>{code}</code>
      </pre>
    </figure>
  )
}
