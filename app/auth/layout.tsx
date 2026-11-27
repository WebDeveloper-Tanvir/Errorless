import type { Metadata } from "next"
import type React from "react"
import { privateMetadata } from "@/lib/seo/metadata"

// Private or transactional area: never indexed, links not followed.
export const metadata: Metadata = privateMetadata("Account | Errorless")

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
