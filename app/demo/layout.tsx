import type { Metadata } from "next"
import type React from "react"
import { buildMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = buildMetadata({
  title: "Errorless Demo: Try the Debugging Workspace",
  description: "Try the Errorless debugging workspace on sample code. See how it finds the root cause of an error and suggests the smallest safe fix.",
  path: "/demo",
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
