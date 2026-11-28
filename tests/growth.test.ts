import { test } from "node:test"
import assert from "node:assert/strict"
import { DebugResultSchema } from "../lib/debug/schema.ts"
import { SHOWCASE, GUEST_SAMPLE } from "../lib/growth/showcase.ts"

test("showcase: entries are valid debug results with unique slugs", () => {
  assert.ok(SHOWCASE.length >= 6)
  assert.equal(new Set(SHOWCASE.map((e) => e.slug)).size, SHOWCASE.length)
  for (const e of SHOWCASE) {
    const r = DebugResultSchema.safeParse(e.result)
    assert.ok(r.success, `${e.slug}: ${r.success ? "" : r.error.message}`)
    assert.equal(e.result.executed, false)
  }
  assert.ok(GUEST_SAMPLE)
})

test("showcase: every evidence quote and line number is real", () => {
  for (const e of SHOWCASE) {
    const lines = e.code.split("\n")
    for (const ev of e.result.evidence) {
      const hay = ev.source === "code" ? e.code : e.error
      assert.ok(hay.includes(ev.quote), `${e.slug}: quote not found: ${ev.quote}`)
      if (ev.source === "code" && ev.line) assert.ok(lines[ev.line - 1]?.includes(ev.quote), `${e.slug}: line ${ev.line} does not contain the quote`)
    }
  }
})

import { buildSharePayload, parseSharePayload, generateShareToken, hashToken, isShareToken, clampDays } from "../lib/growth/share.ts"
import { evaluateReferral, normalizeEmail, generateReferralCode, isReferralCode } from "../lib/growth/referral.ts"
import { createLimiter } from "../lib/growth/rate-limit.ts"
import { MemoryStore, SupabaseStore, getStore } from "../lib/growth/store.ts"
import { REFERRAL, SHARE } from "../lib/growth/config.ts"

const sample = () => structuredClone(SHOWCASE[0].result)

// ── sharing: private by default, consent-shaped payload ─────────────────────
test("share: default payload excludes evidence quotes and corrected code", () => {
  const p = buildSharePayload(sample(), { includeEvidence: false, includeCorrectedCode: false })
  assert.equal(p.evidence, undefined)
  assert.equal(p.fix?.correctedCode, undefined)
  assert.deepEqual(p.includes, { evidence: false, correctedCode: false })
  assert.ok(!JSON.stringify(p).includes("def add_item"), "no user code leaks into the default payload")
})

test("share: opt-in extras are included and flagged", () => {
  const p = buildSharePayload(sample(), { includeEvidence: true, includeCorrectedCode: true })
  assert.ok(p.evidence && p.evidence.length > 0)
  assert.ok(p.fix?.correctedCode?.includes("items=None"))
  assert.deepEqual(p.includes, { evidence: true, correctedCode: true })
})

test("share: secrets are redacted even if the model echoed them", () => {
  const r = sample()
  const fake = ["sk", "live", "abcdefghijklmnopqrstuv123"].join("_") // assembled at runtime so scanners don't flag the fixture
  r.rootCause.explanation = `The call uses api_key = "${fake}" which is wrong.`
  const p = buildSharePayload(r, { includeEvidence: false, includeCorrectedCode: false })
  assert.ok(!JSON.stringify(p).includes(fake))
  const server = parseSharePayload({ ...p, headline: "token = 'ghp_" + "a".repeat(36) + "'" })
  assert.ok(server.ok && !server.value.headline.includes("ghp_" + "a".repeat(36)), "server re-redacts what the client sent")
})

test("share: server rejects malformed and oversized payloads", () => {
  assert.equal(parseSharePayload({ nope: 1 }).ok, false)
  assert.equal(parseSharePayload(null).ok, false)
  const p = buildSharePayload(sample(), { includeEvidence: false, includeCorrectedCode: true })
  const big = { ...p, fix: { ...p.fix!, correctedCode: "x".repeat(29_000) }, verification: Array(8).fill("y".repeat(400)), prevention: Array(8).fill("z".repeat(400)), alternatives: Array(4).fill({ cause: "c".repeat(500), check: "k".repeat(500) }), evidence: Array(8).fill({ quote: "q".repeat(500), note: "n".repeat(600) }) }
  const r = parseSharePayload(big)
  assert.ok(!r.ok || r.bytes <= SHARE.maxPayloadBytes)
})

