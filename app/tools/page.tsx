import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { JsonLd } from "@/components/seo/json-ld"
import { SectionHeading } from "@/components/landing/section-heading"
import { buildMetadata } from "@/lib/seo/metadata"
import { breadcrumbLd, itemListLd } from "@/lib/seo/jsonld"
import { TOOL_PAGES, toolPath } from "@/lib/seo/tools"

export const metadata: Metadata = buildMetadata({
  title: "Error Debugging Guides for Python, JavaScript and More",
  description: "Free guides and an in-browser explainer for common Python, JavaScript, TypeScript, React, Node.js, SQL, API and Docker errors, with causes and minimal fixes.",
  path: "/tools",
})

export default function ToolsHub() {
  return (
    <div className="min-h-screen bg-background">
      <JsonLd
        data={[
          breadcrumbLd([{ name: "Home", path: "/" }, { name: "Debugging tools", path: "/tools" }]),
          itemListLd("Errorless debugging tools", TOOL_PAGES.map((t) => ({ name: t.name, path: toolPath(t.slug) }))),
        ]}
      />
      <Header />
      <main id="main">
        <section className="bg-mesh pb-12 pt-16 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              as="h1"
              eyebrow="Debugging tools"
              title="Find out what your error really means"
              description="Pick your stack, paste the error, and get the cause and the smallest fix. Each guide documents the errors developers hit most and includes an explainer that runs in your browser."
            />
          </div>
        </section>

        <section className="pb-20" aria-labelledby="tools-list">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="tools-list" className="sr-only">All debugging tools</h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {TOOL_PAGES.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={toolPath(t.slug)}
                    className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <h3 className="text-base font-semibold tracking-tight">{t.name}</h3>
                    <ul className="mt-3 flex-1 space-y-1.5 text-sm text-muted-foreground">
                      {t.errors.slice(0, 3).map((e) => (
                        <li key={e.id} className="line-clamp-1">{e.title}</li>
                      ))}
                      <li className="text-xs">and {t.errors.length - 3} more</li>
                    </ul>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">
                      Open guide <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mx-auto mt-12 max-w-2xl text-center text-sm leading-6 text-muted-foreground">
              The explainers match your error against documented patterns and run entirely in your browser. For analysis of your own code with quoted evidence, a confidence level and a minimal fix, see{" "}
              <Link href="/docs#debug-workspace" className="text-brand underline-offset-4 hover:underline">how the AI debug workspace works</Link>{" "}
              or <Link href="/pricing" className="text-brand underline-offset-4 hover:underline">compare plans</Link>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
