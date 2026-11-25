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

/** Admins are the Clerk user IDs listed (comma-separated) in ADMIN_USER_IDS. */
export function isAdmin(userId: string): boolean {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId)
}

/**
 * The Dev Mode plan is stored on the Clerk user (publicMetadata.devmodePlan) and
 * is only ever written by the server after an admin approves a payment.
 * Admins get Premium so they can test every feature.
 */
export async function getDevmodePlan(userId: string): Promise<DevPlan> {
  if (isAdmin(userId)) return "premium"
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const p = user.publicMetadata?.devmodePlan
  return p === "basic" || p === "premium" ? p : "none"
}
