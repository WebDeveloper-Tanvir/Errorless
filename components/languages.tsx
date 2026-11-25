import { SectionHeading } from "@/components/landing/section-heading"
import { Reveal } from "@/components/landing/reveal"

// Languages with a dedicated analyzer in lib/code-analyzer.ts.
const DEEP = ["Python", "JavaScript", "TypeScript", "Java"]
// Detected by file extension (lib/code-analyzer.ts detectLanguage) and covered by AI analysis in Dev Mode.
const DETECTED = ["C", "C++", "C#", "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "HTML", "CSS", "SQL"]

export function Languages() {
  return (
    <section id="languages" className="py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Languages"
          title="Built for the languages you actually write"
          description="Dedicated rules for the most common languages, with detection and AI review for many more."
        />

        <Reveal className="mt-12">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <h3 className="text-sm font-semibold">Deep static analysis</h3>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {DEEP.map((l) => (
                <li
                  key={l}
                  className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-2 font-mono text-sm text-brand"
                >
                  {l}
                </li>
              ))}
            </ul>

            <h3 className="mt-8 text-sm font-semibold">Detected, with AI review in Dev Mode</h3>
            <ul className="mt-4 flex flex-wrap gap-2.5">
              {DETECTED.map((l) => (
                <li key={l} className="rounded-lg border border-border bg-surface px-3.5 py-2 font-mono text-sm text-muted-foreground">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
