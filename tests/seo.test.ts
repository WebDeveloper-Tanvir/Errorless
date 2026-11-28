import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { TOOL_PAGES, getTool, toolPath } from "../lib/seo/tools.ts"
import { buildMetadata, lintSeo, privateMetadata } from "../lib/seo/metadata.ts"
import { getSitemapItems } from "../lib/seo/sitemap-data.ts"
import { getRobotsRules } from "../lib/seo/robots-rules.ts"
import { DISALLOW_PATHS, NOINDEX_PATHS, SITE_URL, absoluteUrl } from "../lib/seo/site.ts"
import { breadcrumbLd, faqLd, itemListLd, organizationLd, serializeJsonLd, softwareLd, toolPageLd, websiteLd } from "../lib/seo/jsonld.ts"
import { acquisitionSource, classifyLandingPath, EVENTS, isAnalyticsEvent, sanitizeProps, trackingDisabled } from "../lib/seo/events.ts"
import { describeError, extractLocation, matchKnownErrors, matchTool } from "../lib/seo/match-error.ts"

// ── the eight requested pages exist, once each ──────────────────────────────
test("pages: the eight requested tools exist with unique, URL-safe slugs", () => {
  assert.deepEqual(
    TOOL_PAGES.map((t) => t.name),
    ["AI Python Error Fixer", "JavaScript Error Debugger", "TypeScript Error Solver", "React Error Debugger", "Node.js Error Fixer", "SQL Error Explainer", "API Error Troubleshooter", "Docker Error Debugger"],
  )
  const slugs = TOOL_PAGES.map((t) => t.slug)
  assert.equal(new Set(slugs).size, slugs.length)
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/)
})

// ── generated metadata: every page ──────────────────────────────────────────
test("metadata: every tool page passes title/description/canonical lint", () => {
  for (const t of TOOL_PAGES) {
    const problems = lintSeo({ title: t.metaTitle, description: t.metaDescription, path: toolPath(t.slug) })
    assert.deepEqual(problems, [], `${t.slug}: ${problems.join("; ")}`)
  }
})

test("metadata: titles and descriptions are unique across pages", () => {
  for (const key of ["metaTitle", "metaDescription"] as const) {
    const vals = TOOL_PAGES.map((t) => t[key].toLowerCase())
    assert.equal(new Set(vals).size, vals.length, `duplicate ${key}`)
  }
})

test("metadata: buildMetadata emits canonical, Open Graph and Twitter fields", () => {
  const t = TOOL_PAGES[0]
  const m = buildMetadata({ title: t.metaTitle, description: t.metaDescription, path: toolPath(t.slug) })
  assert.deepEqual(m.title, { absolute: t.metaTitle })
  assert.equal(m.description, t.metaDescription)
  assert.equal(m.alternates?.canonical, `/tools/${t.slug}`)
  const og = m.openGraph as Record<string, unknown>
  assert.equal(og.url, `/tools/${t.slug}`)
  assert.equal(og.title, t.metaTitle)
  assert.equal(og.description, t.metaDescription)
  assert.equal(og.siteName, "Errorless")
  assert.equal(og.type, "website")
  const tw = m.twitter as Record<string, unknown>
  assert.equal(tw.card, "summary_large_image")
  assert.equal(tw.title, t.metaTitle)
  assert.equal(m.robots, undefined, "public pages leave robots at the default (index)")
  assert.deepEqual((og.images as { url: string; width: number }[])[0].url, "/opengraph-image", "pages without their own image get the default card")
  assert.equal((og.images as { width: number }[])[0].width, 1200)
  assert.deepEqual((tw.images as string[]), ["/opengraph-image"])
  const own = buildMetadata({ title: t.metaTitle, description: t.metaDescription, path: "/x", routeOwnsImage: true })
  assert.equal((own.openGraph as Record<string, unknown>).images, undefined, "routes with an opengraph-image file are not overridden")
})

