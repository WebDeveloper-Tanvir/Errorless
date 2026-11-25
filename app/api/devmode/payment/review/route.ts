import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { isAdmin, type PaymentRequest } from "@/lib/devmode-plan"

/** Admin only: approve (activates the plan) or reject a pending payment. */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { targetUserId, action } = await req.json().catch(() => ({}))
  if (typeof targetUserId !== "string" || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  const client = await clerkClient()
  const target = await client.users.getUser(targetUserId)
  const request = target.privateMetadata?.devmodeRequest as PaymentRequest | undefined
  if (!request || request.status !== "pending") {
    return NextResponse.json({ error: "No pending payment for this user." }, { status: 404 })
  }

  if (action === "approve") {
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: { devmodePlan: request.plan, devmodePlanSince: Date.now() },
      privateMetadata: { devmodeRequest: null },
    })
  } else {
    await client.users.updateUserMetadata(targetUserId, {
      privateMetadata: { devmodeRequest: { ...request, status: "rejected" } },
    })
  }
  return NextResponse.json({ ok: true })
}
