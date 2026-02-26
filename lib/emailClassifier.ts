/**
 * Errorless — Email Classifier
 *
 * Determines user type from email address:
 *  "student"  → .edu / .ac.in / university domains  → shows IDE in navbar
 *  "personal" → gmail / yahoo / consumer domains    → shows Dev Mode in navbar
 *  "org"      → custom company/org domain           → shows Dev Mode in navbar
 */

export type UserType = "student" | "personal" | "org"

// ── All recognized educational TLD suffixes ────────────────────────────────
const EDU_TLDS = [
  // India
  ".edu.in", ".ac.in", ".k12.in", ".ernet.in",
  // USA
  ".edu",
  // UK
  ".ac.uk",
  // Australia
  ".edu.au", ".ac.nz",
  // South/Southeast Asia
  ".edu.sg", ".edu.pk", ".edu.bd", ".edu.np", ".edu.lk",
  ".edu.my", ".edu.ph", ".edu.vn", ".edu.hk",
  // South Africa
  ".ac.za",
  // East Asia
  ".ac.jp", ".ac.kr", ".edu.cn", ".edu.tw",
  // Latin America
  ".edu.br", ".edu.mx", ".edu.co", ".edu.ar", ".edu.pe", ".edu.cl",
  // Middle East / Africa
  ".edu.tr", ".edu.eg", ".ac.ir",
  // Others
  ".edu.pl", ".edu.gh", ".edu.ng",
  // Generic
  ".sch.id",
]

// ── Keywords in domain that strongly indicate educational institution ────────
const EDU_DOMAIN_KEYWORDS = [
  "university", "college", "institute", "school", "academy",
  "campus", "student", "alumni", "polytechnic", "seminary",
  "univ.", ".uni.", "iit.", "nit.", "iiit.", "bits.", "vit.",
  "gcet", "gtu.", "thapar", "manipal", "amity", "lpu.", "dtu.",
  "mit.", "stanford.", "harvard.", "oxford.", "cambridge.",
]

// ── Free / consumer email providers ────────────────────────────────────────
const PERSONAL_DOMAINS = new Set([
  // Google
  "gmail.com", "googlemail.com",
  // Microsoft
  "outlook.com", "hotmail.com", "hotmail.in", "hotmail.co.uk",
  "live.com", "live.in", "msn.com",
  // Yahoo
  "yahoo.com", "yahoo.in", "yahoo.co.in", "yahoo.co.uk",
  "yahoo.fr", "yahoo.de",
  // Apple
  "icloud.com", "me.com", "mac.com",
  // Privacy / open source
  "protonmail.com", "proton.me", "tutanota.com", "fastmail.com",
  // Indian
  "rediffmail.com",
  // Others
  "zoho.com", "yandex.com", "yandex.ru", "mail.com",
  "email.com", "inbox.com", "aol.com", "gmx.com", "gmx.net",
  "web.de", "libero.it", "virgilio.it",
])

/**
 * Classify an email into student | personal | org
 */
export function classifyEmail(email: string): UserType {
  if (!email?.includes("@")) return "personal"

  const lower = email.trim().toLowerCase()
  const domain = lower.split("@")[1]
  if (!domain) return "personal"

  // 1. Educational TLD check (highest confidence)
  for (const tld of EDU_TLDS) {
    if (domain.endsWith(tld)) return "student"
  }

  // 2. Bare .edu (e.g. mit.edu, stanford.edu)
  if (domain.endsWith(".edu")) return "student"

  // 3. Educational keyword in the domain
  for (const kw of EDU_DOMAIN_KEYWORDS) {
    if (domain.includes(kw)) return "student"
  }

  // 4. Known consumer / personal domain
  if (PERSONAL_DOMAINS.has(domain)) return "personal"

  // 5. Anything else = custom org domain
  return "org"
}

/**
 * What to show in the navbar for this user type
 */
export function getSmartNavItem(userType: UserType): {
  href: string
  label: string
  icon: string
  color: string
  badge: string | null
  description: string
} {
  if (userType === "student") {
    return {
      href: "/ide",
      label: "IDE",
      icon: "💻",
      color: "#58a6ff",
      badge: null,
      description: "Open your coding environment",
    }
  }
  return {
    href: "/devmode",
    label: "Dev Mode",
    icon: "⚙",
    color: "#f59e0b",
    badge: "NEW",
    description: "Generate · Analyze · Optimize",
  }
}

export function accountTypeLabel(userType: UserType): string {
  if (userType === "student")  return "Student Account"
  if (userType === "org")      return "Organisation Account"
  return "Personal Account"
}

export function accountEmoji(userType: UserType): string {
  if (userType === "student")  return "🎓"
  if (userType === "org")      return "🏢"
  return "👤"
}