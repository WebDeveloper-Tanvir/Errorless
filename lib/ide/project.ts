import { bridgeScript } from "./bridge.ts"
import { detectLanguage } from "./language.ts"

/** The slice of a file-tree node this module needs (compatible with the IDE's FileNode). */
export interface TreeNode {
  id: string
  name: string
  type: "file" | "folder"
  content?: string
  children?: TreeNode[]
}
export interface ProjectFile { id: string; name: string; path: string; content: string }

export function flattenProject(nodes: readonly TreeNode[], prefix = ""): ProjectFile[] {
  const out: ProjectFile[] = []
  for (const n of nodes) {
    const path = prefix ? `${prefix}/${n.name}` : n.name
    if (n.type === "folder") out.push(...flattenProject(n.children ?? [], path))
    else out.push({ id: n.id, name: n.name, path, content: n.content ?? "" })
  }
  return out
}

const dirOf = (p: string) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "")

/** Resolve "./a/b.css", "../x.js" or "b.css" written in `fromPath` against the project. */
export function resolveRef(files: readonly ProjectFile[], fromPath: string, ref: string): ProjectFile | null {
  const clean = ref.split(/[?#]/)[0].trim()
  if (!clean || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(clean)) return null
  const parts = (clean.startsWith("/") ? clean.slice(1) : `${dirOf(fromPath)}/${clean}`).split("/")
  const stack: string[] = []
  for (const part of parts) {
    if (!part || part === ".") continue
    if (part === "..") stack.pop()
    else stack.push(part)
  }
  const target = stack.join("/")
  const exact = files.find((f) => f.path === target)
  if (exact) return exact
  // Be forgiving about where the file lives, but never guess between two candidates.
  const base = target.split("/").pop()!
  const same = files.filter((f) => f.name === base)
  return same.length === 1 ? same[0] : null
}

const isExternal = (u: string) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(u.trim())
const escScript = (s: string) => s.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--")
const escStyle = (s: string) => s.replace(/<\/(style)/gi, "<\\/$1")

/** Restrictive CSP for previews. Static assets and libraries from https are allowed; nothing else. */
export const PREVIEW_CSP =
  "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:; " +
  "img-src data: blob: https:; font-src data: https:; media-src data: blob: https:; connect-src https:; " +
  "frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"

export interface BuildInput {
  files: readonly ProjectFile[]
  /** Path of the file that was run. */
  entry: ProjectFile
  nonce: string
  parentOrigin: string
  /** Transpiled output for .ts files, keyed by path. */
  compiled?: Readonly<Record<string, string>>
}
export interface BuildResult {
  html: string
  /** What is being shown, for the terminal. */
  page: string
  notes: string[]
  /** Local references that point at files that don't exist. */
  missing: string[]
  /** For a standalone script: lines of injected markup before the user's first line (subtract from reported error lines). */
  lineOffset?: number
}

const head = (nonce: string, origin: string) =>
  `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"><script>${escScript(bridgeScript(nonce, origin))}</script>`

function injectHead(html: string, inject: string): string {
  const m = /<head[^>]*>/i.exec(html)
  if (m) return html.slice(0, m.index + m[0].length) + inject + html.slice(m.index + m[0].length)
  const h = /<html[^>]*>/i.exec(html)
  if (h) return html.slice(0, h.index + h[0].length) + `<head>${inject}</head>` + html.slice(h.index + h[0].length)
  return `<!DOCTYPE html><html><head>${inject}</head><body>${html}</body></html>`
}

const hasModuleSyntax = (code: string) => /^\s*(import\s[\w{*"']|export\s)/m.test(code)

function inlineHtml(page: ProjectFile, input: BuildInput, overrides: Map<string, string>, notes: string[], missing: string[]): string {
  const { files, compiled = {} } = input
  let html = page.content
  const read = (f: ProjectFile) => overrides.get(f.path) ?? (f.name.match(/\.(ts|mts)$/i) ? compiled[f.path] ?? f.content : f.content)

  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    if (!href || isExternal(href)) return tag
    const f = resolveRef(files, page.path, href)
    if (!f) { missing.push(href); return `<!-- missing: ${href.replace(/-->/g, "")} -->` }
    return `<style data-src="${f.path.replace(/"/g, "")}">${escStyle(read(f))}</style>`
  })
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (_m, pre: string, src: string, post: string) => {
    if (isExternal(src)) return _m
    const f = resolveRef(files, page.path, src)
    if (!f) { missing.push(src); return `<!-- missing: ${src.replace(/-->/g, "")} -->` }
    const attrs = `${pre} ${post}`.replace(/\s+/g, " ").trim()
    const code = read(f)
    const type = !/\btype\s*=/i.test(attrs) && hasModuleSyntax(code) ? ' type="module"' : ""
    return `<script data-src="${f.path.replace(/"/g, "")}"${type}${attrs ? " " + attrs : ""}>${escScript(code)}</script>`
  })
  void notes
  return html
}

/** Which page should a given file be shown in? Returns null when it should run standalone. */
export function pageFor(files: readonly ProjectFile[], entry: ProjectFile): ProjectFile | null {
  const kind = detectLanguage(entry.name).runtime
  const htmlFiles = files.filter((f) => detectLanguage(f.name).runtime === "html")
  if (kind === "html") return entry
  const pick = (cands: ProjectFile[]) => cands.find((f) => /(^|\/)index\.html?$/i.test(f.path)) ?? cands[0] ?? null
  if (kind === "css") return pick(htmlFiles)
  // A script runs inside the page that references it, so DOM code has a document to work on.
  const referencing = htmlFiles.filter((h) =>
    [...h.content.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].some((m) => resolveRef(files, h.path, m[1])?.id === entry.id),
  )
  return pick(referencing)
}

export function buildPreview(input: BuildInput): BuildResult {
  const { files, entry, nonce, parentOrigin, compiled = {} } = input
  const kind = detectLanguage(entry.name).runtime
  const notes: string[] = []
  const missing: string[] = []
  const inject = head(nonce, parentOrigin)
  const page = pageFor(files, entry)

  if (kind === "html" && page) {
    const html = inlineHtml(page, input, new Map(), notes, missing)
    return { html: injectHead(html, inject), page: page.path, notes, missing }
  }

  if (kind === "css") {
    if (!page) return { html: "", page: "", notes: ["There is no HTML file in the project to apply this CSS to. Create an index.html first."], missing }
    const overrides = new Map<string, string>([[entry.path, entry.content]])
    let html = inlineHtml(page, input, overrides, notes, missing)
    if (!html.includes(`data-src="${entry.path}"`)) {
      notes.push(`${entry.path} is not linked from ${page.path}, so it was applied to the preview directly. Add <link rel="stylesheet" href="${entry.name}"> to use it for real.`)
      html = injectHead(html, `<style data-src="${entry.path}">${escStyle(entry.content)}</style>`)
    }
    return { html: injectHead(html, inject), page: page.path, notes, missing }
  }

  if ((kind === "browser-js" || kind === "browser-ts") && page) {
    const html = inlineHtml(page, input, new Map(), notes, missing)
    notes.push(`${entry.path} is loaded by ${page.path}, so it runs inside that page.`)
    return { html: injectHead(html, inject), page: page.path, notes, missing }
  }

  if (kind === "browser-js" || kind === "browser-ts") {
    const code = kind === "browser-ts" ? compiled[entry.path] ?? "" : entry.content
    const type = hasModuleSyntax(code) ? ' type="module"' : ""
    const prefix = `<!DOCTYPE html><html><head><meta charset="utf-8">${inject}</head><body><script${type}>`
    const html = `${prefix}${escScript(code)}</script></body></html>`
    return { html, page: "(blank page)", notes, missing, lineOffset: prefix.split("\n").length - 1 }
  }

  return { html: "", page: "", notes: [`${entry.name} cannot be shown in the preview.`], missing }
}
