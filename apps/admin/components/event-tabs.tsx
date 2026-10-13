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
      className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1 text-sm text-muted-foreground"
    >
      {events.map((event) => {
        const active = event.slug === selected
        return (
          <Link
            key={event.slug}
            href={`${basePath}?event=${encodeURIComponent(event.slug)}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 font-medium transition-colors hover:text-foreground",
              active && "bg-background text-foreground shadow-sm"
            )}
          >
            {event.name}
          </Link>
        )
      })}
    </nav>
  )
}
