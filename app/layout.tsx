import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClerkClientProvider } from "@/components/clerk-provider"
import { AnalyticsEvents } from "@/components/analytics-events"
import { ReferralTracker } from "@/components/growth/referral-tracker"
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo/site"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" })

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#080d18",
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Pages set their own absolute title; this template covers any page that only sets a short one.
  title: { default: "Errorless: AI Error Debugger That Finds the Root Cause", template: "%s | Errorless" },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Errorless Team" }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/errorless-logo.jpg", type: "image/jpeg" },
    ],
    apple: [{ url: "/errorless-logo.jpg" }],
    shortcut: "/favicon.ico",
  },
  // No canonical here: a site-wide canonical would point every page at the home page.
  // Each public page sets its own with buildMetadata().
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: { type: "website", locale: "en_US", siteName: SITE_NAME },
  twitter: { card: "summary_large_image" },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/errorless-logo.jpg" type="image/jpeg" />
        <link rel="apple-touch-icon" href="/errorless-logo.jpg" />
        <link rel="shortcut icon" href="/favicon.ico" />

        {/* Brand theme color */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

      </head>
      <body>
        <ClerkClientProvider>
          {children}
          <AnalyticsEvents />
          <ReferralTracker />
          <Analytics />
        </ClerkClientProvider>
      </body>
    </html>
  )
}