test("metadata: noindex and private metadata disable indexing and link following", () => {
  const priv = privateMetadata("Dashboard | Errorless")
  assert.deepEqual((priv.robots as { index: boolean; follow: boolean }).index, false)
  assert.deepEqual((priv.robots as { index: boolean; follow: boolean }).follow, false)
  const m = buildMetadata({ title: "x".repeat(10), description: "d".repeat(80), path: "/x", noindex: true })
  assert.equal((m.robots as { index: boolean }).index, false)
})

test("metadata: lint catches bad titles, descriptions and canonical paths", () => {
  assert.ok(lintSeo({ title: "a".repeat(61), description: "d".repeat(100), path: "/a" }).some((p) => p.includes("title")))
  assert.ok(lintSeo({ title: "ok", description: "short", path: "/a" }).some((p) => p.includes("description")))
  assert.ok(lintSeo({ title: "ok", description: "d".repeat(161), path: "/a" }).some((p) => p.includes("max 160")))
  assert.ok(lintSeo({ title: "ok", description: "d".repeat(100), path: "a" }).length > 0)
  assert.ok(lintSeo({ title: "ok", description: "d".repeat(100), path: "/a?x=1" }).length > 0)
  assert.ok(lintSeo({ title: "ok", description: "d".repeat(100), path: "/a/" }).length > 0)
})

// ── content quality: unique, useful, not stuffed ────────────────────────────
const prose = (t: (typeof TOOL_PAGES)[number]) =>
  [...t.intro, ...t.approach.flatMap((a) => [a.title, a.body]), ...t.errors.flatMap((e) => [e.title, e.why, e.fix]), ...t.checklist, ...t.faqs.flatMap((f) => [f.q, f.a])].join(" ")

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean)
const shingles = (s: string, n = 6) => {
  const w = words(s)
  const out = new Set<string>()
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "))
  return out
}

test("content: pages have substantial, distinct content (no near-duplicates)", () => {
  for (const t of TOOL_PAGES) {
    assert.ok(words(prose(t)).length >= 450, `${t.slug} has only ${words(prose(t)).length} words`)
    assert.ok(t.errors.length >= 4, `${t.slug} documents fewer than 4 errors`)
    assert.ok(t.faqs.length >= 3 && t.checklist.length >= 5 && t.approach.length === 3 && t.intro.length >= 2)
  }
  for (let i = 0; i < TOOL_PAGES.length; i++) {
    for (let j = i + 1; j < TOOL_PAGES.length; j++) {
      const a = shingles(prose(TOOL_PAGES[i]))
      const b = shingles(prose(TOOL_PAGES[j]))
      let shared = 0
      for (const s of a) if (b.has(s)) shared++
      const overlap = shared / Math.min(a.size, b.size)
      assert.ok(overlap < 0.08, `${TOOL_PAGES[i].slug} vs ${TOOL_PAGES[j].slug} share ${(overlap * 100).toFixed(1)}% of 6-word phrases`)
    }
  }
})

