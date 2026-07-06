import { createHighlighter, type Highlighter } from "shiki"

export type CodeLang = "bash" | "json"

const THEMES = { light: "github-light", dark: "github-dark" } as const
const LANGS: CodeLang[] = ["bash", "json"]

// Reuse a single highlighter across renders instead of spinning one up per
// code block. Themes and grammars load once, then every block is a cheap
// tokenize call.
let highlighterPromise: Promise<Highlighter> | undefined

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: Object.values(THEMES),
      langs: LANGS,
    })
  }
  return highlighterPromise
}

/**
 * Highlight `code` to HTML on the server. Uses Shiki's dual-theme output, so a
 * single render carries both light and dark colors as CSS variables and the
 * `.dark` class swaps them with no re-highlighting. See `.shiki` rules in
 * globals.css.
 */
export async function highlightCode(code: string, lang: CodeLang) {
  "use cache"
  // Shiki calls Date.now() internally, which Next's Cache Components prerender
  // rejects unless the result is cached. The output is a pure function of
  // (code, lang), so caching is both correct and cheap.
  const highlighter = await getHighlighter()
  // Default dual-theme output: the light theme color is written inline on each
  // token (so highlighting shows with no extra CSS), and the dark theme is
  // exposed as a `--shiki-dark` variable that the `.dark` rules in globals.css
  // swap in. See those rules for the dark-mode override.
  return highlighter.codeToHtml(code, {
    lang,
    themes: THEMES,
  })
}
