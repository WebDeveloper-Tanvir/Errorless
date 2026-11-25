import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StartDebuggingButton } from "@/components/landing/start-debugging-button"
import { WorkspacePreview } from "@/components/landing/workspace-preview"

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-mesh">
      <div className="bg-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-violet/30 bg-violet/10 px-3.5 py-1.5 text-xs font-medium text-violet-soft">
            <Sparkles className="size-3.5" aria-hidden />
            AI-powered error diagnosis
          </p>

          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            Stop Fighting Bugs.
            <br />
            <span className="brand-gradient">Start Building.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Paste the code that&apos;s failing. Errorless pinpoints the line, explains the root cause in plain
            language, and hands you the fix, so you spend your time shipping instead of searching.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <StartDebuggingButton className="w-full sm:w-auto" />
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/demo">Explore Demo</Link>
            </Button>
          </div>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl sm:mt-20">
          <div
            className="pointer-events-none absolute -inset-x-6 -top-8 bottom-0 -z-10 rounded-[2rem] bg-gradient-to-b from-brand/10 via-violet/10 to-transparent blur-3xl"
            aria-hidden
          />
          <WorkspacePreview />
          <p className="mt-4 text-center text-xs text-muted-foreground">
            This is the real analyzer running in your browser. Edit the code and the findings update live.
          </p>
        </div>
      </div>
    </section>
  )
}