test("share: tokens are unguessable, validated, and only a hash is stored", async () => {
  const a = generateShareToken(), b = generateShareToken()
  assert.notEqual(a, b)
  assert.ok(isShareToken(a))
  assert.ok(!isShareToken("short") && !isShareToken(a + "!") && !isShareToken(""))
  const h = await hashToken(a)
  assert.match(h, /^[0-9a-f]{64}$/)
  assert.notEqual(h, a)
  assert.equal(h, await hashToken(a))
})

test("share: expiry is clamped to policy", () => {
  assert.equal(clampDays(undefined), SHARE.defaultDays)
  assert.equal(clampDays(9999), SHARE.maxDays)
  assert.equal(clampDays(-3), 1)
  assert.equal(clampDays("7"), SHARE.defaultDays)
})

// ── referrals ───────────────────────────────────────────────────────────────
const base = { referrerId: "u1", refereeId: "u2", referrerEmail: "a@x.com", refereeEmail: "b@y.com", refereeEmailVerified: true, refereeCreatedAt: 1_000_000, referrerRewardedCount: 0, now: 1_000_000 + 60_000 }

test("referral: a normal new verified developer is legitimate", () => assert.deepEqual(evaluateReferral(base), { ok: true }))

test("referral: self, unverified, old account and same-person emails are rejected", () => {
  assert.equal((evaluateReferral({ ...base, refereeId: "u1" }) as { reason: string }).reason, "self_referral")
  assert.equal((evaluateReferral({ ...base, refereeEmailVerified: false }) as { reason: string }).reason, "unverified_email")
  assert.equal((evaluateReferral({ ...base, now: base.refereeCreatedAt + REFERRAL.maxAccountAgeMs + 1 }) as { reason: string }).reason, "account_too_old")
  assert.equal((evaluateReferral({ ...base, referrerEmail: "j.doe@gmail.com", refereeEmail: "jdoe+alt@googlemail.com" }) as { reason: string }).reason, "same_email_owner")
})

test("referral: email normalisation and code format", () => {
  assert.equal(normalizeEmail("J.Doe+x@Gmail.com"), "jdoe@gmail.com")
  assert.equal(normalizeEmail("a.b+c@corp.com"), "a.b@corp.com")
  const c = generateReferralCode()
  assert.ok(isReferralCode(c))
  assert.ok(!isReferralCode("abc") && !isReferralCode("ABCDEFG0") && !isReferralCode(undefined))
  assert.notEqual(generateReferralCode(), generateReferralCode())
})

// ── rate limiter ────────────────────────────────────────────────────────────
test("limiter: blocks after max in the window, then recovers", () => {
  let t = 0
  const l = createLimiter(2, 1000, () => t)
  assert.ok(l.allow("k") && l.allow("k"))
  assert.equal(l.allow("k"), false)
  assert.ok(l.allow("other"))
  t = 1001
  assert.ok(l.allow("k"))
})

// ── memory store semantics (the contract the Supabase store must also meet) ─
test("store: shares are owner-scoped, revocable and countable", async () => {
  const s = new MemoryStore()
  const payload = buildSharePayload(sample(), { includeEvidence: false, includeCorrectedCode: false })
  await s.createShare({ id: "h1", ownerId: "u1", title: "t", createdAt: 1, expiresAt: 100, revokedAt: null, views: 0, payload })
  assert.equal(await s.countActiveShares("u1", 50), 1)
  assert.equal(await s.countActiveShares("u1", 150), 0, "expired links are not active")
  assert.equal(await s.revokeShare("h1", "intruder", 5), false)
  assert.equal(await s.revokeShare("h1", "u1", 5), true)
  assert.equal(await s.revokeShare("h1", "u1", 6), false)
  assert.equal((await s.getShare("h1"))?.revokedAt, 5)
  assert.equal((await s.listShares("u1")).length, 1)
  assert.equal("payload" in (await s.listShares("u1"))[0], false, "list never returns payloads")
})

