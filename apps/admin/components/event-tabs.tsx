import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

export function EventTabs({
  events,
  selected,
  basePath,
}: {
  events: { slug: string; name: string }[]
  selected: string
  basePath: string
}) {
  return (
    <nav
      aria-label="Events"
      className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-card p-1 text-[14px] text-muted-foreground"
    >
      {events.map((event) => {
        const active = event.slug === selected
        return (
          <Link
            key={event.slug}
            href={`${basePath}?event=${encodeURIComponent(event.slug)}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-[14px] py-[5px] font-medium transition-colors hover:text-foreground",
              active &&
                "bg-primary text-primary-foreground hover:text-primary-foreground"
            )}
          >
            {event.name}
          </Link>
        )
      })}
    </nav>
  )
}
