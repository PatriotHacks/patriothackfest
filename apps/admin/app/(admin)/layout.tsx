import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

import { AdminSidebar } from "@/components/admin-sidebar"
import { getAdmin } from "@/lib/admin"

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { email, level } = await getAdmin()

  return (
    <SidebarProvider>
      <AdminSidebar email={email} level={level} />
      <SidebarInset>
        <header className="flex items-center gap-2 border-b px-4 py-2 md:hidden">
          <SidebarTrigger />
          <span className="font-semibold">HackFest Admin</span>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
