"use client"

import {
  AwardIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"

export function JudgeSidebar({
  applicationId,
  email,
  judgingClosed,
}: {
  applicationId?: string
  email: string
  judgingClosed: boolean
}) {
  const nav = [
    {
      href: "/judge",
      label: "Dashboard",
      icon: LayoutDashboardIcon,
      match: (path: string) =>
        /^\/judge(\/[^/]+(\/projects)?\/[^/]+)?$/.test(path),
    },
    ...(judgingClosed
      ? []
      : [{ href: "/judge/rubric", label: "Rubric", icon: ListChecksIcon }]),
    { href: "/judge/certificate", label: "Certificate", icon: AwardIcon },
    ...(applicationId
      ? [
          {
            href: `/applications/${applicationId}`,
            label: "My application",
            icon: FileTextIcon,
          },
        ]
      : []),
  ]
  return <AppSidebar email={email} homeHref="/judge" nav={nav} view="judging" />
}
