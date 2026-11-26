import { clerkClient } from "@clerk/nextjs/server"

export type DevPlan = "none" | "basic" | "premium"

export interface PaymentRequest {
  plan: "basic" | "premium"
  /** 12-digit UPI reference number (UTR) the customer entered. */
  utr: string
  ts: number
  status: "pending" | "rejected"
}

export const PLAN_PRICE_INR = { basic: 209, premium: 419 } as const

const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)

/**
 * Admins are the Clerk user IDs in ADMIN_USER_IDS, or users whose *verified primary*
 * email is listed in ADMIN_EMAILS (both comma-separated).
 */
export async function isAdmin(userId: string): Promise<boolean> {
  if (list(process.env.ADMIN_USER_IDS).includes(userId.toLowerCase())) return true
  const emails = list(process.env.ADMIN_EMAILS)
  if (emails.length === 0) return false
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
  return !!primary && primary.verification?.status === "verified" && emails.includes(primary.emailAddress.toLowerCase())
}

/**
 * The Dev Mode plan is stored on the Clerk user (publicMetadata.devmodePlan) and
 * is only ever written by the server after an admin approves a payment.
 * Admins get Premium so they can test every feature.
 */
export async function getDevmodePlan(userId: string): Promise<DevPlan> {
  if (await isAdmin(userId)) return "premium"
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const p = user.publicMetadata?.devmodePlan
  return p === "basic" || p === "premium" ? p : "none"
}
