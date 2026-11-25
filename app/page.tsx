import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { Features } from "@/components/features"
import { HowItWorks } from "@/components/how-it-works"
import { Languages } from "@/components/languages"
import { PricingSection } from "@/components/landing/pricing-section"
import { FAQ } from "@/components/faq"
import { CTA } from "@/components/cta"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main">
        <Hero />
        <Features />
        <HowItWorks />
        <Languages />
        <PricingSection />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
