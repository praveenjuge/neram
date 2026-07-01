import { Stack } from "expo-router"

import { HeaderAvatar } from "@/lib/header"

export default function ActivityLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerRight: () => <HeaderAvatar />,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Activity" }} />
    </Stack>
  )
}
