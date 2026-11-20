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
  SidebarTrigger,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
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
  CircleUserRoundIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderKanbanIcon,
  InboxIcon,
  LogOutIcon,
  MailIcon,
  SettingsIcon,
  ShieldIcon,
  TrophyIcon,
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
  { href: "/email", label: "Email", icon: MailIcon, min: "owner" },
  {
    href: "/submission-forms",
    label: "Submission Forms",
    icon: ClipboardListIcon,
    min: "organizer",
  },
  {
    href: "/project-submissions",
    label: "Project Submissions",
    icon: FolderKanbanIcon,
    min: "organizer",
  },
  {
    href: "/judging",
    label: "Judging Management",
    icon: TrophyIcon,
    min: "organizer",
  },
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
  const { isMobile, setOpenMobile, state } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="min-h-[74px] flex-row items-center justify-between overflow-hidden px-4 pt-5 pb-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <Link
          href="/forms"
          onClick={() => setOpenMobile(false)}
          className="flex w-fit items-center gap-3 group-data-[collapsible=icon]:hidden"
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
        {!isMobile && <SidebarTrigger className="text-[#6E6E68]" />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {NAV.filter((item) => hasLevel(level, item.min)).map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  className={SIDEBAR_ITEM}
                  tooltip={item.label}
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
      <SidebarFooter
        className={cn(SIDEBAR_FOOTER, "group-data-[collapsible=icon]:p-2")}
      >
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={collapsed ? "Account" : undefined}
                  className={cn(
                    SIDEBAR_ACCOUNT_ROW,
                    SIDEBAR_ACCOUNT_TRIGGER,
                    collapsed && "size-8 justify-center px-0"
                  )}
                >
                  {collapsed ? (
                    <CircleUserRoundIcon className="size-4" />
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate" title={email}>
                        {email}
                      </span>
                      <Pill
                        tone="sage"
                        size="sm"
                        className="shrink-0 capitalize"
                      >
                        {level}
                      </Pill>
                      <ChevronsUpDownIcon className="size-4 shrink-0 text-[#6E6E68]" />
                    </>
                  )}
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" hidden={!collapsed || menuOpen}>
              {email}
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            side={collapsed ? "right" : "top"}
            align={collapsed ? "end" : "start"}
            className={cn(
              "gap-0 p-1",
              collapsed ? "w-60" : "w-(--radix-popover-trigger-width)"
            )}
          >
            {collapsed && (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px] text-[#6E6E68]">
                  {email}
                </span>
                <Pill tone="sage" size="sm" className="shrink-0 capitalize">
                  {level}
                </Pill>
              </div>
            )}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="submit"
                variant="outline"
                size={collapsed ? "icon" : "default"}
                aria-label={collapsed ? "Sign out" : undefined}
                className={cn(!collapsed && "w-full")}
              >
                {collapsed ? <LogOutIcon /> : "Sign out"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" hidden={!collapsed}>
              Sign out
            </TooltipContent>
          </Tooltip>
        </form>
      </SidebarFooter>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
  )
}
