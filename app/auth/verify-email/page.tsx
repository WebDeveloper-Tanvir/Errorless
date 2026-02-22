"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function VerifyEmailPage() {
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const verifyEmail = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.getSession()

      if (error || !data?.session) {
        setError("Email verification failed. Please try signing up again.")
        setIsVerifying(false)
        return
      }

      // Email verified successfully
      setTimeout(() => {
        router.push("/dashboard")
      }, 2000)
    }

    verifyEmail()
  }, [router])

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-background to-background/80">
      <div className="w-full max-w-sm">
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-2 text-center">
            <div className="text-4xl mb-4">{isVerifying ? "⏳" : "✓"}</div>
            <CardTitle className="text-2xl">{isVerifying ? "Verifying Email" : "Email Verified"}</CardTitle>
            <CardDescription>{isVerifying ? "Please wait..." : "Redirecting to dashboard..."}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="space-y-4">
                <p className="text-sm text-red-500">{error}</p>
                <Button onClick={() => router.push("/auth/sign-up")} className="w-full">
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
