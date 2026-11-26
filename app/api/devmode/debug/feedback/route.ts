import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { LIMITS } from "@/lib/debug/types"

/**
 * POST /api/devmode/debug/feedback — "Was this helpful?".
 * Stores the last 20 ratings on the user's private Clerk metadata (never the code or error text),
 * so there is no extra database to run. Admins can read it in the Clerk dashboard.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const b = await req.json().catch(() => null)
  if (typeof b?.helpful !== "boolean") return NextResponse.json({ error: "helpful must be true or false." }, { status: 400 })
  const pick = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "")

  const entry = {
    ts: Date.now(),
    helpful: b.helpful,
    certainty: pick(b.certainty, 12),
    language: pick(b.language, 40),
    framework: pick(b.framework, 40),
    comment: pick(b.comment, LIMITS.comment),
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const prev = Array.isArray(user.privateMetadata?.debugFeedback) ? (user.privateMetadata.debugFeedback as unknown[]) : []
  await client.users.updateUserMetadata(userId, { privateMetadata: { debugFeedback: [...prev, entry].slice(-20) } })
  return NextResponse.json({ ok: true })
}
