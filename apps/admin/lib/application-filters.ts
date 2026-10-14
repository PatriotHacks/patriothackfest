import "server-only"

import { ROLES } from "@workspace/supabase/roles"
import * as z from "zod"

import { DECISIONS, STATUSES } from "./roles"

const optional = <T extends z.ZodType>(schema: T) =>
  schema.optional().catch(undefined)

const filtersSchema = z.object({
  event: optional(z.string().trim().min(1).max(100)),
  role: optional(z.enum(ROLES)),
  status: optional(z.enum(STATUSES)),
  decision: optional(z.enum(DECISIONS)),
  released: optional(z.enum(["yes", "no"])),
  declined: optional(z.enum(["yes", "no"])),
  under18: optional(z.enum(["yes", "no"])),
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

export function filterEmbeds<Columns extends string>(
  columns: Columns,
  filters: ApplicationFilters
) {
  const embeds = [
    filters.event && "filter_event:events!inner()",
    filters.q && "filter_profile:profiles!inner()",
    filters.released && "filter_form:forms!inner()",
    filters.decision === "pending" && "undecided:application_decisions()",
    filters.decision &&
      filters.decision !== "pending" &&
      "filter_decision:application_decisions!inner()",
  ].filter(Boolean)
  return [columns, ...embeds].join(", ") as Columns
}

type Filterable<Query> = {
  eq(column: string, value: string | boolean): Query
  not(column: string, operator: "is", value: null): Query
  is(column: string, value: null): Query
  in(column: string, values: string[]): Query
  or(filters: string, options: { referencedTable: string }): Query
}

export function applyFilters<Query extends Filterable<Query>>(
  query: Query,
  filters: ApplicationFilters
) {
  if (filters.event) query = query.eq("filter_event.slug", filters.event)
  if (filters.role) query = query.eq("role", filters.role)
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.declined === "yes") query = query.not("declined_at", "is", null)
  if (filters.declined === "no") query = query.is("declined_at", null)
  if (filters.under18) query = query.eq("under_18", filters.under18 === "yes")
  if (filters.released === "yes")
    query = query.not("filter_form.decisions_released_at", "is", null)
  if (filters.released === "no")
    query = query.is("filter_form.decisions_released_at", null)
  if (filters.decision === "pending") {
    query = query
      .in("undecided.decision", ["accepted", "waitlisted", "rejected"])
      .is("undecided", null)
  } else if (filters.decision) {
    query = query.eq("filter_decision.decision", filters.decision)
  }
  if (filters.q) {
    const term = `"%${filters.q.replace(/["\\]/g, "")}%"`
    query = query.or(`full_name.ilike.${term},email.ilike.${term}`, {
      referencedTable: "filter_profile",
    })
  }
  return query
}
