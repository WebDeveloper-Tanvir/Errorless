import { NextResponse, type NextRequest } from "next/server"
import { getStore, type GrowthStore } from "./store.ts"
import { hashToken } from "./share.ts"

export const NOT_CONFIGURED = () =>
  NextResponse.json(
    { error: "This feature is not configured on this server yet (storage is missing).", code: "storage_not_configured" },
    { status: 503 },
  )

/** Returns the store or a ready 503 response. */
export function storeOrResponse(): { store: GrowthStore; res?: undefined } | { store?: undefined; res: NextResponse } {
  const store = getStore()
  return store ? { store } : { res: NOT_CONFIGURED() }
}

/** Rate-limit key from the caller's IP. Hashed, kept only in memory for the limiter window. */
export async function clientKey(req: NextRequest): Promise<string> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
  return (await hashToken(ip)).slice(0, 16)
}

export const originOf = (req: NextRequest) => (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "")
