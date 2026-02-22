"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CTA() {
  return (
    <section className="w-full py-12 sm:py-20 lg:py-32 bg-background">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-8 sm:p-12 lg:p-16 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full mix-blend-normal filter blur-[128px]" />
          </div>

          <div className="relative flex flex-col items-center justify-center text-center gap-8">
            <div className="space-y-4 max-w-2xl">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance">
                Ready to Stop Debugging?
              </h2>
              <p className="text-lg text-muted-foreground text-balance">
                Join thousands of developers who are already using Errorless to write better code, faster.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/sign-up">
                <Button size="lg" className="gap-2">
                  Start Your Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline">
                  Schedule Demo
                </Button>
              </Link>
            </div>

            <p className="text-sm text-muted-foreground">No credit card required. Get started in seconds.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
