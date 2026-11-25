"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ViralGrowthGate } from "@/components/viral-growth-gate"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/landing/section-heading"
import { StartDebuggingButton } from "@/components/landing/start-debugging-button"
import { WorkspacePreview } from "@/components/landing/workspace-preview"

export default function DemoPage() {
  const [showGate, setShowGate] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main">
        <section className="bg-mesh pb-16 pt-16 sm:pt-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading
              as="h1"
              eyebrow="Demo"
              title="Try the analyzer on real code"
              description="Edit any sample or paste your own over it. Findings update as you type, all in your browser."
            />
            <div className="mt-12">
              <WorkspacePreview height={440} />
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
            <h2 className="text-xl font-semibold">Want deeper analysis?</h2>
            <p className="text-sm text-muted-foreground">
              Share Errorless to unlock advanced error analysis, or open Dev Mode for AI review of logic, security and
              performance.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" onClick={() => setShowGate(true)} disabled={unlocked}>
                {unlocked ? "Advanced Error Analysis unlocked" : "Unlock Advanced Error Analysis"}
              </Button>
              <StartDebuggingButton size="default" />
            </div>
            <p role="status" className="min-h-5 text-sm text-success">
              {unlocked ? "Feature unlocked." : ""}
            </p>
          </div>
        </section>
      </main>
      <Footer />

      {showGate && (
        <ViralGrowthGate
          feature="Advanced Error Analysis"
          onUnlock={() => {
            setShowGate(false)
            setUnlocked(true)
          }}
        />
      )}
    </div>
  )
}
