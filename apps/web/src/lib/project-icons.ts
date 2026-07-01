import {
  Activity,
  Anchor,
  Aperture,
  Apple,
  Archive,
  AtSign,
  Atom,
  Award,
  Beaker,
  Bell,
  Bike,
  Binary,
  Bird,
  BookOpen,
  Bookmark,
  Bot,
  Box,
  Boxes,
  Brain,
  Briefcase,
  Brush,
  Bug,
  Cake,
  Calendar,
  CalendarDays,
  Camera,
  Car,
  Carrot,
  Cat,
  CheckCheck,
  Cherry,
  Clipboard,
  ClipboardList,
  Cloud,
  Code,
  Coffee,
  Cog,
  Coins,
  Compass,
  Component,
  Cpu,
  CreditCard,
  Croissant,
  Crown,
  CupSoda,
  Database,
  Diamond,
  Dog,
  DollarSign,
  Dumbbell,
  Feather,
  FileText,
  Film,
  Fish,
  Flag,
  Flame,
  Folder,
  FolderKanban,
  Gamepad2,
  Gem,
  Ghost,
  Gift,
  GitBranch,
  Globe,
  GraduationCap,
  Hash,
  Headphones,
  Heart,
  House,
  IceCreamCone,
  Image as ImageIcon,
  Inbox,
  Key,
  Layers,
  LayoutGrid,
  Leaf,
  Lightbulb,
  LineChart,
  ListChecks,
  Lock,
  type LucideIcon,
  Mail,
  Map,
  MapPin,
  Medal,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Mic,
  Moon,
  Mountain,
  Music,
  NotebookPen,
  Package,
  Paintbrush,
  Palette,
  PawPrint,
  PenTool,
  Pencil,
  Phone,
  Pin,
  Pizza,
  Plane,
  Puzzle,
  Rabbit,
  Rocket,
  Ruler,
  Salad,
  Scissors,
  Send,
  Server,
  Shapes,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smile,
  Snowflake,
  Sparkles,
  Sprout,
  Star,
  StickyNote,
  Sun,
  Swords,
  Tag,
  Target,
  Tent,
  Terminal,
  Ticket,
  Timer,
  Trees,
  Trophy,
  Truck,
  Umbrella,
  User,
  Users,
  Utensils,
  Video,
  Wallet,
  Wifi,
  Wind,
  Wine,
  Wrench,
  Zap,
} from "lucide-react"
import { createElement } from "react"

/**
 * Curated set of icons a user can pick for a project.
 * Keys are stable string identifiers persisted in the database; values are the
 * matching lucide components rendered in the UI.
 *
 * Grouped loosely by theme so the picker reads as related clusters when
 * scanned top to bottom. Keys are kebab-case and double as search terms
 * (hyphens are treated as spaces) in the icon picker.
 */
export const PROJECT_ICONS = {
  // Boards & planning
  "folder-kanban": FolderKanban,
  "list-checks": ListChecks,
  "layout-grid": LayoutGrid,
  "check-check": CheckCheck,
  folder: Folder,
  archive: Archive,
  inbox: Inbox,
  clipboard: Clipboard,
  "clipboard-list": ClipboardList,
  "sticky-note": StickyNote,
  "notebook-pen": NotebookPen,
  "file-text": FileText,
  calendar: Calendar,
  "calendar-days": CalendarDays,
  timer: Timer,
  pin: Pin,
  tag: Tag,
  hash: Hash,
  flag: Flag,
  bookmark: Bookmark,
  target: Target,
  briefcase: Briefcase,

  // Energy & milestones
  rocket: Rocket,
  star: Star,
  sparkles: Sparkles,
  zap: Zap,
  flame: Flame,
  trophy: Trophy,
  medal: Medal,
  award: Award,
  crown: Crown,
  gem: Gem,
  diamond: Diamond,
  gift: Gift,
  heart: Heart,
  smile: Smile,
  lightbulb: Lightbulb,
  compass: Compass,

  // Dev & tech
  code: Code,
  terminal: Terminal,
  binary: Binary,
  "git-branch": GitBranch,
  database: Database,
  server: Server,
  cpu: Cpu,
  component: Component,
  layers: Layers,
  box: Box,
  boxes: Boxes,
  package: Package,
  bot: Bot,
  cog: Cog,
  atom: Atom,
  brain: Brain,
  bug: Bug,
  activity: Activity,
  wrench: Wrench,
  key: Key,
  lock: Lock,

  // Design & media
  "pen-tool": PenTool,
  pencil: Pencil,
  brush: Brush,
  paintbrush: Paintbrush,
  palette: Palette,
  shapes: Shapes,
  ruler: Ruler,
  scissors: Scissors,
  image: ImageIcon,
  camera: Camera,
  aperture: Aperture,
  film: Film,
  video: Video,
  mic: Mic,
  music: Music,
  headphones: Headphones,

  // Communication
  mail: Mail,
  "message-square": MessageSquare,
  "message-circle": MessageCircle,
  send: Send,
  phone: Phone,
  megaphone: Megaphone,
  "at-sign": AtSign,
  bell: Bell,
  users: Users,
  user: User,

  // Learning & exploration
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  globe: Globe,
  map: Map,
  "map-pin": MapPin,
  plane: Plane,
  anchor: Anchor,
  mountain: Mountain,
  tent: Tent,
  house: House,
  cloud: Cloud,
  sun: Sun,
  moon: Moon,
  snowflake: Snowflake,
  wind: Wind,
  umbrella: Umbrella,

  // Commerce
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  "credit-card": CreditCard,
  wallet: Wallet,
  "dollar-sign": DollarSign,
  coins: Coins,
  "line-chart": LineChart,
  ticket: Ticket,
  truck: Truck,

  // Life & hobbies
  coffee: Coffee,
  "cup-soda": CupSoda,
  wine: Wine,
  pizza: Pizza,
  cake: Cake,
  apple: Apple,
  carrot: Carrot,
  cherry: Cherry,
  croissant: Croissant,
  "ice-cream-cone": IceCreamCone,
  salad: Salad,
  utensils: Utensils,
  dumbbell: Dumbbell,
  bike: Bike,
  car: Car,
  "gamepad-2": Gamepad2,
  puzzle: Puzzle,
  swords: Swords,
  shield: Shield,
  ghost: Ghost,
  wifi: Wifi,

  // Nature & creatures
  leaf: Leaf,
  sprout: Sprout,
  trees: Trees,
  feather: Feather,
  bird: Bird,
  cat: Cat,
  dog: Dog,
  fish: Fish,
  rabbit: Rabbit,
  "paw-print": PawPrint,
  beaker: Beaker,
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
 * Turn an icon key into a human-friendly search/label string, e.g.
 * "folder-kanban" -> "folder kanban". Used to filter the icon picker.
 */
export function getProjectIconLabel(name: string): string {
  return name.replace(/-/g, " ")
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
