"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Code2, Menu, Terminal } from "lucide-react"
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs"
import { useWorkspace } from "@/hooks/use-workspace"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Debug guides", href: "/tools" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
] as const

export function Header() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { email, kind, href: workspaceHref, label: workspaceLabel } = useWorkspace()
  const workspace = {
    href: workspaceHref,
    label: workspaceLabel,
    Icon: kind === "ide" ? Code2 : Terminal,
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const isActive = (href: string) => !href.includes("#") && (pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)))

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-300",
        scrolled
          ? "border-border bg-background/80 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <Logo />

        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <li key={label}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  isActive(href) && "text-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={workspace.href}
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/15"
            >
              <workspace.Icon className="size-4" aria-hidden />
              {workspace.label}
            </Link>
          </li>
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">Sign in</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button size="sm">Start Debugging</Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(20rem,90vw)] border-border bg-background">
            <SheetHeader>
              <SheetTitle>
                <Logo onClick={() => setOpen(false)} />
              </SheetTitle>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>
            </SheetHeader>

            <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
              {NAV_LINKS.map(({ label, href }) => (
                <SheetClose asChild key={label}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? "page" : undefined}
                    className="rounded-lg px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground aria-[current=page]:text-foreground"
                  >
                    {label}
                  </Link>
                </SheetClose>
              ))}
              <SheetClose asChild>
                <Link
                  href={workspace.href}
                  className="mt-1 inline-flex items-center gap-2 rounded-lg border border-brand/25 bg-brand/10 px-3 py-3 text-base font-semibold text-brand"
                >
                  <workspace.Icon className="size-4" aria-hidden />
                  {workspace.label}
                </Link>
              </SheetClose>
            </nav>

            <div className="mt-auto flex flex-col gap-2 border-t border-border p-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="outline" onClick={() => setOpen(false)}>Sign in</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button onClick={() => setOpen(false)}>Start Debugging</Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <SheetClose asChild>
                  <Button asChild variant="outline">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                </SheetClose>
                <div className="flex items-center gap-3 px-1 pt-1">
                  <UserButton afterSignOutUrl="/" />
                  <span className="truncate text-sm text-muted-foreground">{email}</span>
                </div>
              </SignedIn>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
