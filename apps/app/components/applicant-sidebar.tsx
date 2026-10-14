"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import {
  FileTextIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SettingsIcon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { signOut } from "@/lib/auth-actions"

import { SettingsDialog } from "./settings-dialog"

const ITEM =
  "h-9 rounded-lg text-[15px] text-[#6E6E68] hover:bg-[#3A4A2B]/6 hover:text-[#3A4A2B] data-active:bg-[#3A4A2B]/10 data-active:font-semibold data-active:text-[#3A4A2B]"

export function ApplicantSidebar({ applicationId }: { applicationId: string }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
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
                  className={ITEM}
                  data-active={pathname === item.href || undefined}
                >
                  <Link href={item.href} onClick={() => setOpenMobile(false)}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton
                className={ITEM}
                data-active={undefined}
                onClick={() => {
                  setOpenMobile(false)
                  setSettingsOpen(true)
                }}
              >
                <SettingsIcon />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <form action={signOut}>
                <SidebarMenuButton
                  type="submit"
                  className={ITEM}
                  data-active={undefined}
                >
                  <LogOutIcon />
                  <span>Log out</span>
                </SidebarMenuButton>
              </form>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
  )
}
