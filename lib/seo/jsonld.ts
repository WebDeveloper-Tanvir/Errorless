import { SITE_NAME, SITE_URL, absoluteUrl, DEFAULT_DESCRIPTION } from "./site.ts"
import type { ToolPage } from "./tools.ts"
import { toolPath } from "./tools.ts"

/**
 * Structured data builders. Only facts that are true and visible on the page:
 * no ratings, reviews, prices or awards.
 */
type Json = Record<string, unknown>

/** JSON for a <script type="application/ld+json">. "<" is escaped so content can never close the tag. */
export function serializeJsonLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => (c === "\u2028" ? "\\u2028" : "\\u2029"))
}

export function organizationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/errorless-logo.jpg"),
    sameAs: ["https://github.com/WebDeveloper-Tanvir/Errorless"],
  }
}

export function websiteLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
  }
}

export function softwareLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    url: SITE_URL,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description: "Debugging assistant that explains error messages and stack traces and suggests minimal fixes.",
    publisher: { "@id": `${SITE_URL}/#organization` },
  }
}

export function breadcrumbLd(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  }
}

export function faqLd(faqs: { q: string; a: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }
}

export function toolPageLd(tool: ToolPage): Json {
  const url = absoluteUrl(toolPath(tool.slug))
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: tool.name,
    description: tool.metaDescription,
    inLanguage: "en",
    dateModified: tool.updated,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@type": "Thing", name: `${tool.navLabel} errors` },
    mainEntity: {
      "@type": "SoftwareApplication",
      name: tool.name,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url,
    },
  }
}

export function itemListLd(name: string, items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: absoluteUrl(it.path) })),
  }
}
