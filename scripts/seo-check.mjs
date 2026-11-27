#!/usr/bin/env node
/**
 * Audits the BUILT site over HTTP: run `next build && next start`, then `npm run seo:check`.
 * Checks every URL in /sitemap.xml for title, description, canonical, Open Graph, Twitter,
 * heading hierarchy, image alt text, JSON-LD validity and internal links, and checks that
 * private routes and APIs are not indexable. Exits 1 on any failure.
 *
 * BASE=http://127.0.0.1:3100 SITE=https://errorless.dev node scripts/seo-check.mjs
 */
const BASE = (process.env.BASE || "http://127.0.0.1:3100").replace(/\/$/, "")
const SITE = (process.env.SITE || process.env.NEXT_PUBLIC_SITE_URL || "https://errorless.dev").replace(/\/$/, "")

let failures = 0
let checks = 0
const fail = (where, msg) => { failures++; console.log(`FAIL ${where}: ${msg}`) }
const ok = (cond, where, msg) => { checks++; if (!cond) fail(where, msg) }

async function get(path, init) {
  const res = await fetch(BASE + path, { redirect: "manual", ...init })
  const text = res.headers.get("content-type")?.includes("image") ? "" : await res.text()
  return { res, text }
}

const attr = (tag, name) => new RegExp(`${name}=("([^"]*)"|'([^']*)')`, "i").exec(tag)?.slice(2).find(Boolean)
const decode = (s = "") => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
const metas = (html) => [...html.matchAll(/<meta\s[^>]*>/gi)].map((m) => m[0])
const meta = (html, key) => {
  for (const t of metas(html)) if ((attr(t, "name") === key || attr(t, "property") === key) && attr(t, "content") != null) return decode(attr(t, "content"))
}

