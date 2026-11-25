import { redirect } from "next/navigation"

// Errorless authenticates with Clerk. This legacy Supabase route now forwards to the Clerk page.
export default function Page() {
  redirect("/sign-up")
}
