import Link from "next/link"
import type { Metadata } from "next"
import { Suspense } from "react"

import { searchDocs } from "@/lib/docs-search"

export const metadata: Metadata = {
  title: "Search",
  description: "Search Neram docs.",
}

async function SearchInput({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  return (
    <input
      autoFocus
      className="flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
      defaultValue={q ?? ""}
      name="q"
      placeholder="Try: sprint, mcp, AMBIGUOUS"
      type="search"
    />
  )
}

async function SearchResults({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q ?? ""
  const results = query ? searchDocs(query) : []
  return (
    <div className="mt-6">
      {!query ? (
        <p className="text-sm text-muted-foreground">Enter a query.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No results for <code>{query}</code>.
        </p>
      ) : (
        <ul className="grid gap-3">
          {results.map((doc) => (
            <li className="rounded-xl border p-4" key={doc.href}>
              <Link
                className="font-medium underline-offset-4 hover:underline"
                href={doc.href}
              >
                {doc.title}
              </Link>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {doc.excerpt}
              </p>
              <div className="mt-2 text-xs text-muted-foreground">
                {doc.href}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function DocsSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-heading text-2xl font-medium tracking-tight">
        Search
      </h1>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Zero-JS server search. Query is a plain substring match over titles,
        excerpts, and keywords.
      </p>

      <form action="/docs/search" className="mt-6 flex gap-2">
        <Suspense
          fallback={
            <input
              className="flex-1 rounded-full border bg-background px-4 py-2 text-sm"
              name="q"
              placeholder="Try: sprint, mcp, AMBIGUOUS"
              type="search"
            />
          }
        >
          <SearchInput searchParams={searchParams} />
        </Suspense>
        <button
          className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
          type="submit"
        >
          Search
        </button>
      </form>

      <Suspense
        fallback={
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  )
}
