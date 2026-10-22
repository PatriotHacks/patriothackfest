import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import {
  APPLICATION_TABS,
  tabLabel,
  tabPath,
  type ApplicationTab,
} from "@/lib/application-tabs"

export function ApplicationTabs({
  selected,
  eventSlug,
  counts,
}: {
  selected: ApplicationTab
  eventSlug: string | undefined
  counts: Record<ApplicationTab["slug"], number>
}) {
  const query = eventSlug ? `?event=${encodeURIComponent(eventSlug)}` : ""
  return (
    <nav
      aria-label="Application groups"
      className="flex gap-1 border-b border-border text-[15px]"
    >
      {APPLICATION_TABS.map((tab) => {
        const active = tab.slug === selected.slug
        return (
          <Link
            key={tab.slug}
            href={`${tabPath(tab)}${query}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 border-transparent px-3 py-2 font-medium text-muted-foreground transition-colors hover:text-foreground",
              active && "border-primary text-foreground"
            )}
          >
            {tabLabel(tab, eventSlug)}
            <span className="rounded-full bg-muted px-2 text-[12px] text-muted-foreground tabular-nums">
              {counts[tab.slug]}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