test("content: no keyword stuffing (one stack word never dominates the text)", () => {
  for (const t of TOOL_PAGES) {
    const w = words(prose(t))
    const key = words(t.navLabel)[0]
    const density = w.filter((x) => x === key).length / w.length
    assert.ok(density < 0.04, `${t.slug}: "${key}" is ${(density * 100).toFixed(1)}% of words`)
    assert.ok(!/\b(best|#1|number one|guaranteed|100%|instantly fixes?)\b/i.test(prose(t) + t.metaTitle + t.metaDescription), `${t.slug} contains a superlative or guarantee`)
  }
})

test("content: no fake social proof, ratings or testimonials anywhere in tool content or structured data", () => {
  const all = JSON.stringify(TOOL_PAGES) + serializeJsonLd([organizationLd(), websiteLd(), softwareLd(), ...TOOL_PAGES.map(toolPageLd)])
  assert.ok(!/testimonial|aggregateRating|ratingValue|reviewCount|"review"|trusted by|\d+,?\d*\+? (?:developers|users|teams)/i.test(all))
})

test("content: related links point to real pages and never to itself", () => {
  for (const t of TOOL_PAGES) {
    assert.ok(t.related.length >= 2)
    for (const r of t.related) {
      assert.ok(getTool(r), `${t.slug} links to unknown ${r}`)
      assert.notEqual(r, t.slug)
    }
  }
})

test("content: claims are honest (no execution claims, local-only wording where relevant)", () => {
  for (const t of TOOL_PAGES) {
    const text = prose(t)
    assert.ok(!/\b(we|errorless) (ran|executed|tested) your/i.test(text))
    for (const e of t.errors) assert.notEqual(e.before.trim(), e.after.trim(), `${t.slug}/${e.id} before equals after`)
  }
})

// ── the demo really works: every documented error matches its own example ──
test("demo: every documented error is recognised from its own example message", () => {
  for (const t of TOOL_PAGES) {
    for (const e of t.errors) {
      const hits = matchKnownErrors(t.errors, e.example, 6)
      assert.ok(hits.some((h) => h.id === e.id), `${t.slug}/${e.id} does not match its own example`)
      const d = describeError(e)
      assert.ok(!/\$\d/.test(d.why + d.fix), `${t.slug}/${e.id} leaves a placeholder unfilled`)
    }
  }
})

test("demo: each page's prefilled example resolves to a documented error", () => {
  for (const t of TOOL_PAGES) {
    const hits = matchTool(t, t.demoError)
    assert.ok(hits.length >= 1, `${t.slug} demo example matches nothing`)
  }
})

test("demo: captures real values from the pasted error and does not guess on unknown input", () => {
  const py = getTool("python-error-fixer")!
  const m = matchTool(py, "KeyError: 'order_total'")[0]
  assert.equal(m.id, "keyerror")
  assert.ok(m.why.includes("'order_total'"))
  const node = getTool("nodejs-error-fixer")!
  assert.ok(matchTool(node, "Error: listen EADDRINUSE: address already in use :::8080")[0].fix.includes("8080"))
  assert.deepEqual(matchTool(py, "everything is fine, no error here"), [])
  assert.deepEqual(matchTool(py, "   "), [])
  assert.deepEqual(matchTool(py, "TypeError: Cannot read properties of undefined (reading 'map')"), [], "a JavaScript error is not explained by the Python page")
})

test("demo: extracts the failing location from Python, Node and TypeScript errors", () => {
  assert.deepEqual(extractLocation('Traceback...\n  File "app.py", line 7, in <module>\n  File "lib/util.py", line 4, in f\nKeyError: 1'), { file: "lib/util.py", line: 4 })
  assert.deepEqual(extractLocation("at UserList (UserList.jsx:12:14)"), { file: "UserList.jsx", line: 12 })
  assert.deepEqual(extractLocation("src/profile.ts(8,10): error TS2322"), { file: "src/profile.ts", line: 8 })
  assert.equal(extractLocation("no location here"), null)
})

test("demo: the matcher survives hostile input quickly (no catastrophic regex)", () => {
  const bad = "a".repeat(5000) + "'".repeat(2000) + "\n".repeat(500)
  const start = Date.now()
  for (const t of TOOL_PAGES) matchTool(t, bad)
  assert.ok(Date.now() - start < 1500, "matching 5k chars of junk across all pages took too long")
})

// ── sitemap and robots ──────────────────────────────────────────────────────
test("sitemap: lists the tools hub and all eight pages, absolute and unique", () => {
  const items = getSitemapItems()
  const urls = items.map((i) => i.url)
  assert.equal(new Set(urls).size, urls.length)
  assert.ok(urls.includes(absoluteUrl("/")) && urls.includes(absoluteUrl("/tools")))
  for (const t of TOOL_PAGES) assert.ok(urls.includes(absoluteUrl(toolPath(t.slug))))
  for (const i of items) {
    assert.ok(i.url.startsWith(SITE_URL), i.url)
    assert.ok(!/[?#]/.test(i.url) && !(i.url.length > SITE_URL.length + 1 && i.url.endsWith("/")), i.url)
    assert.match(i.lastModified, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(i.priority >= 0 && i.priority <= 1)
  }
})

test("sitemap: contains no private, auth or API URLs", () => {
  const urls = getSitemapItems().map((i) => new URL(i.url).pathname)
  for (const u of urls) {
    for (const p of [...NOINDEX_PATHS, ...DISALLOW_PATHS]) assert.ok(!(u === p || u.startsWith(p.endsWith("/") ? p : `${p}/`)), `${u} is private`)
  }
})

test("robots: blocks API/admin, points to the sitemap, allows everything else", () => {
  const r = getRobotsRules()
  assert.equal(r.sitemap, `${SITE_URL}/sitemap.xml`)
  const rule = r.rules[0]
  assert.equal(rule.userAgent, "*")
  assert.equal(rule.allow, "/")
  assert.ok((rule.disallow as readonly string[]).includes("/api/") && (rule.disallow as readonly string[]).includes("/admin/"))
  assert.ok(!(rule.disallow as readonly string[]).includes("/tools") && !(rule.disallow as readonly string[]).includes("/"))
})

test("private pages: every NOINDEX path has an X-Robots-Tag header rule and a noindex layout", () => {
  const cfg = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8")
  const listed = /const NOINDEX = \[([^\]]*)\]/.exec(cfg)![1].match(/"([^"]+)"/g)!.map((s) => s.replace(/"/g, ""))
  assert.deepEqual([...listed].sort(), NOINDEX_PATHS.map((p) => p.slice(1)).sort(), "next.config.mjs NOINDEX is out of sync with lib/seo/site.ts")
  for (const p of ["dashboard", "devmode", "profile", "editor", "ide", "admin", "sign-in", "sign-up", "auth", "invite", "quiz", "learn"]) {
    const layout = readFileSync(new URL(`../app/${p}/layout.tsx`, import.meta.url), "utf8")
    assert.ok(layout.includes("privateMetadata"), `app/${p}/layout.tsx is not noindex`)
  }
  assert.ok(cfg.includes('"/api/:path*"'))
})

test("middleware: crawlers can reach tools, sitemap, robots and social images without a session", () => {
  const mw = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8")
  for (const route of ['"/tools(.*)"', '"/sitemap.xml"', '"/robots.txt"', '"/opengraph-image(.*)"']) assert.ok(mw.includes(route), `middleware is missing ${route}`)
  for (const priv of ["/dashboard", "/devmode", "/profile", "/admin"]) assert.ok(!new RegExp(`isPublicRoute[\\s\\S]*?"${priv}`).test(mw.split("clerkMiddleware(")[0]), `${priv} must stay protected`)
})

test("canonical: the root layout no longer forces one canonical on every page", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8")
  assert.ok(!/alternates\s*:\s*\{\s*canonical/.test(layout))
  assert.ok(layout.includes("metadataBase"))
})

// ── structured data ─────────────────────────────────────────────────────────
test("jsonld: serialization cannot break out of the script tag and round-trips", () => {
  const nasty = { name: "</script><script>alert(1)</script>", t: "a b" }
  const s = serializeJsonLd(nasty)
  assert.ok(!s.includes("</script>") && !s.includes("<"))
  assert.deepEqual(JSON.parse(s), nasty)
})

test("jsonld: FAQ, breadcrumb, list and page markup match the visible content", () => {
  for (const t of TOOL_PAGES) {
    const faq = faqLd(t.faqs) as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] }
    assert.equal(faq.mainEntity.length, t.faqs.length)
    assert.deepEqual(faq.mainEntity.map((q) => q.name), t.faqs.map((f) => f.q))
    const page = toolPageLd(t) as { url: string; dateModified: string }
    assert.equal(page.url, absoluteUrl(toolPath(t.slug)))
    assert.match(page.dateModified, /^\d{4}-\d{2}-\d{2}$/)
  }
  const bc = breadcrumbLd([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }]) as { itemListElement: { position: number; item: string }[] }
  assert.deepEqual(bc.itemListElement.map((i) => i.position), [1, 2])
  assert.equal(bc.itemListElement[1].item, absoluteUrl("/tools"))
  assert.equal((itemListLd("x", [{ name: "a", path: "/a" }]) as { itemListElement: unknown[] }).itemListElement.length, 1)
  assert.equal((organizationLd() as { "@type": string })["@type"], "Organization")
  assert.equal((softwareLd() as { applicationCategory: string }).applicationCategory, "DeveloperApplication")
})

