import {
  Button,
  Host,
  List,
  Picker,
  Section,
  Text,
  TextField,
  VStack,
  useNativeState,
} from "@expo/ui/swift-ui"
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers"
import type { PropsWithChildren } from "react"

export const statuses = [
  ["todo", "To do"],
  ["inProgress", "In progress"],
  ["done", "Done"],
] as const

export type Status = (typeof statuses)[number][0]

export function Screen({ children }: PropsWithChildren) {
  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <List>{children}</List>
    </Host>
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

export { Button, Section, Text, VStack }
