import Link from "next/link"
import { redirect } from "next/navigation"

import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { PageHeader } from "@/components/page-header"
import { getGalleryEvents } from "@/lib/gallery"

export const dynamic = "force-dynamic"

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "America/New_York",
})

export default async function Home() {
  const events = await getGalleryEvents()
  if (events.length === 1) redirect(`/${events[0]!.slug}`)

  return (
    <>
      <PageHeader title="Project Gallery">
        <p className="text-[15px] text-[#6E6E68]">
          Browse what hackers built at every Patriot HackFest.
        </p>
      </PageHeader>
      <h2 className="sr-only">Events</h2>
      {events.length === 0 ? (
        <p className={cn(PAPER, "max-w-[720px] p-6")}>
          No project galleries are published yet.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <li key={event.slug} className="flex">
              <Link
                href={`/${event.slug}`}
                className={cn(
                  PAPER,
                  "group flex w-full flex-col gap-1 p-6 transition-colors hover:border-[#3A4A2B]/40"
                )}
              >
                <h3 className={cn(SERIF, "text-[30px] leading-[1.1]")}>
                  {event.name}
                </h3>
                {event.starts_at && (
                  <time
                    dateTime={event.starts_at}
                    className="text-[14.5px] text-[#6E6E68]"
                  >
                    {dateFormat.format(new Date(event.starts_at))}
                  </time>
                )}
                <span className="mt-3 text-sm font-medium underline-offset-2 group-hover:underline">
                  View projects
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