// ── analytics ───────────────────────────────────────────────────────────────
test("analytics: only the known, documented events exist", () => {
  assert.deepEqual([...EVENTS].sort(), ["debug_complete", "debug_error", "debug_request", "demo_result", "demo_start", "feedback_submitted", "landing_view", "onboarding_complete", "referral_conversion", "returning_user", "share_created", "sign_up", "signup_click"])
  assert.ok(isAnalyticsEvent("landing_view") && !isAnalyticsEvent("page_hack"))
})

test("analytics: props are allowlisted, primitive, short, and never carry user content", () => {
  const p = sanitizeProps("debug_complete", {
    status: "diagnosed", confidence: "high", language: "python", framework: "", input_kinds: "error_message,stack_trace", has_code: true,
    errorText: "KeyError: 'secret'", code: "print(password)", email: "a@b.dev", userId: "user_1", nested: { a: 1 }, long: "x",
  })
  assert.deepEqual(p, { status: "diagnosed", confidence: "high", language: "python", input_kinds: "error_message,stack_trace", has_code: true })
  assert.equal(sanitizeProps("demo_start", { slug: "x".repeat(500) }).slug?.toString().length, 60)
  assert.deepEqual(sanitizeProps("sign_up", { method: "clerk", email: "a@b.dev" }), { method: "clerk" })
  assert.deepEqual(sanitizeProps("landing_view", { page_type: NaN, slug: ["a"] }), {})
  for (const ev of EVENTS) {
    const keys = Object.keys(sanitizeProps(ev, Object.fromEntries(["email", "name", "text", "content", "message", "user", "userId", "errorText", "error_text", "password", "token"].map((k) => [k, "x"]))))
    assert.deepEqual(keys, [], `${ev} accepts a sensitive-looking prop`)
  }
})