test("store: one referral code per owner, one conversion per invited account", async () => {
  const s = new MemoryStore()
  const a = await s.getOrCreateReferralCode("u1", generateReferralCode)
  assert.equal(await s.getOrCreateReferralCode("u1", generateReferralCode), a)
  assert.equal(await s.getReferralOwner(a), "u1")
  assert.equal(await s.getReferralOwner("NOSUCHCD"), null)
  const c = { refereeId: "u2", referrerId: "u1", code: a, status: "rewarded" as const, createdAt: 1 }
  assert.equal(await s.recordConversion(c), "created")
  assert.equal(await s.recordConversion({ ...c, referrerId: "u9" }), "duplicate")
  assert.deepEqual(await s.conversionCounts("u1"), { rewarded: 1, unrewarded: 0 })
})

test("store: credits never go negative", async () => {
  const s = new MemoryStore()
  assert.equal(await s.consumeCredit("u1"), false)
  await s.addCredits("u1", 2)
  assert.ok(await s.consumeCredit("u1") && await s.consumeCredit("u1"))
  assert.equal(await s.consumeCredit("u1"), false)
  assert.equal(await s.getCredits("u1"), 0)
  await s.addCredits("u1", -5)
  assert.equal(await s.getCredits("u1"), 0, "negative grants are ignored")
})

test("store: production without Supabase env is 'not configured', never memory", () => {
  assert.equal(getStore({ NODE_ENV: "production" }), null)
  assert.ok(getStore({ NODE_ENV: "development" }) instanceof MemoryStore)
  assert.ok(getStore({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }) instanceof SupabaseStore)
})

// ── supabase store: request shapes against a fake PostgREST ────────────────
test("supabase store: sends service key, scopes revoke by owner, treats 409 as duplicate", async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    if (url.includes("/referral_conversions") && init.method === "POST") return new Response("", { status: 409 })
    if (url.includes("/rpc/consume_credit")) return new Response("true")
    if (url.includes("/shares?") && init.method === "PATCH") return new Response("[]")
    return new Response("[]")
  }) as unknown as typeof fetch
  const s = new SupabaseStore("https://p.supabase.co/", "SERVICE", fake)
  assert.equal(await s.recordConversion({ refereeId: "u2", referrerId: "u1", code: "ABCDEFGH", status: "rewarded", createdAt: 1 }), "duplicate")
  assert.equal(await s.consumeCredit("u1"), true)
  assert.equal(await s.revokeShare("abc", "u1", 5), false, "no row matched means not revoked")
  const patch = calls.find((c) => c.init.method === "PATCH")!
  assert.match(patch.url, /id=eq\.abc&owner_id=eq\.u1&revoked_at=is\.null/)
  const h = patch.init.headers as Record<string, string>
  assert.equal(h.apikey, "SERVICE")
  assert.equal(h.Authorization, "Bearer SERVICE")
  assert.ok(calls.every((c) => c.url.startsWith("https://p.supabase.co/rest/v1/")))
})

import { claimReferral, createShareLink, readShare, type Account } from "../lib/growth/claim.ts"

const T0 = 2_000_000_000_000
const acct = (email: string, over: Partial<Account> = {}): Account => ({ email, verified: true, createdAt: T0 - 1000, ...over })

