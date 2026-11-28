import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createLimiter } from "@/lib/growth/rate-limit"
import { runRemote, validateExecRequest } from "@/lib/ide/remote-exec"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const limit = createLimiter(20, 60_000)

/** Forwards C/C++/Java to the isolated execution service. Never executes code in this process. */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Sign in to run C, C++ or Java." }, { status: 401 })
  if (!limit.allow(userId)) return NextResponse.json({ error: "Too many runs. Wait a minute and try again." }, { status: 429 })
  const v = validateExecRequest(await req.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const r = await runRemote(v.value, { url: process.env.EXEC_SERVICE_URL, key: process.env.EXEC_SERVICE_KEY })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r)
}
