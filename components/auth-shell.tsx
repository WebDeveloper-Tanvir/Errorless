import type { ReactNode } from "react"
import { Bug, ShieldCheck, Zap } from "lucide-react"
import { Logo } from "@/components/logo"

const POINTS = [
  { icon: Zap, text: "Instant line-by-line analysis in your browser" },
  { icon: Bug, text: "Plain-language explanations with suggested fixes" },
  { icon: ShieldCheck, text: "AI security and performance review in Dev Mode" },
]

/** Split-screen layout shared by the sign-in and sign-up pages. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="bg-mesh relative hidden flex-col justify-between border-r border-border p-12 lg:flex">
        <Logo />
        <div className="max-w-md">
          <p className="text-4xl font-semibold leading-tight tracking-tight">
            Stop Fighting Bugs. <span className="brand-gradient">Start Building.</span>
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/20">
                  <Icon className="size-4" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="font-mono text-xs text-muted-foreground">© {new Date().getFullYear()} Errorless</p>
      </aside>

      <main id="main" className="flex flex-col items-center justify-center gap-8 px-4 py-12">
        <div className="lg:hidden">
          <Logo />
        </div>
        <h1 className="sr-only">{title}</h1>
        {children}
      </main>
    </div>
  )
}
