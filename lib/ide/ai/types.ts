export type Role = "system" | "user" | "assistant"
export interface ChatMsg { role: Role; content: string }

/** A user-visible failure with a stable code, so the UI can offer the right recovery. */
export class ChatError extends Error {
  code: string
  retryable: boolean
  status: number
  constructor(code: string, message: string, status = 500, retryable = false) {
    super(message)
    this.name = "ChatError"
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

/** One way of producing text. The UI only talks to this interface; it never knows which engine runs. */
export interface ChatProvider {
  readonly kind: "local" | "cloud"
  stream(messages: ChatMsg[], signal: AbortSignal): AsyncGenerator<string>
}
