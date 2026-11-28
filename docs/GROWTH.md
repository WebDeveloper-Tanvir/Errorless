# Growth system

Everything here is opt-in, private by default, and honest about limits. No fake user counts, testimonials or ratings exist anywhere.

## Setup (required for shares, referrals, credits, guest feedback)
1. Run `supabase/migrations/0001_growth.sql` in your Supabase project.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server only). RLS is enabled with **no policies**, so the public anon key can read and write nothing.
3. Without these, production answers `503 storage_not_configured` (never pretends to save). `next dev` uses an in-memory store.

## Features
| Feature | Where | Rules |
|---|---|---|
| Free guest demo | `/demo` | Pre-written sample, labelled as such; no server/AI call, no sign-up. Plus the real in-browser static analyzer. |
| Shareable results | Dev Mode → Share; `/s/<token>` | Needs sign-in **and** explicit consent. Submitted code/error text never included; evidence quotes and corrected code are opt-in. Secrets re-redacted on the server. 192-bit token, only its SHA-256 stored. Expires (default 7, max 30 days), revocable at `/invite`, max 20 active, noindex, `no-referrer`, `no-store`. Unknown/expired/revoked all return the same 404. |
| Referrals | `/invite`, `?ref=CODE` | Code created server-side. Counts only for a different person with a verified email and an account < 7 days old; one claim per account ever; plus-tag/Gmail-dot aliases of the inviter rejected. Both sides get 3 AI analyses; max 10 rewarded invites per inviter, over-cap invites are shown as "counted, no credits". |
| Credits | debug route | Free accounts spend 1 credit per AI analysis (atomic RPC); refunded if no result is produced. Paid plans never use credits. |
| Feedback | results panel, `/api/growth/feedback` | Helpful / Not helpful + optional comment (secrets redacted, no account/IP stored). Dev Mode ratings still go to Clerk private metadata. |
| Community | `/community`, `/community/<slug>` | Six hand-written examples, labelled "not user submissions". Nothing user-made is ever published automatically. |
| Onboarding | Dev Mode first visit; "How it works" button | 3 steps; skippable; includes free-tier limits. |
| Free-tier transparency | `/pricing`, `/demo`, onboarding | All text comes from `lib/growth/config.ts`, the same constants the server enforces (a test checks this). |

The old `components/viral-growth-gate.tsx` (random fake referral code, share-to-unlock) was removed.

## Analytics (no identifiers, no content)
`landing_view`, `demo_start`, `debug_request`, `debug_complete` (successful analysis), `debug_error`, `returning_user` (a new calendar day after an earlier one; only a day count, stored locally), `signup_click`, `sign_up`, `referral_conversion` (outcome only), `share_created`, `feedback_submitted`, `onboarding_complete`. Props are allow-listed; Do Not Track and `errorless:analytics-optout` are honoured. Server-side truth for referrals is the `referral_conversions` table.

## Tests
`npm test` (growth: store contract, share consent/expiry/revoke, referral abuse cases, cap, feedback privacy, honesty checks). `npm run seo:check` audits the built site incl. `/community`, `/s/<unknown>` and private routes. The Supabase store was exercised end-to-end against a PostgREST stand-in, not a real Supabase project.

## Known limits
- Credit grant after a referral claim is two writes (inviter, invitee); a crash between them could skip one grant (the conversion row prevents a double grant). Wrap in an RPC if that matters.
- Referral rewards are an abuse-reduction design, not fraud-proof: throwaway verified emails are still possible, bounded by the 10-invite cap.
- Share pages host user-chosen text; they are noindex, expiring, rate-limited (10 links/hour) and revocable, but there is no report/moderation UI yet.
- Showcase submissions from users are deliberately not implemented.
