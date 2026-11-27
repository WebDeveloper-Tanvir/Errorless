import { ImageResponse } from "next/og"

export const OG_SIZE = { width: 1200, height: 630 }

/** Branded 1200x630 social card. System fonts only: no network access at build time. */
export function ogImage(title: string, subtitle: string, chips: string[] = []) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: 72, background: "#080D18", backgroundImage: "radial-gradient(circle at 15% 0%, rgba(0,207,255,0.22), transparent 55%), radial-gradient(circle at 90% 100%, rgba(139,92,246,0.25), transparent 55%)",
          color: "#E8EEF9", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 700 }}>
          <span style={{ color: "#00CFFF" }}>error</span>
          <span>less</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>{title}</div>
          <div style={{ marginTop: 24, fontSize: 30, color: "#8E9BB4", lineHeight: 1.35 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex" }}>
          {chips.map((c) => (
            <div key={c} style={{ marginRight: 14, padding: "8px 18px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.35)", fontSize: 24, color: "#B8C3D9" }}>{c}</div>
          ))}
        </div>
      </div>
    ),
    OG_SIZE,
  )
}
