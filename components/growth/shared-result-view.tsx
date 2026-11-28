import type { SharedResult } from "@/lib/growth/share"

/** Plain, server-rendered view of a shared result. All text is escaped by React; no HTML is ever injected. */
export function SharedResultView({ r }: { r: SharedResult }) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  )
  const list = (a: string[]) => <ul className="list-disc space-y-1 pl-5">{a.map((x, i) => <li key={i}>{x}</li>)}</ul>
  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{r.title}</h1>
      <p className="flex flex-wrap gap-1.5 text-xs">
        {r.language && r.language !== "unknown" && <span className="rounded bg-surface-elevated px-2 py-0.5 font-mono">{r.language}</span>}
        {r.framework && <span className="rounded bg-surface-elevated px-2 py-0.5 font-mono">{r.framework}</span>}
        <span className="rounded bg-surface-elevated px-2 py-0.5 capitalize">Root cause: {r.rootCause.certainty}</span>
        <span className="rounded bg-surface-elevated px-2 py-0.5 capitalize">Confidence: {r.confidence.level}</span>
      </p>
      <Section title="Error summary"><p className="text-foreground">{r.headline}</p>{r.symptoms.length > 0 && list(r.symptoms)}</Section>
      <Section title="Root cause"><p className="text-foreground">{r.rootCause.statement}</p><p>{r.rootCause.explanation}</p></Section>
      {r.evidence && r.evidence.length > 0 && (
        <Section title="Supporting evidence">
          <ul className="space-y-2">{r.evidence.map((e, i) => <li key={i}><code className="block overflow-x-auto rounded bg-background p-2 font-mono text-xs text-foreground">{e.quote}</code><span>{e.note}</span></li>)}</ul>
        </Section>
      )}
      <Section title="Confidence"><p>{r.confidence.reason}</p></Section>
      {r.alternatives.length > 0 && <Section title="Other possible causes">{list(r.alternatives.map((a) => `${a.cause} Check: ${a.check}`))}</Section>}
      {r.fix && (
        <Section title="Recommended fix">
          <p className="text-foreground">{r.fix.summary}</p>
          {list(r.fix.steps)}
          {r.fix.changes.length > 0 && list(r.fix.changes.map((c) => `${c.description} (${c.why})`))}
          {r.fix.correctedCode && <pre tabIndex={0} className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground"><code>{r.fix.correctedCode}</code></pre>}
        </Section>
      )}
      {r.verification.length > 0 && <Section title="Verification steps (for you to run)">{list(r.verification)}</Section>}
      {r.prevention.length > 0 && <Section title="Prevention tips">{list(r.prevention)}</Section>}
    </article>
  )
}
