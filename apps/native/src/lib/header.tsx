import { useUser } from "@clerk/expo"
import { Image } from "expo-image"
import { router } from "expo-router"
import { SymbolView, type SymbolViewProps } from "expo-symbols"
import { Pressable, View } from "react-native"

import { accentColor } from "@/lib/theme"

/**
 * A tappable SF Symbol button sized for the navigation bar's toolbar.
 */
export function HeaderIconButton({
  name,
  label,
  onPress,
}: {
  name: SymbolViewProps["name"]
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
    >
      <SymbolView name={name} size={24} tintColor={accentColor} />
    </Pressable>
  )
}

/**
 * Lays out multiple toolbar items in the header's trailing slot with even
 * spacing, keeping them vertically centered next to the title.
 */
export function HeaderRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
      {children}
    </View>
  )
}

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
