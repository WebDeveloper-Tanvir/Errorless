"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"

interface Pending {
  userId: string
  email: string
  name: string
  plan: "basic" | "premium"
  utr: string
  ts: number
}

const AMOUNT = { basic: "₹209", premium: "₹419" } as const

/** Admin only. Match each UTR and amount against your bank / UPI app history, then approve. */
export default function AdminPaymentsPage() {
  const [items, setItems] = useState<Pending[] | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError("")
    const res = await fetch("/api/devmode/payment/pending")
    if (res.status === 403) return setError("You don't have access to this page.")
    if (!res.ok) return setError("Could not load payments.")
    setItems((await res.json()).pending)
  }, [])

  useEffect(() => { load() }, [load])

  const review = async (targetUserId: string, action: "approve" | "reject") => {
    setBusy(targetUserId)
    const res = await fetch("/api/devmode/payment/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId, action }),
    })
    setBusy(null)
    if (!res.ok) setError("Action failed. Refresh and try again.")
    else await load()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Payment verification</h1>
        <p className="mt-2 text-muted-foreground">
          Check each transaction ID and amount in your UPI app, then approve to activate the plan.
        </p>

        <p role="alert" className="mt-6 min-h-5 text-sm text-destructive">{error}</p>

        {items === null && !error ? (
          <div role="status" className="mt-8 flex justify-center"><Loader2 className="size-6 animate-spin text-brand" aria-hidden /><span className="sr-only">Loading</span></div>
        ) : items && items.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">No payments waiting for verification.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {items?.map((p) => (
              <li key={p.userId} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{p.name || p.email}</p>
                    {p.name && <p className="text-muted-foreground">{p.email}</p>}
                    <p className="mt-2 capitalize">{p.plan} · expected <strong>{AMOUNT[p.plan]}</strong></p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">UTR {p.utr} · {new Date(p.ts).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy === p.userId} onClick={() => review(p.userId, "approve")}>Approve</Button>
                    <Button size="sm" variant="outline" disabled={busy === p.userId} onClick={() => review(p.userId, "reject")}>Reject</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