async function setup() {
  const s = new MemoryStore()
  const code = await s.getOrCreateReferralCode("inviter", generateReferralCode)
  const accounts: Record<string, Account> = { inviter: acct("inv@a.com", { createdAt: T0 - 9e9 }), new1: acct("n1@b.com"), new2: acct("n2@b.com") }
  const claim = (userId: string, c: unknown = code, over: Partial<Account> = {}) =>
    claimReferral(s, { userId, code: c, me: { ...accounts[userId], ...over }, loadInviter: async (id) => accounts[id], now: T0 })
  return { s, code, claim, accounts }
}

test("claim: a legitimate invite rewards both sides exactly once", async () => {
  const { s, claim } = await setup()
  const r = await claim("new1")
  assert.equal(r.body.outcome, "rewarded")
  assert.equal(await s.getCredits("inviter"), REFERRAL.rewardCredits)
  assert.equal(await s.getCredits("new1"), REFERRAL.rewardCredits)
  const again = await claim("new1")
  assert.equal(again.body.outcome, "already_claimed")
  assert.equal(await s.getCredits("inviter"), REFERRAL.rewardCredits, "no double reward on retry")
})

test("claim: self, unverified and bad codes earn nothing and are not recorded", async () => {
  const { s, claim } = await setup()
  assert.equal((await claim("inviter")).body.reason, "self_referral")
  assert.equal((await claim("new1", undefined, { verified: false })).body.reason, "unverified_email")
  assert.equal((await claim("new1", "nonsense")).status, 400)
  assert.equal((await claim("new1", "ABCDEFGH")).status, 404)
  assert.equal(await s.getCredits("inviter"), 0)
  assert.equal(s.conversions.size, 0, "a user who verifies their email later can still claim")
  assert.equal((await claim("new1")).body.outcome, "rewarded")
})

test("claim: the per-inviter cap is enforced and disclosed", async () => {
  const { s, claim, accounts } = await setup()
  for (let i = 0; i < REFERRAL.maxRewardedPerReferrer; i++) {
    accounts[`u${i}`] = acct(`u${i}@z.com`)
    assert.equal((await claim(`u${i}`)).body.outcome, "rewarded")
  }
  accounts.over = acct("over@z.com")
  const r = await claim("over")
  assert.equal(r.body.outcome, "counted")
  assert.equal(r.body.credits, 0)
  assert.equal(await s.getCredits("over"), 0)
  assert.equal(await s.getCredits("inviter"), REFERRAL.maxRewardedPerReferrer * REFERRAL.rewardCredits)
})

test("share link: refuses without explicit consent and publishes nothing", async () => {
  const s = new MemoryStore()
  const payload = buildSharePayload(sample(), { includeEvidence: false, includeCorrectedCode: false })
  for (const body of [{ payload }, { payload, consent: "yes" }, { payload, consent: false }, null]) {
    const r = await createShareLink(s, { userId: "u1", body, now: T0, origin: "https://e.dev" })
    assert.equal(r.status, 400)
  }
  assert.equal(s.shares.size, 0)
})

test("share link: consented link works, stores only the hash, expires and can be revoked", async () => {
  const s = new MemoryStore()
  const payload = buildSharePayload(sample(), { includeEvidence: false, includeCorrectedCode: false })
  const r = await createShareLink(s, { userId: "u1", body: { payload, consent: true, days: 3 }, now: T0, origin: "https://e.dev" })
  assert.equal(r.status, 200)
  const url = r.body.url as string
  const token = url.split("/s/")[1]
  assert.ok(isShareToken(token))
  assert.ok(!JSON.stringify([...s.shares.keys()]).includes(token), "the token itself is never stored")
  const hash = await hashToken(token)
  assert.ok(await readShare(s, hash, T0 + 1000))
  assert.equal(await readShare(s, hash, T0 + 4 * 86_400_000), null, "expired")
  assert.equal(await readShare(s, await hashToken("A".repeat(32)), T0), null, "unknown token")
  await s.revokeShare(hash, "u1", T0 + 5)
  assert.equal(await readShare(s, hash, T0 + 10), null, "revoked")
})

