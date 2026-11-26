import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { isAdmin, type PaymentRequest } from "@/lib/devmode-plan"

/** Admin only: payments waiting for verification (scans the 500 most recently active users). */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const client = await clerkClient()
  const { data } = await client.users.getUserList({ limit: 500, orderBy: "-updated_at" })

  const pending = data
    .map((u) => ({ u, r: u.privateMetadata?.devmodeRequest as PaymentRequest | undefined }))
    .filter(({ r }) => r?.status === "pending")
    .map(({ u, r }) => ({
      userId: u.id,
      email: u.primaryEmailAddress?.emailAddress ?? "",
      name: [u.firstName, u.lastName].filter(Boolean).join(" "),
      plan: r!.plan,
      utr: r!.utr,
      ts: r!.ts,
    }))
    .sort((a, b) => a.ts - b.ts)

  return NextResponse.json({ pending })
}
