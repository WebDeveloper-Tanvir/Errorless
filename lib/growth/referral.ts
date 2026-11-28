import { REFERRAL } from "./config.ts"

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789" // no 0/O/1/I/L

export function generateReferralCode(len = 8): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")
}
export const isReferralCode = (c: unknown): c is string => typeof c === "string" && /^[A-HJKMNP-Z2-9]{8}$/.test(c)

/** Collapses address tricks (plus tags, Gmail dots) so one person can't pose as many. */
export function normalizeEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@")
  const d = domain === "googlemail.com" ? "gmail.com" : domain
  let l = local.split("+")[0]
  if (d === "gmail.com") l = l.replace(/\./g, "")
  return `${l}@${d}`
}

export interface ReferralCheck {
  referrerId: string
  refereeId: string
  referrerEmail: string | null
  refereeEmail: string | null
  refereeEmailVerified: boolean
  refereeCreatedAt: number
  /** Rewarded conversions this referrer already has. */
  referrerRewardedCount: number
  now: number
}
export type ReferralVerdict = { ok: true } | { ok: false; reason: "self_referral" | "unverified_email" | "account_too_old" | "same_email_owner"; message: string }

/**
 * A referral is legitimate when the invited developer is a different person with a verified,
 * new account. Over-cap referrals are handled by the caller (they succeed but earn no credits).
 */
export function evaluateReferral(c: ReferralCheck): ReferralVerdict {
  if (c.referrerId === c.refereeId) return { ok: false, reason: "self_referral", message: "You can't use your own invite link." }
  if (!c.refereeEmailVerified || !c.refereeEmail) return { ok: false, reason: "unverified_email", message: "Verify your email to count this invite." }
  if (c.now - c.refereeCreatedAt > REFERRAL.maxAccountAgeMs) return { ok: false, reason: "account_too_old", message: "Invites only apply to new accounts." }
  if (c.referrerEmail && normalizeEmail(c.referrerEmail) === normalizeEmail(c.refereeEmail))
    return { ok: false, reason: "same_email_owner", message: "This looks like the same person as the inviter." }
  return { ok: true }
}
