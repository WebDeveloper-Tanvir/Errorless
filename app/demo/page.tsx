import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SectionHeading } from "@/components/landing/section-heading"
import { StartDebuggingButton } from "@/components/landing/start-debugging-button"
import { WorkspacePreview } from "@/components/landing/workspace-preview"
import { SampleSession } from "@/components/growth/sample-session"
import { FreeTierBox } from "@/components/growth/free-tier-box"
import Link from "next/link"

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main">
        <section className="bg-mesh pb-12 pt-16 sm:pt-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              as="h1"
              eyebrow="Free demo, no account"
              title="See a full debugging session"
              description="Pick a sample problem and see the nine-part result Errorless returns: summary, root cause, evidence, confidence, fix, diff, verification and prevention."
            />
            <div className="mt-10">
              <SampleSession />
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight">Check your own code in the browser</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Edit a sample or paste your own over it. The static analyzer is real and runs entirely in your browser; your code is not uploaded.</p>
            <div className="mt-6">
              <WorkspacePreview height={440} />
            </div>
          </div>
        </section>

        <section className="pb-20">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 sm:px-6 md:grid-cols-2 lg:px-8">
            <FreeTierBox />
            <div className="flex flex-col justify-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">Debug your own error</h2>
              <p className="text-sm text-muted-foreground">Paste a real error in Dev Mode for a root-cause analysis. Prefer to learn first? Read the guides.</p>
              <div className="flex flex-wrap gap-3">
                <StartDebuggingButton size="default" />
                <Link href="/tools" className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-surface">Debugging guides</Link>
                <Link href="/community" className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-surface">Community examples</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
