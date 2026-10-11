"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import Link from "next/link"
import { useState, useTransition } from "react"

import { setDecisions } from "@/app/(admin)/applications/actions"
import type { Decision } from "@/lib/roles"

import { DecisionBadge } from "./decision-badge"
import { DecisionSelect } from "./decision-select"

export type ApplicationRow = {
  id: string
  href: string
  name: string
  email: string
  role: string
  status: string
  submittedAt: string
  declined: boolean
  decision: Decision | null
  released: boolean
  blockedReason: string | null
}

export function ApplicationsTable({ rows }: { rows: ApplicationRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [decision, setDecision] = useState<Decision>()
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selectable = rows.filter((r) => r.blockedReason === null)
  const blockedReasons = [
    ...new Set(rows.flatMap((r) => r.blockedReason ?? [])),
  ]
  const allSelected =
    selectable.length > 0 && selectable.every((r) => selected.has(r.id))

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function apply() {
    setMessage(null)
    startTransition(async () => {
      const result = await setDecisions([...selected], decision!)
      if (result.error) {
        setMessage(result.error)
        return
      }
      setMessage(`Updated ${selected.size} applications`)
      setSelected(new Set())
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="bulk-decision">Set decision for selected</Label>
          <DecisionSelect
            id="bulk-decision"
            value={decision}
            onChange={setDecision}
            disabled={pending}
          />
        </div>
        <Button
          onClick={apply}
          disabled={pending || selected.size === 0 || !decision}
        >
          Apply to {selected.size} selected
        </Button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
      {blockedReasons.length > 0 && (
        <div className="text-sm text-muted-foreground">
          <p>Some rows cannot be selected:</p>
          <ul className="list-disc pl-5">
            {blockedReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <Checkbox
                aria-label="Select all applications on this page"
                checked={allSelected}
                disabled={selectable.length === 0}
                onCheckedChange={(checked) =>
                  setSelected(
                    checked === true
                      ? new Set(selectable.map((r) => r.id))
                      : new Set()
                  )
                }
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Decision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Checkbox
                  aria-label={`Select ${row.name}`}
                  title={row.blockedReason ?? undefined}
                  disabled={row.blockedReason !== null}
                  checked={selected.has(row.id)}
                  onCheckedChange={(checked) =>
                    toggle(row.id, checked === true)
                  }
                />
              </TableCell>
              <TableCell>
                <Link href={row.href} className="underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell>{row.role}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {row.status}
                  {row.declined && <Badge variant="outline">Declined</Badge>}
                </div>
              </TableCell>
              <TableCell>{row.submittedAt}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <DecisionBadge decision={row.decision} />
                  {row.released && <Badge variant="outline">Released</Badge>}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                No applications match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
