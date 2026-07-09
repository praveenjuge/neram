"use client"

import { UserButton } from "@clerk/nextjs"
import { BookOpen, Monitor, Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"

const iconClassName = "size-4"

export function AppUserButton() {
  const { setTheme } = useTheme()

  return (
    <UserButton
      appearance={{
        elements: {
          rootBox: "flex size-8 items-center justify-center",
          avatarBox: "size-8",
          userButtonTrigger:
            "size-8 rounded-full ring-sidebar-ring outline-hidden focus-visible:ring-3",
          userButtonAvatarBox: "size-8",
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link
          href="/docs"
          label="Docs"
          labelIcon={<BookOpen className={iconClassName} />}
        />
        <UserButton.Action
          label="Light theme"
          labelIcon={<Sun className={iconClassName} />}
          onClick={() => setTheme("light")}
        />
        <UserButton.Action
          label="Dark theme"
          labelIcon={<Moon className={iconClassName} />}
          onClick={() => setTheme("dark")}
        />
        <UserButton.Action
          label="System theme"
          labelIcon={<Monitor className={iconClassName} />}
          onClick={() => setTheme("system")}
        />
      </UserButton.MenuItems>
    </UserButton>
  )
}
