"use client"

import { Card } from "@/components/ui/card"
import { Zap, Brain, Users, Lock, BarChart3, Rocket } from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description: "Context-aware error detection that understands your code and provides intelligent solutions.",
  },
  {
    icon: Zap,
    title: "Real-Time Fixes",
    description: "Get instant error fixes without leaving your editor. Apply suggestions with one click.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Share fixes with your team, build a library of solutions, and learn together.",
  },
  {
    icon: Lock,
    title: "Secure & Private",
    description: "Your code stays private. Enterprise-grade security with end-to-end encryption.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Track error patterns, team productivity, and code quality metrics in real-time.",
  },
  {
    icon: Rocket,
    title: "Lightning Fast",
    description: "Optimized for speed. Get results in milliseconds, not seconds.",
  },
]

export function Features() {
  return (
    <section id="features" className="w-full py-12 sm:py-20 lg:py-32 bg-card/30">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center text-center gap-8 mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance">
            Powerful Features for Modern Developers
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl text-balance">
            Everything you need to write better code, faster. From error detection to team collaboration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card key={index} className="p-6 hover:border-primary/50 transition-colors group">
                <div className="flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-lg">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
