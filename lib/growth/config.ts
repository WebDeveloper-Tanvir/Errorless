/**
 * Growth-system policy in one place, so limits shown to users and limits enforced by the
 * server cannot drift apart. Pure constants, safe to import from client and server.
 */
export const SHARE = {
  defaultDays: 7,
  maxDays: 30,
  /** Active (not expired, not revoked) links one account may hold. */
  maxActivePerUser: 20,
  maxPayloadBytes: 60_000,
} as const

export const REFERRAL = {
  /** AI analyses granted to BOTH the inviter and the new developer per verified referral. */
  rewardCredits: 3,
  /** Rewarded referrals per inviter. Beyond this, invites still work but earn no credits. */
  maxRewardedPerReferrer: 10,
  /** The invited account must have been created no longer ago than this when it claims. */
  maxAccountAgeMs: 7 * 24 * 60 * 60 * 1000,
  /** Days a visitor's invite code is remembered (localStorage) until they sign up. */
  rememberDays: 30,
  storageKey: "errorless:ref",
} as const

export const FEEDBACK = { maxComment: 500 } as const

/** What each tier really includes. Rendered on /pricing and in onboarding, so it must stay true. */
export const FREE_TIER = {
  includes: [
    "Guest sample debugging session, no account needed",
    "Free in-browser static code analysis (Python, JavaScript, TypeScript, JSX)",
    "Free pattern-based error explainers on every debugging guide page",
    "Community library of hand-written debugging examples",
  ],
  aiAccess: `Live AI debugging needs a Dev Mode plan. Free accounts can use referral credits (${REFERRAL.rewardCredits} analyses per verified invite, up to ${REFERRAL.maxRewardedPerReferrer} invites).`,
  sharing: `Share links are private by default, expire after ${SHARE.defaultDays} days unless you pick up to ${SHARE.maxDays}, and can be revoked anytime.`,
} as const
