"use client"

import { useState } from "react"
import Image from "next/image"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface UpiPaymentProps {
  plan: "basic" | "premium"
  planName: string
  amountINR: string
  onSubmitted: () => void
  onBack: () => void
}

/**
 * Pay by scanning the UPI QR, then report the 12-digit transaction ID. The plan is
 * activated only after an admin verifies the payment (see /admin/payments).
 */
export function UpiPayment({ plan, planName, amountINR, onSubmitted, onBack }: UpiPaymentProps) {
  const [utr, setUtr] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/devmode/payment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, utr }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || "Could not submit your payment. Please try again.")
      else onSubmitted()
    } catch {
      setError("Network error. Please try again.")
    }
    setSubmitting(false)
  }

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-brand/30 bg-card p-6 shadow-card sm:p-8">
      <h2 className="text-xl font-semibold">Pay for {planName} with UPI</h2>
      <div className="mt-6 grid gap-8 md:grid-cols-[auto_1fr]">
        <Image
          src="/upi-qr.png"
          alt="UPI QR code for Errorless payments. The payee name and UPI ID are shown in the image."
          width={288}
          height={350}
          className="mx-auto h-auto w-64 rounded-xl border border-border md:w-72"
        />
        <div>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Scan the QR with any UPI app.</li>
            <li>
              Pay exactly <strong className="text-foreground">{amountINR}</strong>.
            </li>
            <li>Copy the 12-digit UPI transaction ID (UTR) from the payment receipt.</li>
            <li>Enter it below. Access starts once your payment is verified.</li>
          </ol>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <label htmlFor="utr" className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              UPI transaction ID (UTR)
            </label>
            <input
              id="utr"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))}
              placeholder="12 digits"
              aria-describedby="utr-error"
              aria-invalid={!!error}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p id="utr-error" role="alert" className="min-h-5 text-sm text-destructive">{error}</p>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={submitting || utr.length !== 12}>
                {submitting ? <><Loader2 className="animate-spin" aria-hidden />Submitting…</> : "I've paid, submit"}
              </Button>
              <Button type="button" variant="ghost" onClick={onBack}>Back to plans</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
