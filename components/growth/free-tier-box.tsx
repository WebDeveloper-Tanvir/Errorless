import Link from "next/link"
import { FREE_TIER } from "@/lib/growth/config"

/** One honest statement of what is free. Reads lib/growth/config.ts so the page can't drift from the server. */
export function FreeTierBox({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="free-tier-h" className={`rounded-2xl border border-border bg-card p-6 shadow-card ${className}`}>
      <h2 id="free-tier-h" className="text-lg font-semibold">What&apos;s free, and what isn&apos;t</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {FREE_TIER.includes.map((i) => <li key={i}>{i}</li>)}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">{FREE_TIER.aiAccess}</p>
      <p className="mt-2 text-sm text-muted-foreground">{FREE_TIER.sharing}</p>
      <p className="mt-3 text-sm"><Link href="/pricing" className="text-brand underline-offset-4 hover:underline">See plans and prices</Link></p>
    </section>
  )
}
