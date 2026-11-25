import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { getDevmodePlan, type PaymentRequest } from "@/lib/devmode-plan"

/** Current plan plus the state of any payment the user submitted. */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const plan = await getDevmodePlan(userId)
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const req = user.privateMetadata?.devmodeRequest as PaymentRequest | undefined

  return NextResponse.json({
    plan,
    request: req ? { plan: req.plan, status: req.status, ts: req.ts } : null,
  })
}
