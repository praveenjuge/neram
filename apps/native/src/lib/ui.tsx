import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Picker,
  Section,
  Text,
  TextField,
  VStack,
  useNativeState,
} from "@expo/ui/swift-ui"
import {
  foregroundStyle,
  frame,
  pickerStyle,
  tag,
} from "@expo/ui/swift-ui/modifiers"
import type { ComponentProps, PropsWithChildren } from "react"

import { accentColor } from "@/lib/theme"

type SymbolName = ComponentProps<typeof Image>["systemName"]

export const statuses = [
  ["todo", "To do"],
  ["inProgress", "In progress"],
  ["done", "Done"],
] as const

export type Status = (typeof statuses)[number][0]

export function Screen({ children }: PropsWithChildren) {
  return (
    <Host style={{ flex: 1 }} seedColor={accentColor} useViewportSizeMeasurement>
      <List>{children}</List>
    </Host>
  )
}

export function Row({
  label,
  systemImage,
  onPress,
}: {
  label: string
  systemImage: SymbolName
  onPress: () => void
}) {
  return (
    <Button onPress={onPress}>
      <HStack
        spacing={12}
        alignment="center"
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <Image systemName={systemImage} color={accentColor} size={20} />
        <Text
          modifiers={[
            foregroundStyle({ type: "hierarchical", style: "primary" }),
          ]}
        >
          {label}
        </Text>
      </HStack>
    </Button>
  )
}

export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <VStack alignment="leading" spacing={4}>
      <Text>{title}</Text>
      {detail ? <Text>{detail}</Text> : null}
    </VStack>
  )
}

export function Field({
  placeholder,
  value,
  onChange,
  multiline,
}: {
  placeholder: string
  value?: string
  onChange: (value: string) => void
  multiline?: boolean
}) {
  const nativeText = useNativeState(value ?? "")
  return (
    <TextField
      axis={multiline ? "vertical" : "horizontal"}
      placeholder={placeholder}
      text={nativeText}
      onTextChange={onChange}
    />
  )
}

export function StatusPicker({
  value,
  onChange,
}: {
  value: Status
  onChange: (status: Status) => void
}) {
  return (
    <Picker
      label="Status"
      selection={value}
      onSelectionChange={(next) => onChange(next)}
      modifiers={[pickerStyle("segmented")]}
    >
      {statuses.map(([id, label]) => (
        <Text key={id} modifiers={[tag(id)]}>
          {label}
        </Text>
      ))}
    </Picker>
  )
}

export function SegmentedPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <Picker
      label={label}
      selection={value}
      onSelectionChange={onChange}
      modifiers={[pickerStyle("segmented")]}
    >
      {options.map(([id, optionLabel]) => (
        <Text key={id} modifiers={[tag(id)]}>
          {optionLabel}
        </Text>
      ))}
    </Picker>
  )
}

export { Button, Section, Text, VStack }