test("share link: active-link cap is enforced", async () => {
  const s = new MemoryStore()
  const payload = buildSharePayload(sample(), { includeEvidence: false, includeCorrectedCode: false })
  for (let i = 0; i < SHARE.maxActivePerUser; i++) assert.equal((await createShareLink(s, { userId: "u1", body: { payload, consent: true }, now: T0, origin: "o" })).status, 200)
  assert.equal((await createShareLink(s, { userId: "u1", body: { payload, consent: true }, now: T0, origin: "o" })).status, 409)
  assert.equal((await createShareLink(s, { userId: "u2", body: { payload, consent: true }, now: T0, origin: "o" })).status, 200, "other users are unaffected")
})

// ── SEO, privacy and honesty of the growth surfaces ─────────────────────────
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { lintSeo } from "../lib/seo/metadata.ts"
import { showcaseMeta, showcasePath } from "../lib/growth/showcase.ts"
import { getSitemapItems } from "../lib/seo/sitemap-data.ts"
import { absoluteUrl, NOINDEX_PATHS } from "../lib/seo/site.ts"
import { sanitizeProps, recordVisit, isAnalyticsEvent } from "../lib/seo/events.ts"
import { FREE_TIER } from "../lib/growth/config.ts"

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8")

test("community: every example passes title/description lint and is unique", () => {
  const seen = new Set<string>()
  for (const e of SHOWCASE) {
    const m = showcaseMeta(e)
    assert.deepEqual(lintSeo({ ...m, path: showcasePath(e.slug) }), [], e.slug)
    assert.ok(!seen.has(m.title) && !seen.has(m.description), `${e.slug} duplicates another page`)
    seen.add(m.title); seen.add(m.description)
  }
})

test("community: hub and every example are in the sitemap; share and invite paths are not", () => {
  const urls = getSitemapItems().map((i) => i.url)
  assert.ok(urls.includes(absoluteUrl("/community")))
  for (const e of SHOWCASE) assert.ok(urls.includes(absoluteUrl(showcasePath(e.slug))))
  assert.ok(urls.every((u) => !u.includes("/s/") && !u.includes("/invite")))
  assert.ok(NOINDEX_PATHS.includes("/s") && NOINDEX_PATHS.includes("/invite"))
})

test("share page: noindex, no-referrer, uniform 404, no HTML injection", () => {
  const page = read("app/s/[token]/page.tsx")
  assert.match(page, /index: false/)
  assert.match(page, /referrer: "no-referrer"/)
  assert.ok((page.match(/notFound\(\)/g) ?? []).length >= 2 && !page.includes("redirect("), "malformed, unknown, expired and revoked all end in the same 404")
  assert.ok(!read("components/growth/shared-result-view.tsx").includes("dangerouslySetInnerHTML"))
  const cfg = read("next.config.mjs")
  assert.ok(cfg.includes('"/s/:token"') && cfg.includes("no-store") && cfg.includes("no-referrer"))
})

test("honesty: the deceptive share-to-unlock referral gate is gone and nothing forces sharing", () => {
  assert.ok(!existsSync(new URL("../components/viral-growth-gate.tsx", import.meta.url)))
  for (const f of readdirSync(new URL("../components/growth", import.meta.url))) {
    const src = read(`components/growth/${f}`)
    assert.ok(!/Math\.random/.test(src), `${f} must not invent codes or numbers in the browser`)
    assert.ok(!/generateReferralCode/.test(src), `${f} must not generate referral codes client-side`)
  }
  const demo = read("app/demo/page.tsx") + read("components/growth/sample-session.tsx")
  assert.ok(!/unlock|invitesSent/i.test(demo))
})

test("honesty: no fake counts, testimonials or ratings in growth content", () => {
  const text = [JSON.stringify(SHOWCASE), JSON.stringify(FREE_TIER), read("app/community/page.tsx"), read("components/growth/sample-session.tsx"), read("components/growth/free-tier-box.tsx")].join("\n")
  assert.ok(!/\b\d[\d,]*\+?\s+(developers|users|teams|companies|customers)\b/i.test(text), "no user counts")
  assert.ok(!/testimonial|trusted by|rated \d|★|\bstars\b|loved by/i.test(text))
  assert.ok(!/"@type":\s*"(Review|AggregateRating)"/.test(text))
})

