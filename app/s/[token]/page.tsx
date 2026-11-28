import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { FeedbackWidget } from "@/components/growth/feedback-widget"
import { SharedResultView } from "@/components/growth/shared-result-view"
import { readShare } from "@/lib/growth/claim"
import { hashToken, isShareToken } from "@/lib/growth/share"
import { getStore } from "@/lib/growth/store"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Shared debugging result | Errorless",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
}

/** Unknown, malformed, expired and revoked links all render the same 404, so nothing can be probed. */
export default async function SharedResultPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const store = getStore()
  if (!store || !isShareToken(token)) notFound()
  const hash = await hashToken(token)
  const rec = await readShare(store, hash, Date.now())
  if (!rec) notFound()
  await store.incrementViews(hash)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="mx-auto max-w-4xl space-y-6 px-4 py-12 sm:px-6">
        <p role="note" className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          A debugging result shared by an Errorless user. It was produced by AI analysis and has not been verified by running any code. Expires {new Date(rec.expiresAt).toLocaleDateString("en-US", { dateStyle: "medium" })}.
        </p>
        <SharedResultView r={rec.payload} />
        <FeedbackWidget surface="shared_result" />
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Have an error of your own? Try the free demo first, no account needed.</p>
          <Button asChild variant="outline"><Link href="/demo">Free demo</Link></Button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
