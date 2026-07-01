import { useUser } from "@clerk/expo"
import { Image } from "expo-image"
import { router } from "expo-router"
import { Pressable } from "react-native"

/**
 * Avatar shown in the navigation bar's right toolbar slot. Tapping it opens the
 * profile screen. Falls back to a neutral circle while Clerk loads the user.
 */
export function HeaderAvatar() {
  const { user } = useUser()
  const imageUrl = user?.imageUrl

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open profile"
      hitSlop={8}
      onPress={() => router.push("/profile")}
    >
      <Image
        source={imageUrl ? { uri: imageUrl } : undefined}
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: "rgba(120,120,128,0.2)",
        }}
        contentFit="cover"
      />
    </Pressable>
  )
}
