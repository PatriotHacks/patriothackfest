"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
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
  OUTLINE_PILL,
  SIDEBAR_ACCOUNT_ROW,
  SIDEBAR_FOOTER,
  SIDEBAR_ITEM,
} from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import {
  ChevronsUpDownIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  SettingsIcon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { signOut } from "@/lib/auth-actions"

import { SettingsDialog } from "./settings-dialog"

export function ApplicantSidebar({
  applicationId,
  email,
}: {
  applicationId: string
  email: string
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const nav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
    {
      href: `/applications/${applicationId}`,
      label: "My application",
      icon: FileTextIcon,
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5 pb-3">
        <Link href="/" onClick={() => setOpenMobile(false)} className="w-fit">
          <Image
            src="/logo.png"
            alt="Patriot HackFest"
            width={400}
            height={211}
            preload
            className="h-[42px] w-auto"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1 font-(family-name:--font-auth-sans)">
            {nav.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  className={SIDEBAR_ITEM}
                  isActive={pathname === item.href}
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
              className={cn(
                SIDEBAR_ACCOUNT_ROW,
                "outline-none hover:bg-[#3A4A2B]/6 focus-visible:ring-2 focus-visible:ring-[#3A4A2B]/30 data-[state=open]:bg-[#3A4A2B]/10"
              )}
            >
              <span className="min-w-0 flex-1 truncate" title={email}>
                {email}
              </span>
              <ChevronsUpDownIcon className="size-4 shrink-0 text-[#6E6E68]" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-(--radix-popover-trigger-width) gap-0 p-1 font-(family-name:--font-auth-sans)"
          >
            <button
              type="button"
              className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[14px] text-[#3A4A2B] outline-none hover:bg-[#3A4A2B]/6 focus-visible:bg-[#3A4A2B]/6 [&_svg]:size-4"
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
          <button
            type="submit"
            className={cn(
              OUTLINE_PILL,
              "w-full focus-visible:ring-2 focus-visible:ring-[#3A4A2B]/30 focus-visible:outline-none"
            )}
          >
            Sign out
          </button>
        </form>
      </SidebarFooter>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
  )
}
