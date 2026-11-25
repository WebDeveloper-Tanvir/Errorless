import { Bot, Code2, History, Gauge, ShieldCheck, Zap } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Reveal } from "@/components/landing/reveal"
import { SectionHeading } from "@/components/landing/section-heading"

const FEATURES: { icon: LucideIcon; title: string; body: string; accent: "brand" | "violet" }[] = [
  {
    icon: Zap,
    title: "Instant static analysis",
    body: "Line-accurate findings with the rule that fired and a suggested fix, computed in your browser as you type.",
    accent: "brand",
  },
  {
    icon: Bot,
    title: "AI error diagnosis",
    body: "Dev Mode reviews your code and returns a summary, complexity, bugs, security and performance notes.",
    accent: "violet",
  },
  {
    icon: ShieldCheck,
    title: "Security review",
    body: "Flags injection risks and unsafe operations such as eval, so they get fixed before they ship.",
    accent: "brand",
  },
  {
    icon: Gauge,
    title: "Optimization",
    body: "Premium rewrites slow or wasteful code and keeps your intent, with the reasoning alongside.",
    accent: "violet",
  },
  {
    icon: Code2,
    title: "A full IDE",
    body: "Monaco editor, file explorer, terminal and an assistant panel, so you can debug where you write.",
    accent: "brand",
  },
  {
    icon: History,
    title: "Session memory",
    body: "Dev Mode remembers your last session: 24 hours on Basic, kept permanently on Premium. Saved in your browser.",
    accent: "violet",
  },
]

export function Features() {
  return (
    <section id="features" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to go from error to fix"
          description="Fast checks while you type, deeper AI review when you need it, and an editor to apply it all."
        />

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, accent }, i) => (
            <li key={title}>
              <Reveal delay={(i % 3) * 0.06} className="h-full">
                <article className="group h-full rounded-2xl border border-border bg-card p-6 shadow-card transition-colors duration-200 hover:border-brand/30">
                  <span
                    className={
                      accent === "brand"
                        ? "inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20"
                        : "inline-flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet-soft ring-1 ring-violet/25"
                    }
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

