import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { CodeBlock } from "@/components/seo/code-block"
import { ErrorDemo } from "@/components/seo/error-demo"
import { buildMetadata } from "@/lib/seo/metadata"
import { breadcrumbLd, faqLd, toolPageLd } from "@/lib/seo/jsonld"
import { describeError } from "@/lib/seo/match-error"
import { TOOL_PAGES, getTool, toolPath } from "@/lib/seo/tools"

export const dynamicParams = false

export function generateStaticParams() {
  return TOOL_PAGES.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tool = getTool((await params).slug)
  if (!tool) return {}
  return buildMetadata({ title: tool.metaTitle, description: tool.metaDescription, path: toolPath(tool.slug), routeOwnsImage: true })
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const tool = getTool((await params).slug)
  if (!tool) notFound()
  const related = tool.related.map((s) => getTool(s)).filter((t): t is NonNullable<typeof t> => !!t)

  return (
    <div className="min-h-screen bg-background">
      <JsonLd
        data={[
          toolPageLd(tool),
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Debugging tools", path: "/tools" }, { name: tool.name, path: toolPath(tool.slug) }]),
          faqLd(tool.faqs),
        ]}
      />
      <Header />
      <main id="main">
        <article>
          <header className="bg-mesh pb-10 pt-12 sm:pt-16">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
                <ol className="flex flex-wrap items-center gap-1">
                  <li><Link href="/" className="hover:text-foreground">Home</Link></li>
                  <li aria-hidden><ChevronRight className="size-3.5" /></li>
                  <li><Link href="/tools" className="hover:text-foreground">Debugging tools</Link></li>
                  <li aria-hidden><ChevronRight className="size-3.5" /></li>
                  <li aria-current="page" className="text-foreground">{tool.navLabel}</li>
                </ol>
              </nav>
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{tool.name}</h1>
              {tool.intro.map((p, i) => (
                <p key={i} className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">{p}</p>
              ))}
              <p className="mt-4 text-xs text-muted-foreground">Updated {tool.updated}. {tool.errors.length} errors documented.</p>
            </div>
          </header>

          <div className="mx-auto max-w-4xl space-y-16 px-4 pb-20 sm:px-6 lg:px-8">
            <section aria-labelledby="try" className="scroll-mt-24">
              <h2 id="try" className="mb-4 text-2xl font-semibold tracking-tight">Paste your {tool.navLabel} error</h2>
              <ErrorDemo
                slug={tool.slug}
                label={tool.navLabel}
                errors={tool.errors}
                demoError={tool.demoError}
                demoCode={tool.demoCode}
                analyzerExt={tool.analyzerExt}
                debugLanguage={tool.debugLanguage}
                debugFramework={tool.debugFramework}
              />
            </section>

            <section aria-labelledby="approach">
              <h2 id="approach" className="mb-6 text-2xl font-semibold tracking-tight">How to approach {tool.navLabel} errors</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {tool.approach.map((a) => (
                  <div key={a.title} className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="text-base font-semibold">{a.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{a.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="errors">
              <h2 id="errors" className="mb-6 text-2xl font-semibold tracking-tight">Common {tool.navLabel} errors and how to fix them</h2>
              <div className="space-y-8">
                {tool.errors.map((e) => {
                  const d = describeError(e)
                  return (
                  <section key={e.id} id={`err-${e.id}`} aria-labelledby={`h-${e.id}`} className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <h3 id={`h-${e.id}`} className="text-lg font-semibold tracking-tight">{e.title}</h3>
                    <CodeBlock className="mt-3" code={e.example} label="What you see" />
                    <p className="mt-4 text-sm leading-6"><span className="font-medium">Why it happens. </span><span className="text-muted-foreground">{d.why}</span></p>
                    <p className="mt-2 text-sm leading-6"><span className="font-medium">How to fix it. </span><span className="text-muted-foreground">{d.fix}</span></p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <CodeBlock code={e.before} label="Before" tone="bad" />
                      <CodeBlock code={e.after} label="After" tone="good" />
                    </div>
                  </section>
                  )
                })}
              </div>
            </section>

            <section aria-labelledby="checklist">
              <h2 id="checklist" className="mb-4 text-2xl font-semibold tracking-tight">A {tool.navLabel} debugging checklist</h2>
              <ol className="list-decimal space-y-2 pl-6 text-sm leading-6 text-muted-foreground marker:text-brand">
                {tool.checklist.map((c) => <li key={c}>{c}</li>)}
              </ol>
            </section>

            <section aria-labelledby="faq">
              <h2 id="faq" className="mb-4 text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
              <dl className="space-y-5">
                {tool.faqs.map((f) => (
                  <div key={f.q}>
                    <dt className="text-base font-semibold">{f.q}</dt>
                    <dd className="mt-1 text-sm leading-6 text-muted-foreground">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="more" className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <h2 id="more" className="text-xl font-semibold tracking-tight">Debug your own code</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                The explainer above recognises known error patterns. Dev Mode analyses your actual error and code: it quotes the evidence it relies on, states how confident it is, suggests the smallest fix and never changes your files. It needs a Dev Mode plan.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild variant="gradient"><Link href="/sign-up?redirect_url=%2Fdevmode">Create a free account</Link></Button>
                <Button asChild variant="outline"><Link href="/pricing">See plans</Link></Button>
                <Button asChild variant="ghost"><Link href="/docs#debug-workspace">How it works</Link></Button>
              </div>
            </section>

            <nav aria-labelledby="related">
              <h2 id="related" className="mb-4 text-xl font-semibold tracking-tight">More error guides</h2>
              <ul className="flex flex-wrap gap-3">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link href={toolPath(r.slug)} className="inline-flex rounded-lg border border-border px-3 py-2 text-sm hover:border-brand/40 hover:text-brand">{r.name}</Link>
                  </li>
                ))}
                <li><Link href="/tools" className="inline-flex rounded-lg border border-border px-3 py-2 text-sm hover:border-brand/40 hover:text-brand">All debugging tools</Link></li>
              </ul>
            </nav>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  )
}
