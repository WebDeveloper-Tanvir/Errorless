import type { Metadata } from "next"
import type React from "react"
import { privateMetadata } from "@/lib/seo/metadata"

// The IDE works on the user's own files: never indexed.
export const metadata: Metadata = privateMetadata("IDE | Errorless")

export default function IDELayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
