import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Documentation | Errorless",
  description: "How Errorless analyzes your code, what each workspace does and how your code is handled.",
}

const SECTIONS = [
  { id: "overview", title: "Overview" },
  { id: "static-analysis", title: "Static analysis" },
  { id: "dev-mode", title: "Dev Mode (AI)" },
  { id: "debug-workspace", title: "AI debug workspace" },
  { id: "ide", title: "IDE and editor" },
  { id: "languages", title: "Supported languages" },
  { id: "data", title: "How your code is handled" },
] as const

const RULES: { lang: string; rules: string }[] = [
  { lang: "Python", rules: "bare-except, mutable-default, none-comparison, missing-colon, print-statement, unused-var, division" },
  { lang: "JavaScript / TypeScript", rules: "no-var, eqeqeq, no-eval, require-await, unhandled-promise, infinite-loop, empty-catch, null-check, no-console, semi; TypeScript adds no-explicit-any and non-null-assertion" },
  { lang: "Java", rules: "empty-catch, no-sysout" },
  { lang: "Any language", rules: "line-length, trailing-whitespace, tabs; HTML adds doctype, charset and img-alt" },
]

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-2xl font-semibold tracking-tight">
      {children}
    </h2>
  )
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[14rem_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="Documentation sections">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">On this page</p>
              <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible">
                {SECTIONS.map((s) => (
                  <li key={s.id} className="shrink-0">
                    <a
                      href={`#${s.id}`}
                      className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="min-w-0 max-w-3xl space-y-14 text-[15px] leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-white/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground">
            <header>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-brand">Documentation</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">Using Errorless</h1>
              <p className="mt-4 text-lg">
                Errorless finds the line behind an error, explains why it matters and suggests a fix. This page covers
                what each part of the product does.
              </p>
            </header>

            <section className="space-y-4">
              <H2 id="overview">Overview</H2>
              <p>
                There are two layers. <strong>Static analysis</strong> is instant, free and runs in your browser.{" "}
                <strong>Dev Mode</strong> sends your code to an AI model for deeper review, code generation and
                optimization. Try the static layer without an account on the{" "}
                <Link href="/demo" className="text-brand underline-offset-4 hover:underline">demo page</Link>.
              </p>
            </section>

            <section className="space-y-4">
              <H2 id="static-analysis">Static analysis</H2>
              <p>
                Every finding has a severity (error, warning or suggestion), a line number, the rule that fired and,
                where possible, a suggested fix. Each file also gets a 0–100 quality score. Examples of the rules:
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-elevated text-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Language</th>
                      <th scope="col" className="px-4 py-3 font-medium">Rules</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {RULES.map((r) => (
                      <tr key={r.lang}>
                        <th scope="row" className="whitespace-nowrap px-4 py-3 align-top font-medium text-foreground">{r.lang}</th>
                        <td className="min-w-64 px-4 py-3 font-mono text-xs">{r.rules}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-4">
              <H2 id="dev-mode">Dev Mode (AI)</H2>
              <p>Dev Mode has four tools, all in one workspace:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Debug</strong>: paste an error and get a root cause, evidence and a minimal fix (see below).</li>
                <li><strong>Analyze</strong>: upload or paste code and get a summary, complexity, issues, security, performance and suggestions.</li>
                <li><strong>Generate</strong>: describe what you need and pick a language.</li>
                <li><strong>Optimize</strong>: rewrite code for better performance (Premium).</li>
              </ul>
              <p>
                Basic includes generate and analyze with 24-hour memory. Premium adds optimize, permanent memory and
                priority processing. See <Link href="/pricing" className="text-brand underline-offset-4 hover:underline">pricing</Link>.
              </p>
            </section>

            <section className="space-y-4">
              <H2 id="debug-workspace">AI debug workspace</H2>
              <p>
                Paste an error message, optionally add the code and context, choose a language and framework, then press
                <strong> Analyze error</strong> (<code>Ctrl/⌘ + Enter</code>). You can paste from the clipboard, upload an error log or a code file,
                load an example or clear everything. The answer streams in as it is written.
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Root cause</strong> is labelled Confirmed, Likely or Hypothesis. Confirmed requires evidence found in your input.</li>
                <li><strong>Evidence</strong> quotes your error or code. Quotes that cannot be found in your input are flagged and shown without a line number.</li>
                <li><strong>Suggested fix</strong> is the smallest change that addresses the cause, with a before/after diff and a Copy fix button. Your code is never changed automatically.</li>
                <li><strong>How to verify</strong> lists commands for you to run. Errorless does not execute code or commands.</li>
                <li><strong>Missing context</strong> lists what to add when the input is not enough to be sure.</li>
              </ul>
              <p>
                Likely secrets (API keys, tokens, private keys, connection strings) are masked before your input is sent to the AI.
                The shortcuts dialog (<code>Alt + /</code>) lists every shortcut. Full details are in <code>docs/DEBUG_WORKSPACE.md</code> in the repository.
              </p>
            </section>

            <section className="space-y-4">
              <H2 id="ide">IDE and editor</H2>
              <p>
                The IDE is a Monaco-based editor with a file explorer, terminal, command palette and an assistant
                panel that can analyze attached files. The standalone editor is a lighter single-file view. Both need a
                free account.
              </p>
            </section>

            <section className="space-y-4">
              <H2 id="languages">Supported languages</H2>
              <p>
                Python, JavaScript, TypeScript and Java have dedicated rules. C, C++, C#, Go, Rust, Ruby, PHP, Swift,
                Kotlin, HTML, CSS and SQL are detected from the file extension and can be reviewed with Dev Mode.
              </p>
            </section>

            <section className="space-y-4">
              <H2 id="data">How your code is handled</H2>
              <ul className="list-disc space-y-2 pl-5">
                <li>Static analysis runs locally in your browser; the code is not sent anywhere.</li>
                <li>Dev Mode sends your code to Google&apos;s Gemini API via Errorless&apos;s servers to produce results.</li>
                <li>Dev Mode session memory is stored in your browser&apos;s local storage.</li>
              </ul>
            </section>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  )
}
