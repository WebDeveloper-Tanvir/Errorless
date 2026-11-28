import Link from "next/link"
import { Github } from "lucide-react"
import { Logo } from "@/components/logo"
import { TOOL_PAGES, toolPath } from "@/lib/seo/tools"

// Only routes that exist today. Add legal/social links here once those pages
// or profiles exist, rather than shipping placeholder "#" links.
const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "Demo", href: "/demo" },
    ],
  },
  {
    title: "Debugging guides",
    links: [
      { label: "All guides", href: "/tools" },
      { label: "Debugging examples", href: "/community" },
      ...TOOL_PAGES.map((t) => ({ label: t.name, href: toolPath(t.slug) })),
    ],
  },
  {
    title: "Workspaces",
    links: [
      { label: "Dev Mode", href: "/devmode" },
      { label: "IDE", href: "/ide" },
      { label: "Editor", href: "/editor" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
] as const

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="flex max-w-xs flex-col gap-4">
            <Logo />
            <p className="text-sm leading-relaxed text-muted-foreground">
              AI-powered error diagnosis for developers. Paste the bug, get the cause and the fix.
            </p>
            <a
              href="https://github.com/WebDeveloper-Tanvir/Errorless"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Errorless on GitHub (opens in a new tab)"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand"
            >
              <Github className="size-4" aria-hidden />
            </a>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground/80">
                {col.title}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Errorless. All rights reserved.</p>
          <p className="font-mono">Stop fighting bugs. Start building.</p>
        </div>
      </div>
    </footer>
  )
}
