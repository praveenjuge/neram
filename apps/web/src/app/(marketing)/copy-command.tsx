"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background py-1 pr-1 pl-4 text-sm">
      <code className="flex-1 truncate font-mono text-[13px] tracking-tight">
        {command}
      </code>
      <Button
        aria-label="Copy command"
        className="rounded-full"
        onClick={onCopy}
        size="icon-sm"
        variant="ghost"
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </div>
  )
}
