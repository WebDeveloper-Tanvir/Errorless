/**
 * Plans offered today. Prices and feature flags mirror the checkout in
 * app/devmode/page.tsx (UPI QR checkout). Keep the two in sync when plans change.
 *
 * NOTE: the billing period is intentionally not stated until the product owner
 * decides whether a payment is one-off or recurring (plans currently never expire).
 */
export interface Plan {
  id: "free" | "basic" | "premium"
  name: string
  price: string
  priceNote: string
  description: string
  features: { text: string; included: boolean }[]
  cta: { label: string; href: string }
  highlighted?: boolean
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceNote: "no card needed",
    description: "Instant static analysis in the editor and IDE.",
    features: [
      { text: "Static analysis in your browser", included: true },
      { text: "IDE with Monaco editor and assistant", included: true },
      { text: "AI code analysis (Dev Mode)", included: false },
      { text: "Code generation and optimization", included: false },
    ],
    cta: { label: "Create free account", href: "/sign-up" },
  },
  {
    id: "basic",
    name: "Basic",
    price: "$2.5",
    priceNote: "₹209 · pay with UPI",
    description: "Generate and analyze code. Memory resets every 24 hours.",
    features: [
      { text: "Code generation", included: true },
      { text: "AI code analysis", included: true },
      { text: "24-hour memory", included: true },
      { text: "Code optimization", included: false },
      { text: "Permanent memory", included: false },
    ],
    cta: { label: "Get Basic", href: "/devmode" },
  },
  {
    id: "premium",
    name: "Premium",
    price: "$5",
    priceNote: "₹419 · pay with UPI",
    description: "Full access: generate, analyze, optimize, with permanent memory.",
    features: [
      { text: "Code generation", included: true },
      { text: "AI code analysis", included: true },
      { text: "Code optimization", included: true },
      { text: "Permanent memory saved", included: true },
      { text: "Priority AI processing", included: true },
    ],
    cta: { label: "Get Premium", href: "/devmode" },
    highlighted: true,
  },
]
