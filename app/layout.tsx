import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClerkClientProvider } from "@/components/clerk-provider"
import { ConvexClientProvider } from "@/components/convex-provider"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0b",
}

export const metadata: Metadata = {
  title: "Errorless - AI-Powered Code Error Solver | Real-Time Debugging",
  description:
    "Errorless is an AI-powered code error solver that provides context-aware live error detection and fixes. Collaborate with your team, share fixes, and build better code faster.",
  keywords: [
    "code error solver",
    "AI debugging",
    "code assistant",
    "error detection",
    "live error solver",
    "collaborative coding",
    "developer tools",
  ],
  generator: "v0.app",
  applicationName: "Errorless",
  authors: [{ name: "Errorless Team" }],
  creator: "Errorless",
  publisher: "Errorless",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://errorless.dev",
    siteName: "Errorless",
    title: "Errorless - AI-Powered Code Error Solver",
    description: "Real-time error detection and AI-powered fixes for developers",
    images: [
      {
        url: "/ai-code-error-solver-dashboard.jpg",
        width: 1200,
        height: 1200,
        alt: "Errorless - AI Code Error Solver",
        type: "image/svg+xml",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Errorless - AI-Powered Code Error Solver",
    description: "Real-time error detection and AI-powered fixes for developers",
    images: ["/ai-code-error-solver.jpg"],
  },
  alternates: {
    canonical: "https://errorless.dev",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Errorless",
              description: "AI-powered code error solver with real-time debugging and team collaboration",
              url: "https://errorless.dev",
              applicationCategory: "DeveloperApplication",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: "4.8",
                ratingCount: "1250",
              },
            }),
          }}
        />
        <meta name="theme-color" content="#0a0a0b" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`font-sans antialiased`}>
        <ClerkClientProvider>
          <ConvexClientProvider>
            {children}
            <Analytics />
          </ConvexClientProvider>
        </ClerkClientProvider>
      </body>
    </html>
  )
}
