import { DynamicColorIOS } from "react-native"

/**
 * Brand accent color for the native app, mirroring the web app's `--primary`.
 *
 * The web theme uses a green (Tailwind lime) primary:
 * - light: `oklch(0.841 0.238 128.85)` -> `#9ae600` (lime-400)
 * - dark:  `oklch(0.768 0.233 130.85)` -> `#7ccf00` (lime-500)
 *
 * `DynamicColorIOS` lets the tint follow the system light/dark appearance,
 * matching how the web primary shifts between color schemes. It resolves to a
 * `ColorValue`, which Expo UI's `seedColor`/tint and Expo Router's
 * `headerTintColor`/`tintColor` all accept.
 */
export const accentColor = DynamicColorIOS({
  light: "#63A402",
  dark: "#7ccf00",
})
