"use client"

import { track } from "@/lib/analytics"

export type FeedbackSurface = "guest_demo" | "shared_result" | "community_example" | "tool_page"

/** Helpful / not helpful for visitors who may not be signed in. Never sends page content. */
export async function sendGuestFeedback(surface: FeedbackSurface, helpful: boolean, comment?: string): Promise<boolean> {
  try {
    const res = await fetch("/api/growth/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface, helpful, comment: comment?.trim() || undefined }),
    })
    if (res.ok) track("feedback_submitted", { surface, helpful, has_comment: !!comment?.trim() })
    return res.ok
  } catch {
    return false
  }
}
