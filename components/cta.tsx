import Link from "next/link"
import { Button } from "@/components/ui/button"
import { StartDebuggingButton } from "@/components/landing/start-debugging-button"

export function CTA() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center shadow-card sm:px-12 sm:py-20">
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_80%_at_20%_0%,rgba(0,207,255,0.14),transparent_70%),radial-gradient(ellipse_60%_80%_at_85%_100%,rgba(139,92,246,0.16),transparent_70%)]"
            aria-hidden
          />
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Your next bug is already <span className="brand-gradient">half-fixed.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            Bring the code that&apos;s failing and get a diagnosis in seconds.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <StartDebuggingButton className="w-full sm:w-auto" />
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
