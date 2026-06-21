import {
  Bell,
  BookOpen,
  Bookmark,
  Briefcase,
  Bug,
  Calendar,
  Camera,
  Cloud,
  Code,
  Coffee,
  Compass,
  CreditCard,
  Database,
  DollarSign,
  Dumbbell,
  Flag,
  Flame,
  FolderKanban,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Headphones,
  Heart,
  House,
  Image as ImageIcon,
  Leaf,
  LayoutGrid,
  Lightbulb,
  LineChart,
  ListChecks,
  type LucideIcon,
  Mail,
  MapPin,
  Music,
  Palette,
  PenTool,
  Plane,
  Rocket,
  ShoppingCart,
  Sparkles,
  Star,
  Target,
  Terminal,
  Trophy,
  Wrench,
  Zap,
} from "lucide-react"
import { createElement } from "react"

/**
 * Curated set of icons a user can pick for a project.
 * Keys are stable string identifiers persisted in the database; values are the
 * matching lucide components rendered in the UI.
 */
export const PROJECT_ICONS = {
  "folder-kanban": FolderKanban,
  "list-checks": ListChecks,
  "layout-grid": LayoutGrid,
  calendar: Calendar,
  briefcase: Briefcase,
  target: Target,
  flag: Flag,
  bookmark: Bookmark,
  rocket: Rocket,
  star: Star,
  sparkles: Sparkles,
  zap: Zap,
  flame: Flame,
  trophy: Trophy,
  gift: Gift,
  heart: Heart,
  lightbulb: Lightbulb,
  compass: Compass,
  code: Code,
  terminal: Terminal,
  database: Database,
  bug: Bug,
  "pen-tool": PenTool,
  palette: Palette,
  image: ImageIcon,
  camera: Camera,
  music: Music,
  headphones: Headphones,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  globe: Globe,
  "map-pin": MapPin,
  plane: Plane,
  house: House,
  coffee: Coffee,
  leaf: Leaf,
  cloud: Cloud,
  dumbbell: Dumbbell,
  "gamepad-2": Gamepad2,
  wrench: Wrench,
  "shopping-cart": ShoppingCart,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  "line-chart": LineChart,
  bell: Bell,
  mail: Mail,
} satisfies Record<string, LucideIcon>

export type ProjectIconName = keyof typeof PROJECT_ICONS

export const PROJECT_ICON_NAMES = Object.keys(
  PROJECT_ICONS
) as ProjectIconName[]

export const DEFAULT_PROJECT_ICON: ProjectIconName = "folder-kanban"

/** Resolve a stored icon name to its component, falling back to the default. */
export function getProjectIcon(icon?: string): LucideIcon {
  if (icon && icon in PROJECT_ICONS) {
    return PROJECT_ICONS[icon as ProjectIconName]
  }
  return PROJECT_ICONS[DEFAULT_PROJECT_ICON]
}

/** Pick a random icon name, used to seed a fresh project. */
export function randomProjectIcon(): ProjectIconName {
  const index = Math.floor(Math.random() * PROJECT_ICON_NAMES.length)
  return PROJECT_ICON_NAMES[index]
}

/**
 * Render a project's icon by name. Declared at module scope (and using
 * `createElement` instead of resolving a component into a render-local
 * variable) so the icon component reference stays stable across renders.
 */
export function ProjectIcon({
  className,
  name,
}: {
  className?: string
  name?: string
}) {
  return createElement(getProjectIcon(name), { className })
}
