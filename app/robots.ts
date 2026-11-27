import type { MetadataRoute } from "next"
import { getRobotsRules } from "@/lib/seo/robots-rules"

export default function robots(): MetadataRoute.Robots {
  return getRobotsRules()
}