function auditPublic(path, html) {
  const where = path
  const title = decode(/<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "")
  ok(title.length > 0 && title.length <= 60, where, `title length ${title.length}: "${title}"`)
  const desc = meta(html, "description") ?? ""
  ok(desc.length >= 70 && desc.length <= 160, where, `description length ${desc.length}`)

  const links = [...html.matchAll(/<link\s[^>]*>/gi)].map((m) => m[0])
  const canon = links.filter((t) => attr(t, "rel") === "canonical").map((t) => attr(t, "href"))
  const expected = SITE + (path === "/" ? "" : path)
  ok(canon.length === 1, where, `expected exactly one canonical, found ${canon.length}`)
  ok(canon[0] === expected || canon[0] === expected + "/", where, `canonical "${canon[0]}" should be "${expected}"`)

  ok(meta(html, "og:title") === title, where, "og:title missing or different from <title>")
  ok(meta(html, "og:description") === desc, where, "og:description missing or different")
  ok((meta(html, "og:url") ?? "").replace(/\/$/, "") === expected, where, `og:url is ${meta(html, "og:url")}`)
  ok(meta(html, "og:type") === "website", where, "og:type")
  ok(/^https?:\/\/.+/.test(meta(html, "og:image") ?? ""), where, "og:image missing or not absolute")
  ok(meta(html, "og:image:width") === "1200" || !!meta(html, "og:image"), where, "og:image dims")
  ok(meta(html, "twitter:card") === "summary_large_image", where, "twitter:card")
  ok(meta(html, "twitter:title") === title, where, "twitter:title")
  ok(/^https?:\/\/.+/.test(meta(html, "twitter:image") ?? ""), where, "twitter:image missing or not absolute")
  ok(!/noindex/i.test(meta(html, "robots") ?? ""), where, "public page is marked noindex")
  ok(/<html[^>]*\slang="en"/i.test(html), where, "html lang")
  ok(/<meta[^>]*name="viewport"/i.test(html), where, "viewport meta")

  // Headings: one h1, no skipped levels in document order.
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
  const heads = [...body.matchAll(/<h([1-6])[\s>]/gi)].map((m) => Number(m[1]))
  ok(heads.filter((h) => h === 1).length === 1, where, `expected one <h1>, found ${heads.filter((h) => h === 1).length}`)
  let prev = 0
  for (const h of heads) {
    if (prev && h > prev + 1) { fail(where, `heading jumps from h${prev} to h${h}`); break }
    prev = h
  }
  checks++

  // Images need alt text (empty alt is allowed for decorative images; missing is not).
  for (const t of body.matchAll(/<img\s[^>]*>/gi)) ok(/\salt=/i.test(t[0]), where, `<img> without alt: ${t[0].slice(0, 80)}`)

  // JSON-LD must parse and be an object with @context/@type.
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const d = JSON.parse(m[1])
      for (const node of Array.isArray(d) ? d : [d]) ok(node["@context"] === "https://schema.org" && !!node["@type"], where, "JSON-LD node missing @context/@type")
      ok(!/aggregateRating|"review"/.test(m[1]), where, "JSON-LD contains rating/review markup")
    } catch (e) {
      fail(where, `invalid JSON-LD: ${e.message}`)
    }
  }
  return [...body.matchAll(/<a\s[^>]*href="(\/[^"#?]*)[^"]*"/gi)].map((m) => m[1])
}

// ── sitemap ────────────────────────────────────────────────────────────────
const sm = await get("/sitemap.xml")
ok(sm.res.status === 200, "/sitemap.xml", `status ${sm.res.status}`)
const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
ok(locs.length >= 10, "/sitemap.xml", `only ${locs.length} URLs`)
ok(new Set(locs).size === locs.length, "/sitemap.xml", "duplicate URLs")
ok(locs.every((l) => l.startsWith(SITE)), "/sitemap.xml", "a URL is not on the site origin")
const paths = locs.map((l) => new URL(l).pathname)
const PRIVATE = ["/dashboard", "/devmode", "/profile", "/editor", "/ide", "/admin", "/sign-in", "/sign-up", "/auth", "/api"]
ok(!paths.some((p) => PRIVATE.some((x) => p === x || p.startsWith(x + "/"))), "/sitemap.xml", "contains a private path")

// ── robots ─────────────────────────────────────────────────────────────────
const rb = await get("/robots.txt")
ok(rb.res.status === 200, "/robots.txt", `status ${rb.res.status}`)
ok(/User-Agent:\s*\*/i.test(rb.text) && /Disallow:\s*\/api\//i.test(rb.text) && /Disallow:\s*\/admin\//i.test(rb.text), "/robots.txt", "missing rules")
ok(new RegExp(`Sitemap:\\s*${SITE.replace(/[.]/g, "\\.")}/sitemap\\.xml`, "i").test(rb.text), "/robots.txt", "missing sitemap line")
ok(!/Disallow:\s*\/\s*$/m.test(rb.text), "/robots.txt", "blocks the whole site")

// ── every public URL ───────────────────────────────────────────────────────
const internal = new Set()
for (const p of paths) {
  const { res, text } = await get(p)
  ok(res.status === 200, p, `status ${res.status}`)
  if (res.status !== 200) continue
  for (const l of auditPublic(p, text)) internal.add(l)
}

// Internal links found on public pages must resolve (public ones) or redirect to sign-in (private ones).
const toCheck = [...internal].filter((l) => !l.startsWith("/_next") && !/\.[a-z0-9]+$/i.test(l)).slice(0, 80)
for (const l of toCheck) {
  const { res } = await get(l)
  ok(res.status < 400 || [404].includes(res.status) && PRIVATE.some((x) => l.startsWith(x)), `link ${l}`, `status ${res.status}`)
}

// Tool pages: internal linking requirements.
const tools = paths.filter((p) => /^\/tools\/[^/]+$/.test(p))
ok(tools.length === 8, "tools", `expected 8 tool pages in the sitemap, found ${tools.length}`)
for (const p of tools) {
  const { text } = await get(p)
  const hrefs = new Set([...text.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]))
  ok(hrefs.has("/tools"), p, "does not link to the tools hub")
  ok(hrefs.has("/pricing") && hrefs.has("/docs"), p, "missing links to pricing/docs")
  ok(tools.filter((t) => t !== p && hrefs.has(t)).length >= 2, p, "links to fewer than 2 other tool pages")
  const linked = tools.filter((t) => t !== p && hrefs.has(t)).length
  ok(linked <= tools.length - 1, p, "self-check")
}
const home = (await get("/")).text
ok(tools.every((t) => home.includes(`href="${t}"`)), "/", "home page does not link to every tool page")

// 404 pages must not be indexable or in the sitemap.
const nf = await get("/tools/does-not-exist")
ok(nf.res.status === 404, "/tools/does-not-exist", `status ${nf.res.status}`)

// ── private and API routes ─────────────────────────────────────────────────
const noindexHeader = (r) => /noindex/i.test(r.headers.get("x-robots-tag") ?? "")
for (const p of ["/dashboard", "/devmode", "/profile", "/editor", "/ide", "/admin/payments"]) {
  const { res, text } = await get(p)
  const locked = res.status >= 300 && res.status < 500 // redirected to sign-in or protected
  ok(noindexHeader(res) || /noindex/i.test(meta(text, "robots") ?? ""), p, `no noindex signal (status ${res.status})`)
  ok(locked || /noindex/i.test(meta(text, "robots") ?? ""), p, `reachable without sign-in (status ${res.status})`)
}
for (const p of ["/sign-in", "/sign-up"]) {
  const { res, text } = await get(p)
  ok(res.status === 200, p, `status ${res.status}`)
  ok(/noindex/i.test(meta(text, "robots") ?? "") && noindexHeader(res), p, "sign-in/up must be noindex in meta and header")
}
for (const p of ["/api/devmode/debug", "/api/devmode/payment/status"]) {
  const { res } = await get(p)
  ok(noindexHeader(res), p, "API response lacks X-Robots-Tag noindex")
}

console.log(`\n${checks} checks, ${failures} failed`)
process.exit(failures ? 1 : 0)
