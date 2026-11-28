import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDevmodePlan } from "@/lib/devmode-plan"
import { createLimiter } from "@/lib/growth/rate-limit"
import { parseChatRequest } from "@/lib/ide/ai/validate"
import { chatEvents } from "@/lib/ide/ai/chat-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const perMinute = createLimiter(8, 60_000)
const DAILY = Math.max(1, Number(process.env.IDE_AI_DAILY_LIMIT) || 100)
const perDay = createLimiter(DAILY, 24 * 60 * 60 * 1000)

/**
 * POST /api/ide/chat — cloud AI for the IDE assistant, streamed as SSE (meta → delta* → done | error).
 * Signed-in, Dev Mode plan only: free accounts use the local in-browser model. The provider key lives only
 * in this server's environment. Limits are per server instance (best-effort brakes, not a shared quota).
 * Request content is never logged.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Sign in to use cloud AI." }, { status: 401 })
  if ((await getDevmodePlan(userId)) === "none") {
    return NextResponse.json({ error: "Cloud AI is part of Dev Mode plans. The local in-browser model is free and needs no account.", upgrade: true }, { status: 402 })
  }
  if (!perMinute.allow(userId)) return NextResponse.json({ error: "Too many requests. Wait a minute and retry." }, { status: 429 })
  if (!perDay.allow(userId)) return NextResponse.json({ error: `Daily cloud AI limit reached (${DAILY} requests). Use the local model or try tomorrow.` }, { status: 429 })

  const v = parseChatRequest(await req.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Cloud AI is not configured on this server (GEMINI_API_KEY is missing).", code: "ai_not_configured" }, { status: 503 })
  }

  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(55_000)])
  const enc = new TextEncoder()
  const events = chatEvents(v.value.messages, { apiKey, model: process.env.GEMINI_MODEL || undefined, baseUrl: process.env.GEMINI_API_BASE || undefined }, signal)
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await events.next()
      if (done) controller.close()
      else controller.enqueue(enc.encode(value))
    },
    async cancel() { await events.return(undefined) },
  })
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  })
}
