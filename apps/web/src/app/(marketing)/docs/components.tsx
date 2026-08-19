import type { ReactNode } from "react"

import { type CodeLang, highlightCode } from "@/lib/shiki"

export async function CodeBlock({
  children,
  label,
  lang,
}: {
  children: string
  label?: string
  lang: CodeLang
}) {
  const html = await highlightCode(children, lang)
  return (
    <div className="grid gap-1.5">
      {label ? (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      ) : null}
      <div
        className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-sm leading-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

export function Prose({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-6 text-muted-foreground">{children}</p>
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <h1 className="font-heading text-2xl font-medium tracking-tight">
      {children}
    </h1>
  )
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 className="pt-6 font-heading text-lg font-medium" id={id}>
      {children}
    </h2>
  )
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-4 text-sm font-medium">{children}</h3>
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
      {children}
    </p>
  )
}
