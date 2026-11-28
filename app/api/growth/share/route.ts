import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createShareLink } from "@/lib/growth/claim"
import { createLimiter } from "@/lib/growth/rate-limit"
import { originOf, storeOrResponse } from "@/lib/growth/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const createLimit = createLimiter(10, 60 * 60 * 1000)

/**
 * POST /api/growth/share: create a private-by-default share link.
 * Requires sign-in AND an explicit `consent: true` (the UI sets it only after the owner has seen
 * exactly what will be public and pressed "Create link"). Nothing is public before this call.
 * The token is returned once; only its SHA-256 is stored.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { store, res } = storeOrResponse()
  if (!store) return res

  if (!createLimit.allow(userId)) return NextResponse.json({ error: "Too many links created. Try again later." }, { status: 429 })
  const body = await req.json().catch(() => null)
  const reply = await createShareLink(store, { userId, body, now: Date.now(), origin: originOf(req) })
  return NextResponse.json(reply.body, { status: reply.status, headers: { "Cache-Control": "no-store" } })
}

/** GET /api/growth/share: the caller's own links (metadata only, never the payload or token). */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { store, res } = storeOrResponse()
  if (!store) return res
  return NextResponse.json({ shares: await store.listShares(userId), now: Date.now() }, { headers: { "Cache-Control": "no-store" } })
}

/** DELETE /api/growth/share?id=… revokes one of the caller's links immediately. */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { store, res } = storeOrResponse()
  if (!store) return res
  const id = req.nextUrl.searchParams.get("id") ?? ""
  if (!/^[0-9a-f]{64}$/.test(id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 })
  const ok = await store.revokeShare(id, userId, Date.now())
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Link not found or already revoked." }, { status: 404 })
}
