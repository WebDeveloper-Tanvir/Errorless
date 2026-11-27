import Link from "next/link"
import { SectionHeading } from "@/components/landing/section-heading"
import { TOOL_PAGES, toolPath } from "@/lib/seo/tools"

/** Home-page links into the public debugging guides (internal linking). */
export function ToolsStrip() {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="debug-by-stack">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Debugging guides"
          title={<span id="debug-by-stack">Debug by stack</span>}
          description="Free guides to the errors developers hit most, each with an explainer that runs in your browser."
        />
        <ul className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOOL_PAGES.map((t) => (
            <li key={t.slug}>
              <Link
                href={toolPath(t.slug)}
                className="flex h-full items-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
