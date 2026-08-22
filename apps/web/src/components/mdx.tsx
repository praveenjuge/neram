import { FileText, LayoutDashboard, Plug, Terminal } from "lucide-react"
import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"

import { Card as UiCard, Cards as UiCards } from "fumadocs-ui/components/card"

const ICONS = {
  terminal: Terminal,
  plug: Plug,
  "layout-dashboard": LayoutDashboard,
  "file-text": FileText,
} as const

type IconName = keyof typeof ICONS

/** Blume-style `<CardGroup cols={n}>` mapped onto Fumadocs cards grid. */
function CardGroup({
  cols,
  children,
}: {
  cols?: number
  children?: React.ReactNode
}) {
  return (
    <UiCards
      className={
        cols === 3
          ? "sm:grid-cols-3"
          : cols === 2
            ? "sm:grid-cols-2"
            : undefined
      }
    >
      {children}
    </UiCards>
  )
}

function Card({
  title,
  icon,
  href,
  children,
}: {
  title?: string
  icon?: IconName
  href?: string
  children?: React.ReactNode
}) {
  const Icon = icon ? ICONS[icon] : undefined
  return (
    <UiCard
      title={title}
      href={href}
      icon={Icon ? <Icon className="size-4" /> : undefined}
    >
      {children}
    </UiCard>
  )
}

/** Blume-style `<Columns>`/`<Column>` layout wrappers. */
function Columns({
  cols,
  children,
}: {
  cols?: number
  children?: React.ReactNode
}) {
  return (
    <div
      className={
        cols === 3
          ? "grid gap-4 sm:grid-cols-3"
          : cols === 2
            ? "grid gap-4 sm:grid-cols-2"
            : "grid gap-4"
      }
    >
      {children}
    </div>
  )
}

function Column({ children }: { children?: React.ReactNode }) {
  return <div>{children}</div>
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    CardGroup,
    Card,
    Columns,
    Column,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
