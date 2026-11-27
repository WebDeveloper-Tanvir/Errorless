# Errorless technical SEO checklist

Run `npm test` (unit tests, incl. `tests/seo.test.ts`) and, against a built server, `npm run seo:check`
(`SEO_BASE_URL` defaults to http://127.0.0.1:3100): `npx next build && npx next start -p 3100`.

| # | Area | Implementation | Verified by |
|---|------|----------------|-------------|
| 1 | Titles / descriptions | `lib/seo/metadata.ts` `buildMetadata()`; root title template; per-page unique values (title ≤ 60, description 70–160 chars) | `seo.test.ts` lint + uniqueness; `seo:check` |
| 2 | Open Graph / Twitter | Per-page OG + `summary_large_image`; generated images via `next/og` (`app/opengraph-image.tsx`, `app/tools/[slug]/opengraph-image.tsx`) | `seo:check` |
| 3 | Canonical URLs | `alternates.canonical` per page from `NEXT_PUBLIC_SITE_URL`; no site-wide canonical | tests + `seo:check` |
| 4 | XML sitemap | `app/sitemap.ts` (public pages only, real lastmod) | tests + `seo:check` |
| 5 | robots.txt | `app/robots.ts`: disallows `/api/` and `/admin/` only, links sitemap | tests + `seo:check` |
| 6 | Structured data | Organization, WebSite, SoftwareApplication (no ratings/offers), WebPage, BreadcrumbList, FAQPage, ItemList | JSON-LD parse tests + `seo:check` |
| 7 | Headings | One `h1` per page, no skipped levels | `seo:check` |
| 8 | Images | `next/image` optimisation (avif/webp), alt text on every `img` | `seo:check` |
| 9 | Internal links | Header, footer, home strip, hub `/tools`, related tools per page, breadcrumbs | `seo:check` |
| 10 | Performance | Tool pages are static (SSG); demo is a small client island; `optimizePackageImports`; cache headers on brand images | build output (tool page ≈203 kB first load, shared 102 kB) |

## Indexing strategy
- Private areas (`/dashboard`, `/devmode`, `/profile`, `/editor`, `/ide`, `/admin`, auth routes, `/quiz`, `/learn`) use
  `noindex, nofollow` via metadata **and** an `X-Robots-Tag` header. They are deliberately **not** blocked in robots.txt,
  because a disallowed URL cannot be crawled and its noindex would never be seen.
- `/api/*` returns `X-Robots-Tag: noindex` and is disallowed. Debug history and sessions are never in HTML for crawlers.
- Clerk middleware lists `/tools`, sitemap, robots and OG image routes as public so crawlers are not redirected to sign-in.

## Analytics (privacy-first)
Events: `landing_view`, `demo_start`, `demo_result`, `debug_complete`, `debug_error`, `signup_click`, `sign_up`.
Properties are allow-listed primitives only; pasted code, errors, emails and user ids are never sent. Do Not Track and
`localStorage["errorless:analytics-optout"]="1"` disable tracking. Vercel Analytics is always the sink; GA4 loads only if
`NEXT_PUBLIC_GA_MEASUREMENT_ID` is set (consent defaults to denied).

## Honest limits
- The tool-page demo is a free, local, pattern-based explainer (not AI) and says so; real AI analysis is in Dev Mode.
- It only explains the documented error patterns; unknown input is reported as unmatched, not guessed.

## Manual steps after deploy
1. Set `NEXT_PUBLIC_SITE_URL` to the production origin (default `https://errorless.dev`).
2. Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
3. Validate pages with Google's Rich Results Test.
4. Run Lighthouse/PageSpeed on the deployed URL for real Core Web Vitals (only build-size numbers were measured here).
5. Optional: set `NEXT_PUBLIC_GA_MEASUREMENT_ID`; add a consent banner for EU visitors. Vercel custom events may need a paid plan.
