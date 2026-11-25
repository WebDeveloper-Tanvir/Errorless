"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SignUpButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/hooks/use-workspace"

interface StartDebuggingButtonProps {
  size?: "default" | "lg" | "sm"
  className?: string
  label?: string
}

/** Primary CTA: opens sign-up for visitors, jumps into the workspace if signed in. */
export function StartDebuggingButton({ size = "lg", className, label = "Start Debugging" }: StartDebuggingButtonProps) {
  const { isSignedIn, href } = useWorkspace()

  if (isSignedIn) {
    return (
      <Button asChild size={size} className={className}>
        <Link href={href}>
          {label}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    )
  }

  return (
    <SignUpButton mode="modal">
      <Button size={size} className={className}>
        {label}
        <ArrowRight aria-hidden />
      </Button>
    </SignUpButton>
  )
}
