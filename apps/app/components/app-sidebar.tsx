"use client"

import { Button } from "@workspace/ui/components/button"
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
  LogOutIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { LogoLockup } from "@/components/logo-lockup"
import { signOut } from "@/lib/auth-actions"

export type AppSidebarItem = {
  href: string
  label: string
  icon: LucideIcon
  match?: (pathname: string) => boolean
}

export function AppSidebar({
  email,
  homeHref,
  nav,
  view,
}: {
  email: string
  homeHref: string
  nav: AppSidebarItem[]
  view: "participant" | "mentor" | "judging"
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
          href={homeHref}
          onClick={() => setOpenMobile(false)}
          className="w-fit group-data-[collapsible=icon]:hidden"
        >
          <LogoLockup view={view} imageClassName="h-[42px]" preload />
        </Link>
        {!isMobile && <SidebarTrigger className="text-[#6E6E68]" />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1 font-(family-name:--font-auth-sans)">
            {nav.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  className={SIDEBAR_ITEM}
                  tooltip={item.label}
                  isActive={
                    item.match
                      ? item.match(pathname)
                      : pathname === item.href ||
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
              "gap-0 p-1 font-(family-name:--font-auth-sans)",
              collapsed ? "w-56" : "w-(--radix-popover-trigger-width)"
            )}
          >
            {collapsed && (
              <p className="truncate px-2 py-1.5 text-[13px] text-[#6E6E68]">
                {email}
              </p>
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
                className={cn(
                  "border-[#E7E4D9] bg-white text-[#3A4A2B] hover:bg-[#F3F1EA] hover:text-[#3A4A2B] focus-visible:border-[#8C9580] focus-visible:ring-[#8C9580]/50",
                  !collapsed && "w-full"
                )}
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
