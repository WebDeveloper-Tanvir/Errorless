"use client"

import { useEffect, useState } from "react"
import { useClerk, useUser } from "@clerk/nextjs"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { accountLabel, classifyEmail } from "@/lib/emailClassifier"

// Same key Dev Mode uses to save its session memory (app/devmode/page.tsx).
const DEVMODE_STORAGE_KEY = "errorless_devmode_v1"

export default function ProfilePage() {
  const { user, isLoaded } = useUser()
  const { signOut, openUserProfile } = useClerk()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const [hasMemory, setHasMemory] = useState(false)

  useEffect(() => {
    if (!user) return
    setFirstName(user.firstName ?? "")
    setLastName(user.lastName ?? "")
  }, [user])

  useEffect(() => {
    try {
      setHasMemory(!!localStorage.getItem(DEVMODE_STORAGE_KEY))
    } catch {
      setHasMemory(false)
    }
  }, [])

  const email = user?.primaryEmailAddress?.emailAddress ?? ""
  const dirty = !!user && (firstName !== (user.firstName ?? "") || lastName !== (user.lastName ?? ""))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setStatus(null)
    try {
      await user.update({ firstName: firstName.trim(), lastName: lastName.trim() })
      setStatus({ kind: "ok", text: "Profile updated." })
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : "Could not update your profile." })
    } finally {
      setSaving(false)
    }
  }

  const clearMemory = () => {
    try {
      localStorage.removeItem(DEVMODE_STORAGE_KEY)
      setHasMemory(false)
      setStatus({ kind: "ok", text: "Saved Dev Mode session removed from this browser." })
    } catch {
      setStatus({ kind: "error", text: "Could not access browser storage." })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6">
        <header className="mb-4">
          <h1 className="text-3xl font-semibold tracking-tight">Profile &amp; settings</h1>
          <p className="mt-2 text-muted-foreground">Manage your account and the data Errorless keeps in this browser.</p>
        </header>

        <div role="status" aria-live="polite" className="min-h-6">
          {status && (
            <p className={status.kind === "ok" ? "text-sm text-success" : "text-sm text-destructive"}>{status.text}</p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              {email ? `${email} · ${accountLabel(classifyEmail(email))}` : "Your account details"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isLoaded ? (
              <div className="space-y-4" aria-busy="true">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <form onSubmit={save} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first-name">First name</Label>
                    <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Last name</Label>
                    <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                  </div>
                </div>
                <Button type="submit" disabled={!dirty || saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Email addresses, password, connected accounts and active sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => openUserProfile()} disabled={!isLoaded}>
              Manage account
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved data</CardTitle>
            <CardDescription>
              Dev Mode keeps your last session in this browser&apos;s local storage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={clearMemory} disabled={!hasMemory}>
              {hasMemory ? "Clear saved Dev Mode session" : "Nothing saved"}
            </Button>
          </CardContent>
        </Card>

        <div className="pt-2">
          <Button variant="ghost" onClick={() => signOut({ redirectUrl: "/" })}>
            Sign out
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  )
}
