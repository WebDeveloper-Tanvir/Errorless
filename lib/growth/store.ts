import type { SharedResult } from "./share.ts"

/**
 * Persistence for the growth system. One interface, two implementations:
 *  - SupabaseStore: production. Server-only REST calls with the service-role key (see
 *    supabase/migrations/0001_growth.sql). No new dependency; uses fetch.
 *  - MemoryStore: tests and local `next dev` only. getStore() never returns it in production, so a
 *    misconfigured deployment fails loudly instead of silently losing data.
 */
export interface ShareMeta {
  id: string
  title: string
  createdAt: number
  expiresAt: number
  revokedAt: number | null
  views: number
}
export interface ShareRecord extends ShareMeta {
  ownerId: string
  payload: SharedResult
}
export type ConversionStatus = "rewarded" | "unrewarded" | "rejected"
export interface Conversion {
  refereeId: string
  referrerId: string
  code: string
  status: ConversionStatus
  reason?: string
  createdAt: number
}
export interface FeedbackRecord {
  surface: string
  helpful: boolean
  comment?: string
}

export interface GrowthStore {
  createShare(rec: ShareRecord): Promise<void>
  getShare(id: string): Promise<ShareRecord | null>
  listShares(ownerId: string): Promise<ShareMeta[]>
  countActiveShares(ownerId: string, now: number): Promise<number>
  revokeShare(id: string, ownerId: string, now: number): Promise<boolean>
  incrementViews(id: string): Promise<void>

  getOrCreateReferralCode(ownerId: string, generate: () => string): Promise<string>
  getReferralOwner(code: string): Promise<string | null>
  recordConversion(c: Conversion): Promise<"created" | "duplicate">
  conversionCounts(referrerId: string): Promise<{ rewarded: number; unrewarded: number }>

  getCredits(userId: string): Promise<number>
  addCredits(userId: string, n: number): Promise<number>
  consumeCredit(userId: string): Promise<boolean>

  addFeedback(f: FeedbackRecord): Promise<void>
}

// ── memory ─────────────────────────────────────────────────────────────────
export class MemoryStore implements GrowthStore {
  shares = new Map<string, ShareRecord>()
  codes = new Map<string, string>() // code -> owner
  conversions = new Map<string, Conversion>() // refereeId -> conversion
  credits = new Map<string, number>()
  feedback: FeedbackRecord[] = []

  async createShare(rec: ShareRecord) { this.shares.set(rec.id, structuredClone(rec)) }
  async getShare(id: string) { const s = this.shares.get(id); return s ? structuredClone(s) : null }
  async listShares(ownerId: string) {
    return [...this.shares.values()].filter((s) => s.ownerId === ownerId).sort((a, b) => b.createdAt - a.createdAt)
      .map(({ id, title, createdAt, expiresAt, revokedAt, views }) => ({ id, title, createdAt, expiresAt, revokedAt, views }))
  }
  async countActiveShares(ownerId: string, now: number) {
    return [...this.shares.values()].filter((s) => s.ownerId === ownerId && !s.revokedAt && s.expiresAt > now).length
  }
  async revokeShare(id: string, ownerId: string, now: number) {
    const s = this.shares.get(id)
    if (!s || s.ownerId !== ownerId || s.revokedAt) return false
    s.revokedAt = now
    return true
  }
  async incrementViews(id: string) { const s = this.shares.get(id); if (s) s.views++ }

  async getOrCreateReferralCode(ownerId: string, generate: () => string) {
    for (const [c, o] of this.codes) if (o === ownerId) return c
    let code = generate()
    while (this.codes.has(code)) code = generate()
    this.codes.set(code, ownerId)
    return code
  }
  async getReferralOwner(code: string) { return this.codes.get(code) ?? null }
  async recordConversion(c: Conversion) {
    if (this.conversions.has(c.refereeId)) return "duplicate" as const
    this.conversions.set(c.refereeId, { ...c })
    return "created" as const
  }
  async conversionCounts(referrerId: string) {
    const mine = [...this.conversions.values()].filter((c) => c.referrerId === referrerId)
    return { rewarded: mine.filter((c) => c.status === "rewarded").length, unrewarded: mine.filter((c) => c.status === "unrewarded").length }
  }

  async getCredits(userId: string) { return this.credits.get(userId) ?? 0 }
  async addCredits(userId: string, n: number) { const v = (this.credits.get(userId) ?? 0) + Math.max(0, n); this.credits.set(userId, v); return v }
  async consumeCredit(userId: string) {
    const v = this.credits.get(userId) ?? 0
    if (v <= 0) return false
    this.credits.set(userId, v - 1)
    return true
  }
  async addFeedback(f: FeedbackRecord) { this.feedback.push({ ...f }) }
}

// ── supabase (PostgREST over fetch) ────────────────────────────────────────
type Fetch = typeof fetch
const iso = (ms: number) => new Date(ms).toISOString()
const ms = (s: string | null) => (s ? Date.parse(s) : null)
const q = encodeURIComponent

export class SupabaseStore implements GrowthStore {
  private url: string
  private key: string
  private f: Fetch
  constructor(url: string, key: string, f: Fetch = fetch) {
    this.url = url
    this.key = key
    this.f = f
  }

