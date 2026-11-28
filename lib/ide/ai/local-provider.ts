import { ChatError, type ChatMsg, type ChatProvider } from "./types.ts"
import { detectWebGpu } from "./webgpu.ts"
import { modelByKey, pickBuild } from "./models.ts"

export type LocalPhase = "idle" | "checking" | "downloading" | "ready" | "error"
export interface LocalProgress { phase: LocalPhase; text: string; fraction: number }

type Engine = {
  chat: { completions: { create(r: unknown): Promise<AsyncIterable<{ choices: { delta: { content?: string | null } }[] }>> } }
  interruptGenerate(): void
  unload(): Promise<void>
}

/**
 * In-browser model through WebLLM (WebGPU). Nothing is fetched until `load()` is called, which the UI
 * only does after the user chooses a model. Weights are cached by the browser, so later loads are fast.
 * Prompts and code never leave the device.
 */
export class LocalProvider implements ChatProvider {
  readonly kind = "local" as const
  private engine: Engine | null = null
  private loadedKey: string | null = null
  private busy = false

  get loaded() { return this.loadedKey }

  async load(modelKey: string, onProgress: (p: LocalProgress) => void): Promise<void> {
    if (this.loadedKey === modelKey && this.engine) { onProgress({ phase: "ready", text: "Model ready.", fraction: 1 }); return }
    const model = modelByKey(modelKey)
    if (!model) throw new ChatError("model", "Unknown model.")
    onProgress({ phase: "checking", text: "Checking WebGPU…", fraction: 0 })
    const gpu = await detectWebGpu()
    if (!gpu.supported) throw new ChatError("no_webgpu", gpu.reason ?? "WebGPU is not available.")
    const modelId = pickBuild(model, gpu.f16)
    await this.unload()
    try {
      const web = await import("@mlc-ai/web-llm")
      if (!web.prebuiltAppConfig.model_list.some((m) => m.model_id === modelId)) {
        throw new ChatError("model", `This version of WebLLM does not include ${modelId}. Pick another model.`)
      }
      onProgress({ phase: "downloading", text: `Loading ${model.label}…`, fraction: 0 })
      this.engine = (await web.CreateMLCEngine(modelId, {
        initProgressCallback: (r) => onProgress({ phase: "downloading", text: r.text, fraction: Math.max(0, Math.min(1, r.progress)) }),
      })) as unknown as Engine
      this.loadedKey = modelKey
      onProgress({ phase: "ready", text: "Model ready.", fraction: 1 })
    } catch (e) {
      this.engine = null
      this.loadedKey = null
      if (e instanceof ChatError) throw e
      const msg = e instanceof Error ? e.message : String(e)
      const oom = /out of memory|OOM|allocation|device lost|maxBufferSize|too large/i.test(msg)
      throw new ChatError(oom ? "memory" : "load", oom ? `Not enough GPU memory for ${model.label}. Choose a smaller model. (${msg})` : `The model failed to load: ${msg}`, 0, true)
    }
  }

  async unload() {
    try { await this.engine?.unload() } catch { /* already gone */ }
    this.engine = null
    this.loadedKey = null
  }

  async *stream(messages: ChatMsg[], signal: AbortSignal): AsyncGenerator<string> {
    const engine = this.engine
    if (!engine) throw new ChatError("not_loaded", "No local model is loaded. Choose a model and download it first.")
    if (this.busy) throw new ChatError("busy", "The model is still answering. Stop it first.")
    this.busy = true
    const onAbort = () => engine.interruptGenerate()
    signal.addEventListener("abort", onAbort)
    try {
      const chunks = await engine.chat.completions.create({ messages, stream: true, temperature: 0.2, max_tokens: 2048 })
      for await (const c of chunks) {
        if (signal.aborted) break
        const t = c.choices[0]?.delta?.content
        if (t) yield t
      }
      if (signal.aborted) throw new DOMException("Aborted", "AbortError")
    } catch (e) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError")
      throw e instanceof ChatError ? e : new ChatError("generate", `Generation failed: ${e instanceof Error ? e.message : String(e)}`, 0, true)
    } finally {
      signal.removeEventListener("abort", onAbort)
      this.busy = false
    }
  }
}
