"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"

export function Hero() {
  return (
    <section className="relative w-full overflow-hidden bg-background py-12 sm:py-20 lg:py-32">
      {/* Animated background gradients */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full mix-blend-normal filter blur-[128px] animate-pulse delay-700" />
      </div>

      <div className="relative container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center text-center gap-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Error Solving</span>
          </div>

          {/* Main Heading */}
          <div className="space-y-4 max-w-3xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance">
              Never Get Stuck on Code Errors Again
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground text-balance">
              Errorless uses AI to detect, analyze, and fix code errors in real-time. Collaborate with your team and
              share fixes instantly.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/sign-up">
              <Button size="lg" className="gap-2">
                Start Free Trial
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline">
                Watch Demo
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 pt-8 border-t border-border/40 w-full">
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl sm:text-3xl font-bold">10K+</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Developers</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl sm:text-3xl font-bold">50M+</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Errors Fixed</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="text-2xl sm:text-3xl font-bold">99.9%</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Uptime</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
