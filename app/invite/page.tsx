import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { InvitePanel, MyShares } from "@/components/growth/invite-panel"

export default function InvitePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Invite &amp; sharing</h1>
        <p className="text-muted-foreground">Everything here is opt-in. Share only what you choose to.</p>
        <InvitePanel />
        <MyShares />
      </main>
      <Footer />
    </div>
  )
}
