"use client"

import Link from "next/link"
import { ArrowUpRight, BookText, Code2, FileCode2, Terminal } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Skeleton } from "@/components/ui/skeleton"
import { useWorkspace, type WorkspaceKind } from "@/hooks/use-workspace"
import { accountLabel, classifyEmail } from "@/lib/emailClassifier"
import { cn } from "@/lib/utils"

const WORKSPACES: {
  kind: WorkspaceKind | "editor"
  href: string
  title: string
  body: string
  icon: LucideIcon
}[] = [
  {
    kind: "devmode",
    href: "/devmode",
    title: "Dev Mode",
    body: "AI analysis, code generation and optimization with saved session memory.",
    icon: Terminal,
  },
  {
    kind: "ide",
    href: "/ide",
    title: "IDE",
    body: "Monaco editor with file explorer, terminal and an assistant that analyzes attached files.",
    icon: Code2,
  },
  {
    kind: "editor",
    href: "/editor",
    title: "Quick editor",
    body: "Paste a snippet and see line-accurate issues instantly. No setup.",
    icon: FileCode2,
  },
]

export default function DashboardPage() {
  const { user, isLoaded } = useUser()
  const { kind } = useWorkspace()

  const email = user?.primaryEmailAddress?.emailAddress ?? ""
  const name = user?.firstName || user?.fullName || email.split("@")[0] || "there"
  const type = email ? classifyEmail(email) : null

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10">
          {isLoaded ? (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-brand">
                {type ? accountLabel(type) : "Dashboard"}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {name}</h1>
              <p className="mt-2 text-muted-foreground">Pick a workspace and start debugging.</p>
            </>
          ) : (
            <div className="space-y-3" aria-busy="true" aria-label="Loading dashboard">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-72" />
              <Skeleton className="h-4 w-56" />
            </div>
          )}
        </header>

        <section aria-labelledby="workspaces-heading">
          <h2 id="workspaces-heading" className="sr-only">Workspaces</h2>
          <ul className="grid gap-5 md:grid-cols-3">
            {WORKSPACES.map(({ kind: k, href, title, body, icon: Icon }) => {
              const recommended = k === kind
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-card transition-colors hover:border-brand/40",
                      recommended ? "border-brand/40" : "border-border",
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/20">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <ArrowUpRight
                        className="size-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
                        aria-hidden
                      />
                    </div>
                    <h3 className="mt-5 flex items-center gap-2 text-lg font-semibold">
                      {title}
                      {recommended && (
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                          Recommended
                        </span>
                      )}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="resources-heading" className="mt-12">
          <h2 id="resources-heading" className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Resources
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            <li>
              <Link href="/docs" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm transition-colors hover:border-brand/40">
                <BookText className="size-5 text-violet-soft" aria-hidden />
                <span><span className="font-medium">Documentation</span><span className="block text-muted-foreground">How analysis works and how your code is handled</span></span>
              </Link>
            </li>
            <li>
              <Link href="/profile" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm transition-colors hover:border-brand/40">
                <FileCode2 className="size-5 text-violet-soft" aria-hidden />
                <span><span className="font-medium">Profile &amp; settings</span><span className="block text-muted-foreground">Account details, security and saved data</span></span>
              </Link>
            </li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  )
}
