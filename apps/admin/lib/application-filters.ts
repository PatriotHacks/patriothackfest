import "server-only"

import type { ServerClient } from "@workspace/supabase/server"
import * as z from "zod"

import { DECISIONS, ROLES, STATUSES } from "./roles"

const optional = <T extends z.ZodType>(schema: T) =>
  schema.optional().catch(undefined)

const filtersSchema = z.object({
  event: optional(z.guid()),
  role: optional(z.enum(ROLES)),
  status: optional(z.enum(STATUSES)),
  decision: optional(z.enum(DECISIONS)),
  released: optional(z.enum(["yes", "no"])),
  declined: optional(z.enum(["yes", "no"])),
  q: optional(z.string().trim().min(1).max(100)),
})

export type ApplicationFilters = z.infer<typeof filtersSchema>

type SearchParams = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value

export function parseFilters(params: SearchParams): ApplicationFilters {
  return filtersSchema.parse(
    Object.fromEntries(
      Object.keys(filtersSchema.shape).map((key) => [key, first(params[key])])
    )
  )
}

export function parsePage(params: SearchParams) {
  return z.coerce.number().int().min(1).catch(1).parse(first(params.page))
}

export function filtersQuery(
  filters: ApplicationFilters,
  extra: Record<string, string> = {}
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `?${query}` : ""
}

const COLUMNS =
  "id, role, status, created_at, submitted_at, declined_at, withdrawn_at, event_id, form_id, profiles!inner(full_name, email), forms!inner(decisions_released_at), application_decisions(decision), undecided:application_decisions(decision)"

export function filteredApplications(
  supabase: ServerClient,
  filters: ApplicationFilters,
  count?: "exact"
) {
  let query = supabase
    .from("applications")
    .select(COLUMNS, count ? { count } : undefined)

  if (filters.event) query = query.eq("event_id", filters.event)
  if (filters.role) query = query.eq("role", filters.role)
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.declined === "yes") query = query.not("declined_at", "is", null)
  if (filters.declined === "no") query = query.is("declined_at", null)
  if (filters.released === "yes")
    query = query.not("forms.decisions_released_at", "is", null)
  if (filters.released === "no")
    query = query.is("forms.decisions_released_at", null)
  if (filters.decision === "pending") {
    query = query
      .in("undecided.decision", ["accepted", "waitlisted", "rejected"])
      .is("undecided", null)
  } else if (filters.decision) {
    query = query
      .eq("application_decisions.decision", filters.decision)
      .not("application_decisions", "is", null)
  }
  if (filters.q) {
    const term = `"%${filters.q.replace(/["\\]/g, "")}%"`
    query = query.or(`full_name.ilike.${term},email.ilike.${term}`, {
      referencedTable: "profiles",
    })
  }
  return query
}
