import { formatInZone } from "@workspace/forms"
import { roleLabel } from "@workspace/supabase/roles"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { redirect } from "next/navigation"

import { ApplicationFiltersForm } from "@/components/application-filters-form"
import { ApplicationsTable } from "@/components/applications-table"
import { EventTabs } from "@/components/event-tabs"
import { PageHeader } from "@/components/page-header"
import { getAdmin } from "@/lib/admin"
import {
  applyFilters,
  filterEmbeds,
  filtersQuery,
  parseFilters,
  parsePage,
} from "@/lib/application-filters"
import { decisionBlockedReason } from "@/lib/decisions"
import { selectEvent } from "@/lib/events"
import { hasLevel } from "@/lib/levels"
import { STATUS_LABELS } from "@/lib/roles"

const PAGE_SIZE = 50

export default async function ApplicationsPage({
  searchParams,
}: PageProps<"/applications">) {
  const params = await searchParams
  const page = parsePage(params)
  const { supabase, level } = await getAdmin()
  const isOrganizer = hasLevel(level, "organizer")
  const from = (page - 1) * PAGE_SIZE

  const events = await supabase
    .from("events")
    .select("id, slug, name, starts_at, ends_at")
    .order("starts_at", { nullsFirst: false })
    .order("slug")
  if (events.error) throw new Error(events.error.message)

  const parsed = parseFilters(params)
  const event = selectEvent(events.data, parsed.event)
  const filters = { ...parsed, event: event?.slug }

  const [forms, applications] = await Promise.all([
    supabase.from("forms").select("id, event_id, role"),
    applyFilters(
      supabase
        .from("applications")
        .select(
          filterEmbeds(
            "id, role, status, submitted_at, declined_at, under_18, profiles(full_name, email), forms(decisions_released_at), application_decisions(decision)",
            filters
          ),
          { count: "exact" }
        ),
      filters
    )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
  ])
  if (forms.error) throw new Error(forms.error.message)
  if (applications.error?.code === "PGRST103")
    redirect(`/applications${filtersQuery(filters)}`)
  if (applications.error) throw new Error(applications.error.message)

  const total = applications.count ?? 0
  const form = forms.data.find(
    (f) => f.event_id === event?.id && f.role === filters.role
  )
  const detailQuery = filtersQuery(filters, { page: String(page) })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Applications"
        description="Review submitted applications and set decisions."
      >
        {form && isOrganizer && (
          <Button asChild variant="outline" size="sm">
            <a href={`/forms/${form.id}/export`}>Export CSV</a>
          </Button>
        )}
      </PageHeader>
      {event && (
        <EventTabs
          events={events.data}
          selected={event.slug}
          basePath="/applications"
        />
      )}
      <ApplicationFiltersForm filters={filters} />
      <ApplicationsTable
        key={detailQuery}
        rows={applications.data.map((a) => ({
          id: a.id,
          href: `/applications/${a.id}${detailQuery}`,
          name: a.profiles.full_name ?? "No name",
          email: a.profiles.email,
          under18: a.under_18 === true,
          role: roleLabel(a.role, filters.event),
          status: STATUS_LABELS[a.status],
          draft: a.status === "draft",
          submittedAt: a.submitted_at ? formatInZone(a.submitted_at) : "",
          declined: a.declined_at !== null,
          decision: a.application_decisions?.decision ?? null,
          released: a.forms.decisions_released_at !== null,
          blockedReason: decisionBlockedReason(
            {
              status: a.status,
              declined_at: a.declined_at,
              released: a.forms.decisions_released_at !== null,
            },
            isOrganizer
          ),
        }))}
      />
      <nav aria-label="Pagination" className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          {total === 0
            ? "0 applications"
            : `${from + 1}–${from + applications.data.length} of ${total}`}
        </span>
        {page > 1 && (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/applications${filtersQuery(filters, { page: String(page - 1) })}`}
            >
              Previous
            </Link>
          </Button>
        )}
        {from + PAGE_SIZE < total && (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/applications${filtersQuery(filters, { page: String(page + 1) })}`}
            >
              Next
            </Link>
          </Button>
        )}
      </nav>
    </div>
  )
}
