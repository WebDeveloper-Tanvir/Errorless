import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  /** Called when the logo link is activated (e.g. to close a mobile menu). */
  onClick?: () => void
}

/** Errorless wordmark + mark. Always links home. */
export function Logo({ className, onClick }: LogoProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label="Errorless home"
      className={cn("group inline-flex items-center gap-2.5 rounded-lg", className)}
    >
      <span className="relative inline-flex size-9 shrink-0">
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl bg-brand-gradient opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-50"
        />
        <Image
          src="/errorless-logo.jpg"
          alt=""
          width={36}
          height={36}
          className="relative size-9 rounded-xl object-cover ring-1 ring-white/10"
          priority
        />
      </span>
      <span className="text-[1.05rem] font-bold tracking-tight">
        <span className="text-brand">error</span>
        <span className="text-foreground">less</span>
      </span>
    </Link>
  )
}
