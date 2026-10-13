"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
import Link from "next/link"
import { usePathname } from "next/navigation"

import { signOut } from "@/lib/auth-actions"
import { hasLevel, type AdminLevel } from "@/lib/levels"

const NAV: { href: string; label: string; min: AdminLevel }[] = [
  { href: "/forms", label: "Forms", min: "reviewer" },
  { href: "/applications", label: "Applications", min: "reviewer" },
  { href: "/email", label: "Email", min: "organizer" },
  { href: "/admins", label: "Admins", min: "owner" },
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

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <span className="font-semibold">HackFest Admin</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV.filter((item) => hasLevel(level, item.min)).map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`)
                  }
                  className="text-muted-foreground data-active:text-foreground"
                >
                  <Link href={item.href} onClick={() => setOpenMobile(false)}>
                    {item.label}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 border-t p-4">
        <div className="flex flex-col items-start gap-1.5 text-sm">
          <span className="w-full truncate">{email}</span>
          <Badge variant="secondary">{level}</Badge>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Sign out
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  )
}
