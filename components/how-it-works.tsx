import { ClipboardPaste, ScanSearch, Wrench } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Reveal } from "@/components/landing/reveal"
import { SectionHeading } from "@/components/landing/section-heading"

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ClipboardPaste,
    title: "Paste or upload your code",
    body: "Drop in the failing file or snippet. Errorless detects the language from the file name and content.",
  },
  {
    icon: ScanSearch,
    title: "Get the diagnosis",
    body: "See every issue with its line number, the rule behind it and a plain-language explanation of why it matters.",
  },
  {
    icon: Wrench,
    title: "Apply the fix",
    body: "Take the suggested fix, or have Dev Mode generate and optimize the code for you, then keep building.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-y border-border bg-surface/40 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From stack trace to solution in three steps"
          description="No setup, no config files. Start with the code you already have."
        />

        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title}>
              <Reveal delay={i * 0.08} className="h-full">
                <div className="relative h-full rounded-2xl border border-border bg-card p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-mono text-sm text-muted-foreground" aria-hidden>
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">
                    <span className="sr-only">Step {i + 1}: </span>
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
