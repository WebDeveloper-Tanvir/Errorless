import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getDevmodePlan } from "@/lib/devmode-plan"
import { runDebug } from "@/lib/debug/engine"
import { encodeSse } from "@/lib/debug/sse"
import { getStore } from "@/lib/growth/store"
import { LIMITS, type DebugRequest } from "@/lib/debug/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * POST /api/devmode/debug — AI debugging analysis, streamed as Server-Sent Events:
 *   meta → partial* → result   (or error)
 * Requires sign-in and a Dev Mode plan. Uses the same GEMINI_API_KEY as the other
 * Dev Mode tools; there is no mock fallback, so a missing key is reported honestly.
 * Free accounts can use referral credits: one credit is taken once the request is valid and the
 * AI is configured, and is given back if no result is produced. Request content is never logged.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const plan = await getDevmodePlan(userId)
  const store = getStore()
  if (plan === "none" && (!store || (await store.getCredits(userId)) < 1)) {
    return NextResponse.json(
      { error: "A Dev Mode plan or an invite credit is required for AI debugging.", upgrade: true, invite: true },
      { status: 402 },
    )
  }

  const body = await req.json().catch(() => null)
  const s = (v: unknown, max: number) => (typeof v === "string" ? v : "").slice(0, max)
  const input: DebugRequest = {
    errorText: s(body?.errorText, LIMITS.errorText),
    code: s(body?.code, LIMITS.code),
    language: s(body?.language, 40),
    framework: s(body?.framework, 40),
    context: s(body?.context, LIMITS.context),
  }
  if (!input.errorText.trim() && !input.code.trim()) {
    return NextResponse.json({ error: "Provide an error message, code, or both." }, { status: 400 })
  }
  if (
    (typeof body?.errorText === "string" && body.errorText.length > LIMITS.errorText) ||
    (typeof body?.code === "string" && body.code.length > LIMITS.code)
  ) {
    return NextResponse.json({ error: "Input is too large. Trim the error log or code to the relevant part." }, { status: 413 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI analysis is not configured on this server (GEMINI_API_KEY is missing).", code: "ai_not_configured" },
      { status: 503 },
    )
  }

  // Free accounts: take one credit now (atomic). Refunded below if no result is produced.
  let creditTaken = false
  if (plan === "none") {
    creditTaken = (await store?.consumeCredit(userId)) ?? false
    if (!creditTaken) {
      return NextResponse.json({ error: "No invite credits left.", upgrade: true, invite: true }, { status: 402 })
    }
  }

  const timeout = AbortSignal.timeout(55_000)
  const signal = AbortSignal.any([req.signal, timeout])
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let gotResult = false
      try {
        for await (const event of runDebug(input, {
          apiKey,
          model: process.env.GEMINI_MODEL || undefined,
          baseUrl: process.env.GEMINI_API_BASE || undefined,
          signal,
        })) {
          if (event.type === "result") gotResult = true
          controller.enqueue(encoder.encode(encodeSse(event.type, event)))
        }
        if (timeout.aborted) {
          controller.enqueue(
            encoder.encode(
              encodeSse("error", { type: "error", code: "timeout", message: "The analysis took too long. Try again with less code.", retryable: true }),
            ),
          )
        }
      } catch {
        controller.enqueue(
          encoder.encode(encodeSse("error", { type: "error", code: "unexpected", message: "Something went wrong. Please retry.", retryable: true })),
        )
      } finally {
        if (creditTaken && !gotResult) await store?.addCredits(userId, 1).catch(() => undefined)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
