import { Button } from "@workspace/ui/components/button"

import { site } from "@/content/site"
import { appUrl } from "@/lib/env"
import { formatEventDates } from "@/lib/event-dates"

export function Hero() {
  const { event } = site

  return (
    <section
      aria-labelledby="hero-heading"
      className="flex flex-col items-center gap-6 px-6 pt-24 pb-16 text-center sm:pt-32 sm:pb-20"
    >
      <h1
        id="hero-heading"
        className="text-4xl font-semibold tracking-tight sm:text-6xl xl:text-7xl 2xl:text-8xl"
      >
        {site.name}
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">{site.tagline}</p>
      <dl className="flex flex-col gap-1 text-sm sm:flex-row sm:gap-6">
        <div className="flex gap-2">
          <dt className="font-medium">{event.name}</dt>
          <dd className="text-muted-foreground">
            {formatEventDates(event.startsOn, event.endsOn)}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="sr-only">Location</dt>
          <dd className="text-muted-foreground">
            {event.location ?? "Location coming soon"}
          </dd>
        </div>
      </dl>
      {event.applicationsOpen ? (
        <Button asChild size="lg">
          <a href={appUrl}>Apply now</a>
        </Button>
      ) : (
        <p className="text-sm font-medium">Applications open soon</p>
      )}
    </section>
  )
}
