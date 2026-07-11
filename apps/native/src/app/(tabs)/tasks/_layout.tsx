import { Stack } from "expo-router"

import { HeaderAvatar, HeaderRow, HeaderWorkspaceButton } from "@/lib/header"

export default function TasksLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerRight: () => (
          <HeaderRow>
            <HeaderWorkspaceButton />
            <HeaderAvatar />
          </HeaderRow>
        ),
      }}
    >
      <Stack.Screen name="index" options={{ title: "Tasks" }} />
    </Stack>
  )
}
