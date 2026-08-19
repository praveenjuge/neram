import Link from "next/link"
import type { ReactNode } from "react"

import { docsNav } from "@/lib/docs-nav"

function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r md:block">
      <div className="sticky top-14 h-[calc(100svh-3.5rem)] overflow-auto p-4">
        <form action="/docs/search" className="mb-4">
          <input
            className="w-full rounded-full border bg-muted/40 px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
            name="q"
            placeholder="Search docs…"
            type="search"
          />
        </form>
        <nav className="space-y-5">
          {docsNav.map((group) => (
            <div key={group.title}>
              <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">
                {group.title}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      className="block rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                      href={item.href}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}

function MobileSearch() {
  return (
    <form action="/docs/search" className="md:hidden">
      <input
        className="w-full rounded-full border bg-muted/40 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
        name="q"
        placeholder="Search docs…"
        type="search"
      />
    </form>
  )
}

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <div className="border-b px-5 py-3 md:hidden">
          <MobileSearch />
        </div>
        <div className="px-5 py-6 md:px-8 md:py-8">{children}</div>
      </div>
    </div>
  )
}
