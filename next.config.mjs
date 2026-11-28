/** Paths that must never be indexed (kept in sync with NOINDEX_PATHS in lib/seo/site.ts). */
const NOINDEX = ["dashboard", "devmode", "profile", "editor", "ide", "admin", "sign-in", "sign-up", "auth", "login", "signup", "sso-callback", "invite", "s", "quiz", "learn"]

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  poweredByHeader: false,
  images: {
    // Serve AVIF/WebP, resized to the rendered size, instead of the original JPEG/PNG.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Import only the icons/components used instead of whole packages.
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  async headers() {
    const robots = { key: "X-Robots-Tag", value: "noindex, nofollow" }
    return [
      { source: "/api/:path*", headers: [robots] },
      ...NOINDEX.map((p) => ({ source: `/${p}/:path*`, headers: [robots] })),
      ...NOINDEX.map((p) => ({ source: `/${p}`, headers: [robots] })),
      // Shared results: never cached, never leak the secret URL through the Referer header.
      { source: "/s/:token", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "private, no-store" }] },
      // Self-hosted Python/TypeScript runtimes. The Python worker lives in a sandboxed frame with an opaque
      // origin, so it fetches these cross-origin: CORS + CORP must allow it. Static, public files only.
      { source: "/ide-runtime/:path*", headers: [
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
      ] },
      // Long-lived caching for the static brand images served from /public.
      { source: "/:file(errorless-logo.jpg|upi-qr.png|favicon.ico)", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ]
  },
}

export default nextConfig
