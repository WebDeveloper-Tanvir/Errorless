"use client"

import Link from "next/link"
import { useState } from "react"

interface NavbarProps {
  currentPage?: string
}

export function Navbar({ currentPage }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <nav className="navbar">
        {/* Logo */}
        <Link href="/" className="navbar-logo">
          <span className="logo-lt">&lt;</span>
          <span>Errorless</span>
          <span className="logo-lt">/&gt;</span>
        </Link>

        {/* Desktop links */}
        <div className="navbar-links">
          <Link href="/learn" className={`nav-link ${currentPage === "learn" ? "nav-link-active" : ""}`}>
            Learn
          </Link>
          <Link href="/ide" className={`nav-link ${currentPage === "ide" ? "nav-link-active" : ""}`}>
            IDE
          </Link>
          {/* ── DEV MODE — the new item ── */}
          <Link href="/devmode" className="nav-link nav-link-devmode">
            <span className="devmode-icon">⚙</span>
            Dev Mode
            <span className="devmode-badge">NEW</span>
          </Link>
          <Link href="/pricing" className={`nav-link ${currentPage === "pricing" ? "nav-link-active" : ""}`}>
            Pricing
          </Link>
        </div>

        {/* Desktop CTA */}
        <div className="navbar-cta">
          <Link href="/login" className="cta-ghost">Sign In</Link>
          <Link href="/register" className="cta-primary">Start Free →</Link>
        </div>

        {/* Mobile hamburger */}
        <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          <span className={`ham ${mobileOpen ? "ham-open" : ""}`} />
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="mobile-menu">
          <Link href="/learn" className="m-link" onClick={() => setMobileOpen(false)}>Learn</Link>
          <Link href="/ide" className="m-link" onClick={() => setMobileOpen(false)}>IDE</Link>
          <Link href="/devmode" className="m-link m-link-devmode" onClick={() => setMobileOpen(false)}>
            ⚙ Dev Mode <span className="m-badge">NEW</span>
          </Link>
          <Link href="/pricing" className="m-link" onClick={() => setMobileOpen(false)}>Pricing</Link>
          <div className="m-divider" />
          <Link href="/login" className="m-link" onClick={() => setMobileOpen(false)}>Sign In</Link>
          <Link href="/register" className="m-primary" onClick={() => setMobileOpen(false)}>Start Free →</Link>
        </div>
      )}

      <style jsx>{`
        .navbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 2.5rem; height: 56px; position: sticky; top: 0; z-index: 100;
          background: rgba(5,8,16,0.88); backdrop-filter: blur(24px);
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .navbar-logo {
          font-family: 'Syne', 'Outfit', sans-serif; font-size: 1rem; font-weight: 900;
          text-decoration: none; color: #dce4f0; letter-spacing: 0.05em;
          display: flex; align-items: center; gap: 1px;
        }
        .logo-lt { color: #00ff88; }

        .navbar-links { display: flex; align-items: center; gap: 0.25rem; }
        .nav-link {
          color: #6b7a99; text-decoration: none; font-size: 0.875rem; font-weight: 500;
          padding: 0.4rem 0.85rem; border-radius: 8px; transition: all 0.15s;
          display: flex; align-items: center; gap: 0.35rem; position: relative;
        }
        .nav-link:hover { color: #dce4f0; background: rgba(255,255,255,0.05); }
        .nav-link-active { color: #dce4f0; background: rgba(255,255,255,0.06); }

        /* Dev Mode special styling */
        .nav-link-devmode {
          color: #f59e0b;
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.18);
        }
        .nav-link-devmode:hover {
          color: #fbbf24; background: rgba(245,158,11,0.14);
          border-color: rgba(245,158,11,0.3);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(245,158,11,0.15);
        }
        .devmode-icon { font-size: 0.8rem; }
        .devmode-badge {
          font-size: 0.58rem; font-weight: 800; background: #f59e0b; color: #050810;
          padding: 1px 5px; border-radius: 3px; letter-spacing: 0.05em;
        }

        .navbar-cta { display: flex; align-items: center; gap: 0.6rem; }
        .cta-ghost {
          color: #6b7a99; text-decoration: none; font-size: 0.85rem; padding: 0.4rem 0.8rem;
          border-radius: 8px; transition: color 0.15s;
        }
        .cta-ghost:hover { color: #dce4f0; }
        .cta-primary {
          background: #00ff88; color: #050810; text-decoration: none; padding: 0.45rem 1.1rem;
          border-radius: 8px; font-size: 0.85rem; font-weight: 700; transition: all 0.2s;
        }
        .cta-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 18px rgba(0,255,136,0.3); }

        .mobile-toggle {
          display: none; width: 32px; height: 32px; border: none; background: none;
          cursor: pointer; align-items: center; justify-content: center;
        }
        .ham { display: block; width: 20px; height: 2px; background: #dce4f0; position: relative; transition: all 0.2s; }
        .ham::before, .ham::after { content: ''; position: absolute; width: 20px; height: 2px; background: #dce4f0; transition: all 0.2s; }
        .ham::before { top: -6px; }
        .ham::after { top: 6px; }
        .ham-open { background: transparent; }
        .ham-open::before { transform: rotate(45deg) translate(4px, 4px); }
        .ham-open::after { transform: rotate(-45deg) translate(4px, -4px); }

        .mobile-menu {
          display: none; flex-direction: column; padding: 1rem 1.5rem 1.5rem;
          background: rgba(5,8,16,0.97); border-bottom: 1px solid rgba(255,255,255,0.07);
          position: sticky; top: 56px; z-index: 99;
        }
        .m-link { color: #6b7a99; text-decoration: none; font-size: 0.9rem; padding: 0.65rem 0; display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .m-link:hover { color: #dce4f0; }
        .m-link-devmode { color: #f59e0b; font-weight: 600; }
        .m-badge { font-size: 0.6rem; font-weight: 800; background: #f59e0b; color: #050810; padding: 1px 5px; border-radius: 3px; }
        .m-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 0.5rem 0; }
        .m-primary { background: #00ff88; color: #050810; text-decoration: none; text-align: center; padding: 0.7rem; border-radius: 8px; font-weight: 700; margin-top: 0.5rem; }

        @media (max-width: 768px) {
          .navbar { padding: 0 1.25rem; }
          .navbar-links, .navbar-cta { display: none; }
          .mobile-toggle { display: flex; }
          .mobile-menu { display: flex; }
        }
      `}</style>
    </>
  )
}