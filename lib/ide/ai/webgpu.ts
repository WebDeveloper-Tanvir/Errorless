export interface WebGpuStatus {
  supported: boolean
  /** shader-f16 lets WebLLM use the smaller q4f16 builds. */
  f16: boolean
  reason?: string
  adapter?: string
}

interface GpuLike { requestAdapter(): Promise<{ features: { has(f: string): boolean }; info?: { description?: string; vendor?: string; architecture?: string } } | null> }

/** Why WebGPU is unavailable, in words a user can act on. `nav` is injectable for tests. */
export async function detectWebGpu(nav: { gpu?: GpuLike } | undefined = typeof navigator === "undefined" ? undefined : (navigator as unknown as { gpu?: GpuLike }), secure = typeof window === "undefined" ? true : window.isSecureContext): Promise<WebGpuStatus> {
  if (!secure) return { supported: false, f16: false, reason: "WebGPU needs a secure context (HTTPS or localhost)." }
  if (!nav?.gpu) return { supported: false, f16: false, reason: "This browser does not expose WebGPU. Use a recent Chrome or Edge (113+) on desktop, or Safari 18+ / Firefox with WebGPU enabled." }
  try {
    const adapter = await nav.gpu.requestAdapter()
    if (!adapter) return { supported: false, f16: false, reason: "WebGPU is present but no GPU adapter was found. Update your graphics driver, or check that hardware acceleration is on in browser settings." }
    const i = adapter.info
    return { supported: true, f16: adapter.features.has("shader-f16"), adapter: [i?.vendor, i?.architecture, i?.description].filter(Boolean).join(" ") || undefined }
  } catch (e) {
    return { supported: false, f16: false, reason: `WebGPU failed to start: ${e instanceof Error ? e.message : String(e)}` }
  }
}
