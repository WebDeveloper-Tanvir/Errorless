import { z } from "zod"

export const CHAT_LIMITS = { maxMessages: 24, maxMessageChars: 40_000, maxTotalChars: 80_000 }

const message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(CHAT_LIMITS.maxMessageChars),
})

export const chatRequestSchema = z
  .object({ messages: z.array(message).min(1).max(CHAT_LIMITS.maxMessages) })
  .strict()
  .refine((v) => v.messages[v.messages.length - 1]?.role === "user", { message: "The last message must be from the user." })
  .refine((v) => v.messages.reduce((n, m) => n + m.content.length, 0) <= CHAT_LIMITS.maxTotalChars, { message: "The conversation is too long. Start a new one." })

export type ChatRequest = z.infer<typeof chatRequestSchema>

export function parseChatRequest(body: unknown): { ok: true; value: ChatRequest } | { ok: false; error: string } {
  const r = chatRequestSchema.safeParse(body)
  if (r.success) return { ok: true, value: r.data }
  const first = r.error.issues[0]
  return { ok: false, error: first ? `${first.path.join(".") || "request"}: ${first.message}` : "Invalid request." }
}
