import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import Image from "next/image"

import { AdminSidebar } from "@/components/admin-sidebar"
import { getAdmin } from "@/lib/admin"

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { email, level } = await getAdmin()

  return (
    <SidebarProvider>
      <AdminSidebar email={email} level={level} />
      <SidebarInset className="bg-white">
        <header className="flex items-center gap-3 border-b px-4 py-2 md:hidden">
          <SidebarTrigger />
          <Image
            src="/logo.png"
            alt="Patriot HackFest"
            width={400}
            height={211}
            className="h-[32px] w-auto"
          />
        </header>
        <div className="flex-1 p-4 sm:p-8 lg:px-12">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
