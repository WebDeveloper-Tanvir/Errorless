import { NextRequest, NextResponse } from "next/server"
import { FEEDBACK } from "@/lib/growth/config"
import { createLimiter } from "@/lib/growth/rate-limit"
import { redactSecrets } from "@/lib/debug/redact"
import { clientKey, storeOrResponse } from "@/lib/growth/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SURFACES = ["guest_demo", "shared_result", "community_example", "tool_page"] as const
const limit = createLimiter(10, 60 * 60 * 1000)

/**
 * POST: helpful / not helpful plus an optional comment, from visitors who may not be signed in
 * (guest demo, shared results, showcase). No account, IP or page content is stored. The caller's IP
 * is only hashed into an in-memory rate-limit key. Signed-in Dev Mode ratings use /api/devmode/debug/feedback.
 */
export async function POST(req: NextRequest) {
  const { store, res } = storeOrResponse()
  if (!store) return res
  const b = await req.json().catch(() => null)
  if (typeof b?.helpful !== "boolean") return NextResponse.json({ error: "helpful must be true or false." }, { status: 400 })
  if (!(SURFACES as readonly string[]).includes(b?.surface)) return NextResponse.json({ error: "Unknown surface." }, { status: 400 })
  if (!limit.allow(await clientKey(req))) return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 })
  const comment = typeof b.comment === "string" ? redactSecrets(b.comment.trim().slice(0, FEEDBACK.maxComment)).text : ""
  await store.addFeedback({ surface: b.surface, helpful: b.helpful, comment: comment || undefined })
  return NextResponse.json({ ok: true })
}
