"use client"

import { useUser } from "@clerk/nextjs"
import { classifyEmail } from "@/lib/emailClassifier"

export type WorkspaceKind = "ide" | "devmode"

/**
 * Which workspace the current visitor should land in. Mirrors the existing
 * routing rule: student emails (.edu / .ac.in) → IDE, personal and company
 * emails → Dev Mode, signed-out visitors → IDE.
 */
export function useWorkspace() {
  const { user, isSignedIn, isLoaded } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? ""
  const type = isSignedIn && email ? classifyEmail(email) : null
  const kind: WorkspaceKind = !isSignedIn || type === "student" ? "ide" : "devmode"
  return {
    isLoaded,
    isSignedIn: !!isSignedIn,
    email,
    kind,
    href: kind === "ide" ? "/ide" : "/devmode",
    label: kind === "ide" ? "IDE" : "Dev Mode",
  }
}
