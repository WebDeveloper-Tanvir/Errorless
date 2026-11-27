import { notFound } from "next/navigation"
import { ogImage, OG_SIZE } from "@/lib/seo/og"
import { TOOL_PAGES, getTool } from "@/lib/seo/tools"

export const alt = "Errorless debugging guide"
export const size = OG_SIZE
export const contentType = "image/png"

export function generateStaticParams() {
  return TOOL_PAGES.map((t) => ({ slug: t.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const tool = getTool((await params).slug)
  if (!tool) notFound()
  return ogImage(tool.name, `${tool.errors.length} common errors explained, with causes and minimal fixes.`, tool.errors.slice(0, 3).map((e) => e.title.split(":")[0].split(" (")[0]))
}
