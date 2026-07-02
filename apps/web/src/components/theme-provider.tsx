"use client"

import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes"
import * as React from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const THEME_VALUES: Theme[] = ["dark", "light", "system"]

function isTheme(value: string | undefined): value is Theme {
  return THEME_VALUES.includes(value as Theme)
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable]"))
}

function ThemeShortcut() {
  const { resolvedTheme, setTheme, theme } = useNextTheme()

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      if (event.key.toLowerCase() !== "d") return

      const current = isTheme(theme) ? theme : "system"
      const nextTheme =
        current === "dark"
          ? "light"
          : current === "light"
            ? "dark"
            : resolvedTheme === "dark"
              ? "light"
              : "dark"

      setTheme(nextTheme)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [resolvedTheme, setTheme, theme])

  return null
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  disableTransitionOnChange = true,
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      disableTransitionOnChange={disableTransitionOnChange}
      enableSystem
      storageKey={storageKey}
    >
      <ThemeShortcut />
      {children}
    </NextThemesProvider>
  )
}

export const useTheme = (): ThemeProviderState => {
  const { setTheme, theme } = useNextTheme()

  return {
    theme: isTheme(theme) ? theme : "system",
    setTheme,
  }
}
