import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { JsonLd } from "@/components/seo/json-ld"
import { buildMetadata } from "@/lib/seo/metadata"
import { breadcrumbLd, itemListLd } from "@/lib/seo/jsonld"
import { SHOWCASE, showcasePath } from "@/lib/growth/showcase"

export const metadata: Metadata = buildMetadata({
  title: "Debugging Examples: Learn From Real Root Causes",
  description: "Hand-written debugging walkthroughs from the Errorless team. Each one shows the error, the root cause, the evidence and the smallest safe fix.",
  path: "/community",
})

export default function CommunityPage() {
  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={[breadcrumbLd([{ name: "Home", path: "/" }, { name: "Debugging examples", path: "/community" }]), itemListLd("Debugging examples", SHOWCASE.map((e) => ({ name: e.title, path: showcasePath(e.slug) })))]} />
      <Header />
      <main id="main" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight">Debugging examples</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Educational walkthroughs written by the Errorless team. They show how to go from a confusing symptom to a root cause, with the evidence and a minimal fix.
        </p>
        <p role="note" className="mt-4 max-w-2xl rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          These are hand-written examples, not user submissions and not live AI output. We never publish anyone&apos;s code or debugging sessions automatically.
        </p>
        <h2 className="mt-12 text-2xl font-semibold tracking-tight">All examples</h2>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {SHOWCASE.map((e) => (
            <li key={e.slug} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h3 className="text-lg font-semibold"><Link href={showcasePath(e.slug)} className="hover:text-brand">{e.title}</Link></h3>
              <p className="mt-2 text-sm text-muted-foreground">{e.blurb}</p>
              <p className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="rounded bg-surface-elevated px-2 py-0.5 capitalize">{e.level}</span>
                {e.tags.map((t) => <span key={t} className="rounded bg-surface-elevated px-2 py-0.5">{t}</span>)}
              </p>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  )
}
