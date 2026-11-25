import Link from "next/link"
import { SectionHeading } from "@/components/landing/section-heading"
import { PricingCards } from "@/components/pricing/pricing-cards"

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="Simple pricing, start for free"
          description="Use the editor and IDE for free. Upgrade to Dev Mode when you want AI to do the heavy lifting."
        />
        <div className="mt-14">
          <PricingCards />
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Compare plans in detail on the{" "}
          <Link href="/pricing" className="text-brand underline-offset-4 hover:underline">
            pricing page
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
