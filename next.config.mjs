/** Paths that must never be indexed (kept in sync with NOINDEX_PATHS in lib/seo/site.ts). */
const NOINDEX = ["dashboard", "devmode", "profile", "editor", "ide", "admin", "sign-in", "sign-up", "auth", "login", "signup", "sso-callback", "quiz", "learn"]

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
      // Long-lived caching for the static brand images served from /public.
      { source: "/:file(errorless-logo.jpg|upi-qr.png|favicon.ico)", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ]
  },
}

export default nextConfig
