import Link from "next/link"
import { Check, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PLANS } from "@/components/pricing/plans"

export function PricingCards() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
      {PLANS.map((plan) => (
        <article
          key={plan.id}
          className={cn(
            "relative flex flex-col rounded-2xl border bg-card p-6 shadow-card",
            plan.highlighted ? "border-brand/50 shadow-glow" : "border-border",
          )}
        >
          {plan.highlighted && (
            <span className="absolute -top-3 left-6 rounded-full bg-brand-gradient px-3 py-1 text-xs font-semibold text-primary-foreground">
              Most complete
            </span>
          )}
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
          <p className="mt-5 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{plan.priceNote}</p>

          <ul className="mt-6 flex-1 space-y-3 text-sm">
            {plan.features.map((f) => (
              <li key={f.text} className="flex items-start gap-2.5">
                {f.included ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                ) : (
                  <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                )}
                <span className={f.included ? "text-foreground/90" : "text-muted-foreground/70"}>
                  {f.text}
                  {!f.included && <span className="sr-only"> (not included)</span>}
                </span>
              </li>
            ))}
          </ul>

          <Button asChild variant={plan.highlighted ? "default" : "outline"} className="mt-8 w-full">
            <Link href={plan.cta.href}>{plan.cta.label}</Link>
          </Button>
        </article>
      ))}
    </div>
  )
}
