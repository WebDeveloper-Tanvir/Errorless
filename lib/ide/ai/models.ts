/**
 * Curated local models for WebLLM (WebGPU). Every id here is checked against the installed
 * `@mlc-ai/web-llm` prebuiltAppConfig by tests/ide-ai.test.ts, so the list cannot silently go stale.
 * `vramMB` is what WebLLM reports for the q4f16 build; the q4f32 build needs about 15-30% more.
 */
export interface LocalModel {
  key: string
  label: string
  /** Build used when the GPU supports shader-f16 (smaller, faster). */
  f16: string
  /** Fallback build for GPUs without shader-f16. */
  f32: string
  vramMB: number
  note: string
}

export const LOCAL_MODELS: readonly LocalModel[] = [
  { key: "qwen-coder-0.5b", label: "Qwen2.5-Coder 0.5B", f16: "Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC", vramMB: 945, note: "Fastest and smallest. Good for quick questions; weak on hard bugs." },
  { key: "qwen-coder-1.5b", label: "Qwen2.5-Coder 1.5B", f16: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC", vramMB: 1630, note: "Best starting point for most laptops." },
  { key: "qwen-coder-3b", label: "Qwen2.5-Coder 3B", f16: "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-Coder-3B-Instruct-q4f32_1-MLC", vramMB: 2505, note: "Noticeably better code reasoning. Wants a GPU with about 4 GB free." },
  { key: "qwen-coder-7b", label: "Qwen2.5-Coder 7B", f16: "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-Coder-7B-Instruct-q4f32_1-MLC", vramMB: 5107, note: "Strongest option here. Needs a dedicated GPU with about 8 GB." },
  { key: "llama-3.2-3b", label: "Llama 3.2 3B", f16: "Llama-3.2-3B-Instruct-q4f16_1-MLC", f32: "Llama-3.2-3B-Instruct-q4f32_1-MLC", vramMB: 2264, note: "General-purpose, good at explanations." },
]

export const DEFAULT_LOCAL_MODEL = "qwen-coder-1.5b"
export const modelByKey = (key: string) => LOCAL_MODELS.find((m) => m.key === key)
export const pickBuild = (m: LocalModel, hasF16: boolean) => (hasF16 ? m.f16 : m.f32)
/** Approximate download size is roughly the VRAM figure for 4-bit builds; shown as a hint only. */
export const approxDownloadMB = (m: LocalModel) => Math.round(m.vramMB * 0.8)
export const fmtGB = (mb: number) => `${(mb / 1024).toFixed(1)} GB`