test("analytics: landing pages are classified; private paths never are", () => {
  assert.deepEqual(classifyLandingPath("/"), { page_type: "home" })
  assert.deepEqual(classifyLandingPath("/tools/python-error-fixer"), { page_type: "tool", slug: "python-error-fixer" })
  assert.deepEqual(classifyLandingPath("/tools/"), { page_type: "tools_hub" })
  assert.deepEqual(classifyLandingPath("/pricing"), { page_type: "pricing" })
  for (const p of ["/dashboard", "/devmode", "/profile", "/admin/payments", "/editor", "/sign-in", "/api/x", "/tools/a/b"]) assert.equal(classifyLandingPath(p), null, p)
})

test("analytics: acquisition source uses UTM or referrer hostname only; Do Not Track is honored", () => {
  assert.deepEqual(acquisitionSource("?utm_source=newsletter&utm_medium=email", "https://x.com/a?b=c", "errorless.dev"), { source: "newsletter", medium: "email" })
  assert.deepEqual(acquisitionSource("", "https://www.google.com/search?q=secret+error", "errorless.dev"), { source: "google.com", medium: "referral" })
  assert.deepEqual(acquisitionSource("", "https://errorless.dev/tools", "errorless.dev"), { source: "direct" })
  assert.deepEqual(acquisitionSource("", "", "errorless.dev"), { source: "direct" })
  assert.equal(trackingDisabled({ doNotTrack: "1" }, false), true)
  assert.equal(trackingDisabled({ doNotTrack: "0" }, true), true)
  assert.equal(trackingDisabled({ doNotTrack: null }, false), false)
})
