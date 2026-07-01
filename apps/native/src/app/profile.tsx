import { useAuth } from "@clerk/expo"
import { UserProfileView } from "@clerk/expo/native"
import { router } from "expo-router"
import { useEffect } from "react"

export default function ProfileScreen() {
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false })

  useEffect(() => {
    if (isSignedIn === false) router.replace("/")
  }, [isSignedIn])

  return <UserProfileView style={{ flex: 1 }} />
}