test("honesty: sample and showcase results are labelled as pre-written, not live AI", () => {
  assert.match(read("components/growth/sample-session.tsx"), /pre-written sample/)
  assert.match(read("app/community/page.tsx"), /not user submissions/)
  assert.match(read("app/community/[slug]/page.tsx"), /not generated live/)
  for (const e of SHOWCASE) assert.ok(e.result.warnings.some((w) => /Hand-written/.test(w)))
})

test("free tier: the limits users see match the enforced constants", () => {
  assert.ok(FREE_TIER.aiAccess.includes(String(REFERRAL.rewardCredits)) && FREE_TIER.aiAccess.includes(String(REFERRAL.maxRewardedPerReferrer)))
  assert.ok(FREE_TIER.sharing.includes(String(SHARE.defaultDays)) && FREE_TIER.sharing.includes(String(SHARE.maxDays)))
  assert.ok(read("components/growth/onboarding.tsx").includes("FREE_TIER"))
})

test("privacy: guest feedback never stores identity; share route needs auth and consent", () => {
  const fb = read("app/api/growth/feedback/route.ts")
  assert.ok(!/userId|auth\(/.test(fb), "guest feedback stores no account")
  assert.match(fb, /redactSecrets/)
  const share = read("app/api/growth/share/route.ts")
  assert.match(share, /Unauthorized/)
  assert.ok(share.includes("createShareLink"))
  const sql = read("supabase/migrations/0001_growth.sql")
  for (const t of ["shares", "referral_codes", "referral_conversions", "credits", "growth_feedback"]) assert.match(sql, new RegExp(`alter table public\\.${t}\\s+enable row level security`))
  assert.ok(!/create policy/i.test(sql), "no policies: anon key can read nothing")
})

test("analytics: new growth events are allowlisted and carry no content; repeat visits need no identifier", () => {
  for (const e of ["debug_request", "returning_user", "share_created", "referral_conversion", "feedback_submitted", "onboarding_complete"]) assert.ok(isAnalyticsEvent(e), e)
  const p = sanitizeProps("feedback_submitted", { surface: "guest_demo", helpful: true, has_comment: true, comment: "my secret code", email: "a@b.c" })
  assert.deepEqual(p, { surface: "guest_demo", helpful: true, has_comment: true })
  assert.deepEqual(sanitizeProps("referral_conversion", { outcome: "rewarded", referrer: "user_123", code: "ABCDEFGH" }), { outcome: "rewarded" })
  assert.deepEqual(recordVisit([], "2026-01-01"), { days: ["2026-01-01"], returning: false, changed: true })
  assert.equal(recordVisit(["2026-01-01"], "2026-01-02").returning, true)
  assert.equal(recordVisit(["2026-01-01"], "2026-01-01").changed, false)
  assert.equal(recordVisit(Array.from({ length: 40 }, (_, i) => `d${i}`), "new").days.length, 30)
})

test("analytics: the funnel events the product needs are all wired in code", () => {
  const where: Record<string, string> = {
    landing_view: "components/analytics-events.tsx", returning_user: "components/analytics-events.tsx", sign_up: "components/analytics-events.tsx",
    demo_start: "components/growth/sample-session.tsx", debug_request: "components/debug/use-debug-session.ts", debug_complete: "components/debug/use-debug-session.ts",
    referral_conversion: "components/growth/referral-tracker.tsx", share_created: "components/growth/share-dialog.tsx",
    feedback_submitted: "components/growth/client.ts", onboarding_complete: "components/growth/onboarding.tsx",
  }
  for (const [ev, f] of Object.entries(where)) assert.ok(read(f).includes(`"${ev}"`), `${ev} is not tracked in ${f}`)
})
