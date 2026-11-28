import { REFERRAL, SHARE } from "./config.ts"
import { evaluateReferral, isReferralCode, type ReferralVerdict } from "./referral.ts"
import { clampDays, generateShareToken, hashToken, parseSharePayload } from "./share.ts"
import type { GrowthStore } from "./store.ts"

/** Framework-free route logic, so it is unit-tested with a MemoryStore (routes only add auth + HTTP). */
export interface Account { email: string | null; verified: boolean; createdAt: number }
export interface Reply { status: number; body: Record<string, unknown> }

export async function claimReferral(
  store: GrowthStore,
  a: { userId: string; code: unknown; me: Account; loadInviter: (id: string) => Promise<Account>; now: number },
): Promise<Reply> {
  const code = typeof a.code === "string" ? a.code.toUpperCase() : ""
  const invalid = { status: 400, body: { outcome: "invalid", message: "That invite link isn't valid." } }
  if (!isReferralCode(code)) return invalid
  const referrerId = await store.getReferralOwner(code)
  if (!referrerId) return { ...invalid, status: 404 }

  const inviter = await a.loadInviter(referrerId)
  const counts = await store.conversionCounts(referrerId)
  const verdict: ReferralVerdict = evaluateReferral({
    referrerId, refereeId: a.userId, referrerEmail: inviter.email, refereeEmail: a.me.email,
    refereeEmailVerified: a.me.verified, refereeCreatedAt: a.me.createdAt, referrerRewardedCount: counts.rewarded, now: a.now,
  })
  if (!verdict.ok) return { status: 200, body: { outcome: "not_eligible", reason: verdict.reason, message: verdict.message } }

  const rewarded = counts.rewarded < REFERRAL.maxRewardedPerReferrer
  const created = await store.recordConversion({ refereeId: a.userId, referrerId, code, status: rewarded ? "rewarded" : "unrewarded", createdAt: a.now })
  if (created === "duplicate") return { status: 200, body: { outcome: "already_claimed", message: "This account has already used an invite." } }
  if (rewarded) {
    await store.addCredits(referrerId, REFERRAL.rewardCredits)
    await store.addCredits(a.userId, REFERRAL.rewardCredits)
  }
  return {
    status: 200,
    body: {
      outcome: rewarded ? "rewarded" : "counted",
      credits: rewarded ? REFERRAL.rewardCredits : 0,
      message: rewarded
        ? `Invite applied: you and the developer who invited you each got ${REFERRAL.rewardCredits} AI analyses.`
        : "Invite applied. The inviter has reached the reward limit, so no credits were issued.",
    },
  }
}

export async function createShareLink(
  store: GrowthStore,
  a: { userId: string; body: unknown; now: number; origin: string },
): Promise<Reply> {
  const b = (a.body ?? {}) as { consent?: unknown; payload?: unknown; days?: unknown }
  if (b.consent !== true) return { status: 400, body: { error: "Sharing needs your explicit consent. Nothing was published." } }
  const parsed = parseSharePayload(b.payload)
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } }
  if ((await store.countActiveShares(a.userId, a.now)) >= SHARE.maxActivePerUser) {
    return { status: 409, body: { error: `You have ${SHARE.maxActivePerUser} active links. Revoke one to create another.` } }
  }
  const token = generateShareToken()
  const id = await hashToken(token)
  const expiresAt = a.now + clampDays(b.days) * 24 * 60 * 60 * 1000
  await store.createShare({ id, ownerId: a.userId, title: parsed.value.title, createdAt: a.now, expiresAt, revokedAt: null, views: 0, payload: parsed.value })
  return { status: 200, body: { url: `${a.origin}/s/${token}`, id, expiresAt } }
}

/** Public read of a shared result: unknown, expired and revoked links all look the same. */
export async function readShare(store: GrowthStore, hash: string, now: number) {
  const rec = await store.getShare(hash)
  if (!rec || rec.revokedAt || rec.expiresAt <= now) return null
  return rec
}
