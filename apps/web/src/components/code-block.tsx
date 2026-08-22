export function CodeBlock({
  code,
  lang,
}: {
  code: string
  lang?: string
}) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-3.5 font-mono text-[13px] leading-6 text-foreground/90">
      {lang ? (
        <code data-lang={lang} className="whitespace-pre">
          {code}
        </code>
      ) : (
        <code className="whitespace-pre">{code}</code>
      )}
    </pre>
  )
}
