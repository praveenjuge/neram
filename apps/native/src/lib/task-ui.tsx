import type { PropsWithChildren, ReactNode } from "react"
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
} from "react-native"

export function useTaskColors() {
  const dark = useColorScheme() === "dark"
  return {
    background: dark ? "#151718" : "#F7F8F8",
    surface: dark ? "#202425" : "#FFFFFF",
    soft: dark ? "#2A2F30" : "#F0F2F2",
    border: dark ? "#343A3B" : "#E2E6E6",
    text: dark ? "#F6F8F8" : "#182020",
    muted: dark ? "#A2ACAC" : "#667272",
    accent: dark ? "#7CCF00" : "#63A402",
    destructive: dark ? "#FF8A83" : "#C9372C",
  }
}

export function NativeSection({
  title,
  detail,
  children,
}: PropsWithChildren<{ title: string; detail?: string }>) {
  const colors = useTaskColors()
  return (
    <View style={taskStyles.section}>
      <View style={taskStyles.sectionHeading}>
        <Text style={[taskStyles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {detail ? <Text style={[taskStyles.detail, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
      {children}
    </View>
  )
}

export function NativeButton({
  label,
  onPress,
  active = false,
  destructive = false,
  disabled = false,
}: {
  label: string
  onPress: () => void
  active?: boolean
  destructive?: boolean
  disabled?: boolean
}) {
  const colors = useTaskColors()
  const foreground = destructive
    ? colors.destructive
    : active
      ? colors.background
      : colors.text
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        taskStyles.button,
        {
          backgroundColor: active ? colors.accent : colors.soft,
          borderColor: colors.border,
          opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
        },
      ]}
    >
      <Text style={[taskStyles.buttonLabel, { color: foreground }]}>{label}</Text>
    </Pressable>
  )
}

export function NativeField(props: TextInputProps) {
  const colors = useTaskColors()
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      {...props}
      style={[
        taskStyles.field,
        { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
        props.multiline && taskStyles.multiline,
        props.style,
      ]}
    />
  )
}

export function InlineMeta({ children }: { children: ReactNode }) {
  const colors = useTaskColors()
  return <Text style={[taskStyles.detail, { color: colors.muted }]}>{children}</Text>
}

export const taskStyles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 24 },
  section: { gap: 10 },
  sectionHeading: { gap: 2 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  detail: { fontSize: 12, lineHeight: 17 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 8 },
  button: { minHeight: 36, justifyContent: "center", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 8 },
  buttonLabel: { fontSize: 13, fontWeight: "600" },
  field: { minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 92, textAlignVertical: "top" },
})
