import { DISALLOW_PATHS, SITE_URL } from "./site.ts"

export function getRobotsRules() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...DISALLOW_PATHS] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
