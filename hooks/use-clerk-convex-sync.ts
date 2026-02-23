import { useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"

export function useClerkConvexSync() {
  const { user, isLoaded } = useUser()
  const createOrUpdateUser = useMutation(api.functions.createOrUpdateUser)

  useEffect(() => {
    if (isLoaded && user) {
      createOrUpdateUser({
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress || "",
        name: user.firstName || user.username || "",
        profileImage: user.imageUrl,
      }).catch((error) => {
        console.error("[v0] Error syncing Clerk user to Convex:", error)
      })
    }
  }, [isLoaded, user, createOrUpdateUser])
}