  private async req(path: string, init: RequestInit & { prefer?: string } = {}): Promise<Response> {
    const { prefer, ...rest } = init
    const f = this.f
    return f(`${this.url.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...rest,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
      },
      cache: "no-store",
    })
  }
  private async ok(res: Response, what: string) {
    if (!res.ok) throw new Error(`Supabase ${what} failed (${res.status})`)
    return res
  }
  private async rows<T>(path: string, what: string): Promise<T[]> {
    return (await (await this.ok(await this.req(path), what)).json()) as T[]
  }

  async createShare(r: ShareRecord) {
    await this.ok(
      await this.req("shares", {
        method: "POST",
        prefer: "return=minimal",
        body: JSON.stringify({ id: r.id, owner_id: r.ownerId, title: r.title, payload: r.payload, created_at: iso(r.createdAt), expires_at: iso(r.expiresAt) }),
      }),
      "createShare",
    )
  }
  async getShare(id: string) {
    const [row] = await this.rows<Record<string, unknown>>(`shares?id=eq.${q(id)}&select=*&limit=1`, "getShare")
    if (!row) return null
    return {
      id: row.id as string, ownerId: row.owner_id as string, title: row.title as string, payload: row.payload as SharedResult,
      createdAt: ms(row.created_at as string)!, expiresAt: ms(row.expires_at as string)!, revokedAt: ms(row.revoked_at as string | null), views: row.views as number,
    }
  }
  async listShares(ownerId: string) {
    const rows = await this.rows<Record<string, unknown>>(`shares?owner_id=eq.${q(ownerId)}&select=id,title,created_at,expires_at,revoked_at,views&order=created_at.desc&limit=100`, "listShares")
    return rows.map((r) => ({ id: r.id as string, title: r.title as string, createdAt: ms(r.created_at as string)!, expiresAt: ms(r.expires_at as string)!, revokedAt: ms(r.revoked_at as string | null), views: r.views as number }))
  }
  async countActiveShares(ownerId: string, now: number) {
    const rows = await this.rows<unknown>(`shares?owner_id=eq.${q(ownerId)}&revoked_at=is.null&expires_at=gt.${q(iso(now))}&select=id&limit=1000`, "countActiveShares")
    return rows.length
  }
  async revokeShare(id: string, ownerId: string, now: number) {
    const res = await this.ok(
      await this.req(`shares?id=eq.${q(id)}&owner_id=eq.${q(ownerId)}&revoked_at=is.null`, { method: "PATCH", prefer: "return=representation", body: JSON.stringify({ revoked_at: iso(now) }) }),
      "revokeShare",
    )
    return ((await res.json()) as unknown[]).length > 0
  }
  async incrementViews(id: string) {
    await this.req("rpc/increment_share_views", { method: "POST", body: JSON.stringify({ sid: id }) }).catch(() => undefined)
  }

  async getOrCreateReferralCode(ownerId: string, generate: () => string) {
    const [mine] = await this.rows<{ code: string }>(`referral_codes?owner_id=eq.${q(ownerId)}&select=code&limit=1`, "getReferralCode")
    if (mine) return mine.code
    for (let i = 0; i < 5; i++) {
      const code = generate()
      const res = await this.req("referral_codes", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ code, owner_id: ownerId }) })
      if (res.ok) return code
      if (res.status !== 409) throw new Error(`Supabase createReferralCode failed (${res.status})`)
      // 409: either this owner raced us (return theirs) or the code collided (retry)
      const [again] = await this.rows<{ code: string }>(`referral_codes?owner_id=eq.${q(ownerId)}&select=code&limit=1`, "getReferralCode")
      if (again) return again.code
    }
    throw new Error("Could not allocate a referral code")
  }
  async getReferralOwner(code: string) {
    const [row] = await this.rows<{ owner_id: string }>(`referral_codes?code=eq.${q(code)}&select=owner_id&limit=1`, "getReferralOwner")
    return row?.owner_id ?? null
  }
  async recordConversion(c: Conversion) {
    const res = await this.req("referral_conversions", {
      method: "POST", prefer: "return=minimal",
      body: JSON.stringify({ referee_id: c.refereeId, referrer_id: c.referrerId, code: c.code, status: c.status, reason: c.reason ?? null, created_at: iso(c.createdAt) }),
    })
    if (res.status === 409) return "duplicate" as const
    await this.ok(res, "recordConversion")
    return "created" as const
  }
  async conversionCounts(referrerId: string) {
    const rows = await this.rows<{ status: string }>(`referral_conversions?referrer_id=eq.${q(referrerId)}&select=status&limit=1000`, "conversionCounts")
    return { rewarded: rows.filter((r) => r.status === "rewarded").length, unrewarded: rows.filter((r) => r.status === "unrewarded").length }
  }

  async getCredits(userId: string) {
    const [row] = await this.rows<{ balance: number }>(`credits?user_id=eq.${q(userId)}&select=balance&limit=1`, "getCredits")
    return row?.balance ?? 0
  }
  async addCredits(userId: string, n: number) {
    const res = await this.ok(await this.req("rpc/add_credits", { method: "POST", body: JSON.stringify({ uid: userId, n }) }), "addCredits")
    return (await res.json()) as number
  }
  async consumeCredit(userId: string) {
    const res = await this.ok(await this.req("rpc/consume_credit", { method: "POST", body: JSON.stringify({ uid: userId }) }), "consumeCredit")
    return (await res.json()) === true
  }

  async addFeedback(f: FeedbackRecord) {
    await this.ok(await this.req("growth_feedback", { method: "POST", prefer: "return=minimal", body: JSON.stringify({ surface: f.surface, helpful: f.helpful, comment: f.comment ?? null }) }), "addFeedback")
  }
}

// ── selection ──────────────────────────────────────────────────────────────
const g = globalThis as unknown as { __errorlessMemoryStore?: MemoryStore }

/** null means "not configured": routes must answer 503, never pretend to save. */
export function getStore(env: Record<string, string | undefined> = process.env): GrowthStore | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) return new SupabaseStore(url, key)
  if (env.NODE_ENV !== "production") return (g.__errorlessMemoryStore ??= new MemoryStore())
  return null
}
export const storeConfigured = (env: Record<string, string | undefined> = process.env) => getStore(env) !== null
