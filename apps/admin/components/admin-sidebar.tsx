"use client"

import { Button } from "@workspace/ui/components/button"
import { Pill } from "@workspace/ui/components/pill"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { SettingsDialog } from "@workspace/ui/components/settings-dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import {
  SIDEBAR_ACCOUNT_ROW,
  SIDEBAR_ACCOUNT_TRIGGER,
  SIDEBAR_FOOTER,
  SIDEBAR_ITEM,
  SIDEBAR_MENU_ITEM,
} from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import {
  ChevronsUpDownIcon,
  FileTextIcon,
  InboxIcon,
  MailIcon,
  SettingsIcon,
  ShieldIcon,
  type LucideIcon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { signOut } from "@/lib/auth-actions"
import { hasLevel, type AdminLevel } from "@/lib/levels"

const NAV: {
  href: string
  label: string
  icon: LucideIcon
  min: AdminLevel
}[] = [
  { href: "/forms", label: "Forms", icon: FileTextIcon, min: "reviewer" },
  {
    href: "/applications",
    label: "Applications",
    icon: InboxIcon,
    min: "reviewer",
  },
  { href: "/email", label: "Email", icon: MailIcon, min: "organizer" },
  { href: "/admins", label: "Admins", icon: ShieldIcon, min: "owner" },
]

export function AdminSidebar({
  email,
  level,
}: {
  email: string
  level: AdminLevel
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5 pb-3">
        <Link
          href="/forms"
          onClick={() => setOpenMobile(false)}
          className="flex w-fit items-center gap-3"
        >
          <Image
            src="/logo.png"
            alt="Patriot HackFest"
            width={400}
            height={211}
            preload
            className="h-[42px] w-auto"
          />
          <span className="text-[12px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Admin
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {NAV.filter((item) => hasLevel(level, item.min)).map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  className={SIDEBAR_ITEM}
                  isActive={
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`)
                  }
                >
                  <Link href={item.href} onClick={() => setOpenMobile(false)}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className={SIDEBAR_FOOTER}>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(SIDEBAR_ACCOUNT_ROW, SIDEBAR_ACCOUNT_TRIGGER)}
            >
              <span className="min-w-0 flex-1 truncate" title={email}>
                {email}
              </span>
              <Pill tone="sage" size="sm" className="shrink-0 capitalize">
                {level}
              </Pill>
              <ChevronsUpDownIcon className="size-4 shrink-0 text-[#6E6E68]" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-(--radix-popover-trigger-width) gap-0 p-1"
          >
            <button
              type="button"
              className={SIDEBAR_MENU_ITEM}
              onClick={() => {
                setMenuOpen(false)
                setOpenMobile(false)
                setSettingsOpen(true)
              }}
            >
              <SettingsIcon />
              Settings
            </button>
          </PopoverContent>
        </Popover>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Sign out
          </Button>
        </form>
      </SidebarFooter>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
  )
}
