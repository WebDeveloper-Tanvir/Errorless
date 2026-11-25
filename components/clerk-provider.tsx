"use client"

import { ClerkProvider } from "@clerk/nextjs"
import type React from "react"

/** Clerk theme aligned with the Errorless design tokens (app/globals.css). */
const appearance = {
  variables: {
    colorPrimary: "#00cfff",
    colorTextOnPrimaryBackground: "#04111c",
    colorBackground: "#0d1424",
    colorInputBackground: "#080d18",
    colorInputText: "#e8eef9",
    colorText: "#e8eef9",
    colorTextSecondary: "#8e9bb4",
    colorNeutral: "#e8eef9",
    colorDanger: "#f43f5e",
    colorSuccess: "#34d399",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
  },
  elements: {
    card: "shadow-none border border-[rgba(148,163,184,0.14)]",
    formButtonPrimary: "font-semibold",
  },
} as const

export function ClerkClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={appearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {children}
    </ClerkProvider>
  )
}
