/**
 * Curated set of accent colors a user can pick for a project.
 * Keys are stable string identifiers persisted in the database.
 *
 * Class strings are written as full literals (no string interpolation) so the
 * Tailwind v4 scanner can statically detect and include them in the bundle.
 * - `box`: tinted background + icon color, used behind the icon on cards.
 * - `swatch`: solid fill used for the picker swatch.
 */
export const PROJECT_COLORS = {
  slate: {
    box: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
    swatch: "bg-slate-500",
  },
  stone: {
    box: "bg-stone-500/15 text-stone-600 dark:text-stone-300",
    swatch: "bg-stone-500",
  },
  red: {
    box: "bg-red-500/15 text-red-600 dark:text-red-400",
    swatch: "bg-red-500",
  },
  rose: {
    box: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    swatch: "bg-rose-500",
  },
  orange: {
    box: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    swatch: "bg-orange-500",
  },
  amber: {
    box: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    swatch: "bg-amber-500",
  },
  yellow: {
    box: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    swatch: "bg-yellow-500",
  },
  lime: {
    box: "bg-lime-500/15 text-lime-600 dark:text-lime-400",
    swatch: "bg-lime-500",
  },
  green: {
    box: "bg-green-500/15 text-green-600 dark:text-green-400",
    swatch: "bg-green-500",
  },
  emerald: {
    box: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    swatch: "bg-emerald-500",
  },
  teal: {
    box: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    swatch: "bg-teal-500",
  },
  cyan: {
    box: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    swatch: "bg-cyan-500",
  },
  sky: {
    box: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    swatch: "bg-sky-500",
  },
  blue: {
    box: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    swatch: "bg-blue-500",
  },
  indigo: {
    box: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    swatch: "bg-indigo-500",
  },
  violet: {
    box: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    swatch: "bg-violet-500",
  },
  purple: {
    box: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    swatch: "bg-purple-500",
  },
  fuchsia: {
    box: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
    swatch: "bg-fuchsia-500",
  },
  pink: {
    box: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
    swatch: "bg-pink-500",
  },
} satisfies Record<string, { box: string; swatch: string }>

export type ProjectColorName = keyof typeof PROJECT_COLORS

export const PROJECT_COLOR_NAMES = Object.keys(
  PROJECT_COLORS
) as ProjectColorName[]

export const DEFAULT_PROJECT_COLOR: ProjectColorName = "slate"

/** Resolve a stored color name to its icon-box classes, falling back to the default. */
export function getProjectColorBox(color?: string): string {
  if (color && color in PROJECT_COLORS) {
    return PROJECT_COLORS[color as ProjectColorName].box
  }
  return PROJECT_COLORS[DEFAULT_PROJECT_COLOR].box
}

/**
 * Resolve a stored color name to just its icon foreground classes: the
 * `text-*` part of the box without the tinted background. Used where we want
 * the colored icon on a transparent surface, e.g. the sidebar project list.
 */
export function getProjectColorText(color?: string): string {
  return getProjectColorBox(color)
    .split(" ")
    .filter((cls) => !cls.startsWith("bg-"))
    .join(" ")
}

/** Pick a random color name, used to seed a fresh project. */
export function randomProjectColor(): ProjectColorName {
  const index = Math.floor(Math.random() * PROJECT_COLOR_NAMES.length)
  return PROJECT_COLOR_NAMES[index]
}
