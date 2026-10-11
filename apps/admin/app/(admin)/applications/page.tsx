import { formatInZone } from "@workspace/forms"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import Link from "next/link"
import { redirect } from "next/navigation"

import { ApplicationFiltersForm } from "@/components/application-filters-form"
import { DecisionBadge } from "@/components/decision-badge"
import { getAdmin } from "@/lib/admin"
import {
  filteredApplications,
  filtersQuery,
  parseFilters,
  parsePage,
} from "@/lib/application-filters"
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.data.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <Link
                  href={`/applications/${a.id}${detailQuery}`}
                  className="underline"
                >
                  {a.profiles.full_name ?? "No name"}
                </Link>
              </TableCell>
              <TableCell>{a.profiles.email}</TableCell>
              <TableCell>{ROLE_LABELS[a.role]}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {STATUS_LABELS[a.status]}
                  {a.declined_at && <Badge variant="outline">Declined</Badge>}
                </div>
              </TableCell>
              <TableCell>
                {a.submitted_at ? formatInZone(a.submitted_at) : ""}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <DecisionBadge
                    decision={a.application_decisions?.decision ?? null}
                  />
                  {a.forms.decisions_released_at && (
                    <Badge variant="outline">Released</Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {applications.data.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                No applications match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
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
