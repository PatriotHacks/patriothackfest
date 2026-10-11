"use client"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { useState, useTransition } from "react"

import {
  addAdmin,
  removeAdmin,
  updateAdminLevel,
} from "@/app/(admin)/admins/actions"
import type { ActionResult } from "@/lib/action-result"
import { ADMIN_LEVELS, type AdminLevel } from "@/lib/levels"

function LevelSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: AdminLevel
  onChange: (level: AdminLevel) => void
  disabled?: boolean
  label: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as AdminLevel)}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ADMIN_LEVELS.map((level) => (
          <SelectItem key={level} value={level}>
            {level}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AdminsManager({
  admins,
  currentEmail,
}: {
  admins: { email: string; level: AdminLevel }[]
  currentEmail: string
}) {
  const [email, setEmail] = useState("")
  const [level, setLevel] = useState<AdminLevel>("reviewer")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const ownerCount = admins.filter((a) => a.level === "owner").length

  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (result.error) setError(result.error)
      else onSuccess?.()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          run(
            () => addAdmin(email, level),
            () => setEmail("")
          )
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="admin-email">Email</Label>
          <Input
            id="admin-email"
            type="email"
            required
            className="w-72"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <LevelSelect
          value={level}
          onChange={setLevel}
          label="New admin level"
        />
        <Button type="submit" disabled={pending}>
          Add admin
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Level</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {admins.map((admin) => {
            const isSelf =
              admin.email.toLowerCase() === currentEmail.toLowerCase()
            const lastOwner = admin.level === "owner" && ownerCount === 1
            return (
              <TableRow key={admin.email}>
                <TableCell>
                  {admin.email}
                  {isSelf && (
                    <span className="text-muted-foreground"> (you)</span>
                  )}
                </TableCell>
                <TableCell>
                  <LevelSelect
                    value={admin.level}
                    label={`Level for ${admin.email}`}
                    disabled={pending || lastOwner}
                    onChange={(next) =>
                      run(() => updateAdminLevel(admin.email, next))
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending || lastOwner}
                    onClick={() => run(() => removeAdmin(admin.email))}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {ownerCount === 1 && (
        <p className="text-sm text-muted-foreground">
          The last owner cannot be removed or demoted.
        </p>
      )}
    </div>
  )
}
