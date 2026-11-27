import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FAQ } from "@/components/faq"
import { CTA } from "@/components/cta"
import { SectionHeading } from "@/components/landing/section-heading"
import { buildMetadata } from "@/lib/seo/metadata"
import { PricingCards } from "@/components/pricing/pricing-cards"

export const metadata: Metadata = buildMetadata({
  title: "Errorless Pricing: Free Analysis and Dev Mode Plans",
  description: "Start free with static analysis and pattern-based error explanations, or unlock AI debugging, code generation and optimization with a Dev Mode plan.",
  path: "/pricing",
})

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main">
        <section className="bg-mesh pb-20 pt-16 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              as="h1"
              eyebrow="Pricing"
              title="Pick the plan that fits how you debug"
              description="Free static analysis in the editor and IDE. Dev Mode adds AI analysis, generation and optimization."
            />
            <div className="mt-14">
              <h2 className="sr-only">Plans</h2>
              <PricingCards />
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
              Dev Mode plans are paid in INR with any UPI app by scanning a QR code on the Dev Mode page. Access starts once your payment is verified. USD amounts are approximate.
            </p>
          </div>
        </section>
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
