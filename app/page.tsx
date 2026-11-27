import type { Metadata } from "next"
import { buildMetadata } from "@/lib/seo/metadata"
import { JsonLd } from "@/components/seo/json-ld"
import { organizationLd, softwareLd, websiteLd } from "@/lib/seo/jsonld"
import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { Features } from "@/components/features"
import { HowItWorks } from "@/components/how-it-works"
import { Languages } from "@/components/languages"
import { ToolsStrip } from "@/components/landing/tools-strip"
import { PricingSection } from "@/components/landing/pricing-section"
import { FAQ } from "@/components/faq"
import { CTA } from "@/components/cta"
import { Footer } from "@/components/footer"

export const metadata: Metadata = buildMetadata({
  title: "Errorless: AI Error Debugger That Finds the Root Cause",
  description: "Paste an error or stack trace. Errorless finds the likely root cause, shows the evidence, and suggests the smallest safe fix for Python, JavaScript and more.",
  path: "/",
})

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={[organizationLd(), websiteLd(), softwareLd()]} />
      <Header />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <Languages />
        <ToolsStrip />
        <PricingSection />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
