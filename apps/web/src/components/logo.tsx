import { Sora } from "next/font/google"

import { cn } from "@/lib/utils"

const wordmark = Sora({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
})

/** The task box mark: a checked Markdown task, `[✓]`, on brand lime. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn("size-6 shrink-0", className)}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#8ff044" height="512" rx="116" width="512" />
      <path
        d="M180 132H124V380H180M332 132H388V380H332"
        fill="none"
        stroke="#244515"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="38"
      />
      <path
        d="M194 262L238 306L320 210"
        fill="none"
        stroke="#244515"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="42"
      />
    </svg>
  )
}

/** Mark plus the Sora wordmark, for headers and nav. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span
        className={cn(wordmark.className, "text-[1.0625rem] tracking-tight")}
      >
        Neram
      </span>
    </span>
  )
}
