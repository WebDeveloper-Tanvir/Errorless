import type { MetadataRoute } from "next"
import { getSitemapItems } from "@/lib/seo/sitemap-data"

export default function sitemap(): MetadataRoute.Sitemap {
  return getSitemapItems()
}
