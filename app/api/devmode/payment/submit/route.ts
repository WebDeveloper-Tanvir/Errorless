import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { getDevmodePlan, type PaymentRequest } from "@/lib/devmode-plan"

/** Customer reports a UPI payment. It stays "pending" until an admin approves it. */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const plan = body?.plan
  const utr = String(body?.utr ?? "").replace(/\s/g, "")

  if (plan !== "basic" && plan !== "premium") {
    return NextResponse.json({ error: "Choose a plan." }, { status: 400 })
  }
  if (!/^\d{12}$/.test(utr)) {
    return NextResponse.json(
      { error: "Enter the 12-digit UPI transaction ID (UTR) from your payment app." },
      { status: 400 },
    )
  }

  const current = await getDevmodePlan(userId)
  if (current === "premium" || current === plan) {
    return NextResponse.json({ error: "You already have this plan." }, { status: 409 })
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const existing = user.privateMetadata?.devmodeRequest as PaymentRequest | undefined
  if (existing?.status === "pending") {
    return NextResponse.json({ error: "A payment is already awaiting verification." }, { status: 409 })
  }

  const request: PaymentRequest = { plan, utr, ts: Date.now(), status: "pending" }
  await client.users.updateUserMetadata(userId, { privateMetadata: { devmodeRequest: request } })
  return NextResponse.json({ ok: true })
}
