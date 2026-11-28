import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { CodeBlock } from "@/components/seo/code-block"
import { ResultsPanel } from "@/components/debug/results-panel"
import { buildMetadata } from "@/lib/seo/metadata"
import { breadcrumbLd, showcaseLd } from "@/lib/seo/jsonld"
import { CONTENT_UPDATED } from "@/lib/seo/site"
import { getTool, toolPath } from "@/lib/seo/tools"
import { SHOWCASE, getShowcase, showcaseMeta, showcasePath } from "@/lib/growth/showcase"

export const dynamicParams = false
export const generateStaticParams = () => SHOWCASE.map((e) => ({ slug: e.slug }))

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = getShowcase((await params).slug)
  if (!e) return {}
  return buildMetadata({ ...showcaseMeta(e), path: showcasePath(e.slug), type: "article" })
}

export default async function ShowcaseEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const e = getShowcase((await params).slug)
  if (!e) notFound()
  const meta = showcaseMeta(e)
  const tool = getTool(e.toolSlug)
  const others = SHOWCASE.filter((x) => x.slug !== e.slug).slice(0, 3)

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={[
        showcaseLd({ ...meta, path: showcasePath(e.slug), language: e.language, updated: CONTENT_UPDATED }),
        breadcrumbLd([{ name: "Home", path: "/" }, { name: "Debugging examples", path: "/community" }, { name: e.title, path: showcasePath(e.slug) }]),
      ]} />
      <Header />
      <main id="main" className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <Link href="/community" className="hover:text-foreground">Debugging examples</Link><ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span aria-current="page" className="text-foreground">{e.title}</span>
        </nav>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{e.title}</h1>
        <p className="mt-3 text-muted-foreground">{e.blurb}</p>
        <p role="note" className="mt-4 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          Hand-written example by the Errorless team. It was not generated live and nothing was executed.
        </p>

        <h2 className="mt-10 text-2xl font-semibold tracking-tight">The problem</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CodeBlock label="Error or symptom" code={e.error} tone="bad" />
          <CodeBlock label={`Code (${e.codeFile})`} code={e.code} />
        </div>

        <h2 className="mt-12 text-2xl font-semibold tracking-tight">The debugging result</h2>
        <div className="mt-4">
          <ResultsPanel result={e.result} partial={null} originalCode={e.code} language={e.language} framework={e.framework} streaming={false} readOnly feedbackSurface="community_example" />
        </div>

        <h2 className="mt-12 text-2xl font-semibold tracking-tight">What to remember</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">{e.lesson.map((l) => <li key={l}>{l}</li>)}</ul>

        <h2 className="mt-12 text-2xl font-semibold tracking-tight">Keep learning</h2>
        <ul className="mt-4 space-y-2">
          {tool && <li><Link href={toolPath(tool.slug)} className="text-brand underline-offset-4 hover:underline">{tool.name}: explain more errors like this</Link></li>}
          {others.map((o) => <li key={o.slug}><Link href={showcasePath(o.slug)} className="text-brand underline-offset-4 hover:underline">{o.title}</Link></li>)}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild><Link href="/sign-up?redirect_url=%2Fdevmode">Debug your own error</Link></Button>
          <Button asChild variant="outline"><Link href="/demo">Try the free demo</Link></Button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
