import { serializeJsonLd } from "@/lib/seo/jsonld"

/** Renders structured data as JSON-LD. Server component: costs no client JavaScript. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
