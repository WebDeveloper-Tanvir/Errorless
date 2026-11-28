import { NextRequest, NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"
import { REFERRAL } from "@/lib/growth/config"
import { claimReferral, type Account } from "@/lib/growth/claim"
import { generateReferralCode } from "@/lib/growth/referral"
import { originOf, storeOrResponse } from "@/lib/growth/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET: the caller's invite link, real conversion counts and credit balance. */
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { store, res } = storeOrResponse()
  if (!store) return res
  const code = await store.getOrCreateReferralCode(userId, generateReferralCode)
  const counts = await store.conversionCounts(userId)
  return NextResponse.json(
    {
      code,
      link: `${originOf(req)}/?ref=${code}`,
      rewarded: counts.rewarded,
      unrewarded: counts.unrewarded,
      credits: await store.getCredits(userId),
      policy: { rewardCredits: REFERRAL.rewardCredits, maxRewarded: REFERRAL.maxRewardedPerReferrer },
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}

async function accountOf(userId: string): Promise<Account> {
  const user = await (await clerkClient()).users.getUser(userId)
  const e = user.emailAddresses.find((x) => x.id === user.primaryEmailAddressId)
  return { email: e?.emailAddress ?? null, verified: e?.verification?.status === "verified", createdAt: user.createdAt }
}

/**
 * POST {code}: a newly signed-up developer claims the invite they arrived with.
 * Legitimate = different person, verified email, new account, one claim per account ever
 * (rules in lib/growth/referral.ts, flow in lib/growth/claim.ts). Both sides get the same disclosed
 * credits; over the inviter's cap the claim succeeds but earns nothing, and the response says so.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { store, res } = storeOrResponse()
  if (!store) return res
  const body = await req.json().catch(() => null)
  const reply = await claimReferral(store, { userId, code: body?.code, me: await accountOf(userId), loadInviter: accountOf, now: Date.now() })
  return NextResponse.json(reply.body, { status: reply.status })
}
