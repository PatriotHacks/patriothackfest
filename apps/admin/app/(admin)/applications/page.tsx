import { formatInZone } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { redirect } from "next/navigation"

import { ApplicationFiltersForm } from "@/components/application-filters-form"
import { ApplicationsTable } from "@/components/applications-table"
import { getAdmin } from "@/lib/admin"
import {
  filteredApplications,
  filtersQuery,
  parseFilters,
  parsePage,
} from "@/lib/application-filters"
import { decisionBlockedReason } from "@/lib/decisions"
import { hasLevel } from "@/lib/levels"
import { ROLE_LABELS, STATUS_LABELS } from "@/lib/roles"

const PAGE_SIZE = 50

export default async function ApplicationsPage({
  searchParams,
}: PageProps<"/applications">) {
  const params = await searchParams
  const filters = parseFilters(params)
  const page = parsePage(params)
  const { supabase, level } = await getAdmin()
  const isOrganizer = hasLevel(level, "organizer")
  const from = (page - 1) * PAGE_SIZE

  const [events, forms, applications] = await Promise.all([
    supabase
      .from("events")
      .select("id, name")
      .order("starts_at", { nullsFirst: false })
      .order("slug"),
    supabase.from("forms").select("id, event_id, role"),
    filteredApplications(supabase, filters, "exact")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
  ])
  if (events.error) throw new Error(events.error.message)
  if (forms.error) throw new Error(forms.error.message)
  if (applications.error?.code === "PGRST103")
    redirect(`/applications${filtersQuery(filters)}`)
  if (applications.error) throw new Error(applications.error.message)

  const total = applications.count ?? 0
  const form = forms.data.find(
    (f) => f.event_id === filters.event && f.role === filters.role
  )
  const detailQuery = filtersQuery(filters, { page: String(page) })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Applications</h1>
        {form && isOrganizer && (
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <a href={`/forms/${form.id}/export`}>Export CSV</a>
          </Button>
        )}
      </div>
      <ApplicationFiltersForm filters={filters} events={events.data} />
      <ApplicationsTable
        key={detailQuery}
        rows={applications.data.map((a) => ({
          id: a.id,
          href: `/applications/${a.id}${detailQuery}`,
          name: a.profiles.full_name ?? "No name",
          email: a.profiles.email,
          role: ROLE_LABELS[a.role],
          status: STATUS_LABELS[a.status],
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
