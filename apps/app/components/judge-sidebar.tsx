"use client"

import {
  AwardIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
} from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"

export function JudgeSidebar({
  email,
  eventSlug,
}: {
  email: string
  eventSlug?: string
}) {
  const nav = [
    {
      href: "/judge",
      label: "Dashboard",
      icon: LayoutDashboardIcon,
      exact: true,
    },
    ...(eventSlug
      ? [
          {
            href: `/judge/${encodeURIComponent(eventSlug)}`,
            label: "Assignments",
            icon: ClipboardListIcon,
          },
        ]
      : []),
    { href: "/judge/rubric", label: "Rubric", icon: ListChecksIcon },
    { href: "/judge/certificate", label: "Certificate", icon: AwardIcon },
  ]
  return <AppSidebar email={email} homeHref="/judge" nav={nav} view="judging" />
}
