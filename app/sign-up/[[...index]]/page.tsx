import { SignUp } from "@clerk/nextjs"
import { AuthShell } from "@/components/auth-shell"

export default function SignUpPage() {
  return (
    <AuthShell title="Create your Errorless account">
      <SignUp />
    </AuthShell>
  )
}
