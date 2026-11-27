import { CONTENT_UPDATED, absoluteUrl } from "./site.ts"
import { TOOL_PAGES, toolPath } from "./tools.ts"

export interface SitemapItem {
  url: string
  lastModified: string
  changeFrequency: "weekly" | "monthly" | "yearly"
  priority: number
}

/** Every indexable URL, and only those. Private, auth and API paths are never listed. */
export function getSitemapItems(): SitemapItem[] {
  const core: SitemapItem[] = [
    { url: absoluteUrl("/"), lastModified: CONTENT_UPDATED, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/tools"), lastModified: CONTENT_UPDATED, changeFrequency: "weekly", priority: 0.9 },
    { url: absoluteUrl("/pricing"), lastModified: CONTENT_UPDATED, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/docs"), lastModified: CONTENT_UPDATED, changeFrequency: "monthly", priority: 0.6 },
    { url: absoluteUrl("/demo"), lastModified: CONTENT_UPDATED, changeFrequency: "monthly", priority: 0.5 },
  ]
  const tools: SitemapItem[] = TOOL_PAGES.map((t) => ({
    url: absoluteUrl(toolPath(t.slug)),
    lastModified: t.updated,
    changeFrequency: "monthly",
    priority: 0.8,
  }))
  return [...core, ...tools]
}
