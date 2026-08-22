"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pr-1 pl-4 text-sm">
      <code className="flex-1 truncate font-mono text-[13px] tracking-tight">
        {command}
      </code>
      <button
        aria-label="Copy command"
        className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        onClick={onCopy}
        type="button"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-3.5" />
        ) : (
          <Copy aria-hidden="true" className="size-3.5" />
        )}
      </button>
    </div>
  )
}
