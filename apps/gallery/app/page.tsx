import Link from "next/link"
import { redirect } from "next/navigation"

import { PageHero, Sheet } from "@/components/page-hero"
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
      <PageHero eyebrow="Patriot HackFest" title="Project Gallery">
        <p className="max-w-[680px] text-[19px] leading-relaxed">
          Browse what hackers built at every Patriot HackFest.
        </p>
      </PageHero>
      <Sheet>
        <h2 className="sr-only">Events</h2>
        {events.length === 0 ? (
          <p className="text-muted">No project galleries are published yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <li key={event.slug} className="flex">
                <Link
                  href={`/${event.slug}`}
                  className="ink hatch group flex w-full flex-col gap-2 rounded px-6 pt-6 pb-7 no-underline transition-transform [--fill:var(--color-card)] hover:-translate-y-1"
                >
                  {event.starts_at && (
                    <time dateTime={event.starts_at} className="eyebrow">
                      {dateFormat.format(new Date(event.starts_at))}
                    </time>
                  )}
                  <h3 className="group-hover:text-cream text-[22px] font-bold">
                    {event.name}
                  </h3>
                  <p className="text-base text-muted">View projects</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  )
}
