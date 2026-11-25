import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SectionHeadingProps {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: "center" | "left"
  as?: "h1" | "h2"
  className?: string
}

export function SectionHeading({ eyebrow, title, description, align = "center", as: Tag = "h2", className }: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <p className="mb-3 font-mono text-xs font-medium uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      )}
      <Tag className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</Tag>
      {description && <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>}
    </div>
  )
}
