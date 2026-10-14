import { ROLE_LABELS, ROLES } from "@workspace/supabase/roles"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import Link from "next/link"

import type { ApplicationFilters } from "@/lib/application-filters"
import {
  DECISION_LABELS,
  DECISIONS,
  STATUS_LABELS,
  STATUSES,
} from "@/lib/roles"

const ALL = "all"

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string
  label: string
  value: string | undefined
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`filter-${name}`}>{label}</Label>
      <Select name={name} defaultValue={value ?? ALL}>
        <SelectTrigger id={`filter-${name}`} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
]

export function ApplicationFiltersForm({
  filters,
}: {
  filters: ApplicationFilters
}) {
  const clearHref = filters.event
    ? `/applications?event=${encodeURIComponent(filters.event)}`
    : "/applications"

  return (
    <form className="flex flex-wrap items-end gap-3" action="/applications">
      {filters.event && (
        <input type="hidden" name="event" value={filters.event} />
      )}
      <FilterSelect
        name="role"
        label="Role"
        value={filters.role}
        options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
      />
      <FilterSelect
        name="status"
        label="Status"
        value={filters.status}
        options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
      />
      <FilterSelect
        name="decision"
        label="Decision"
        value={filters.decision}
        options={DECISIONS.map((d) => ({
          value: d,
          label: d === "pending" ? "Undecided" : DECISION_LABELS[d],
        }))}
      />
      <FilterSelect
        name="released"
        label="Released"
        value={filters.released}
        options={yesNo}
      />
      <FilterSelect
        name="declined"
        label="Declined"
        value={filters.declined}
        options={yesNo}
      />
      <FilterSelect
        name="under18"
        label="Under 18"
        value={filters.under18}
        options={yesNo}
      />
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-q">Name or email</Label>
        <Input
          id="filter-q"
          name="q"
          type="search"
          className="w-56"
          defaultValue={filters.q ?? ""}
        />
      </div>
      <Button type="submit">Apply</Button>
      <Button asChild variant="ghost">
        <Link href={clearHref}>Clear</Link>
      </Button>
    </form>
  )
}
