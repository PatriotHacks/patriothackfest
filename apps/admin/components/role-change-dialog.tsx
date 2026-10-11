"use client"

import type { Role } from "@workspace/supabase/roles"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
import { useState, useTransition } from "react"

import { changeApplicationRole } from "@/app/(admin)/applications/actions"

export type RoleOption = { role: Role; label: string; reason: string | null }

export function RoleChangeDialog({
  applicationId,
  options,
  blockedReason,
}: {
  applicationId: string
  options: RoleOption[]
  blockedReason: string | null
}) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<Role>()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          setRole(undefined)
          setError(null)
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="w-fit"
            disabled={blockedReason !== null}
          >
            Change role
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change application role</AlertDialogTitle>
            <AlertDialogDescription>
              The current answers are archived, any decision is cleared, and the
              application returns to draft on the new role&apos;s form. The
              applicant is not emailed; contact them so they complete and submit
              the new form.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <RadioGroup
            value={role ?? ""}
            onValueChange={(v) => setRole(v as Role)}
            aria-label="New role"
          >
            {options.map((option) => (
              <div key={option.role} className="flex items-center gap-2">
                <RadioGroupItem
                  value={option.role}
                  id={`role-${option.role}`}
                  disabled={option.reason !== null}
                />
                <Label htmlFor={`role-${option.role}`}>
                  {option.label}
                  {option.reason && (
                    <span className="font-normal text-muted-foreground">
                      ({option.reason})
                    </span>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending || !role}
              onClick={(e) => {
                e.preventDefault()
                setError(null)
                startTransition(async () => {
                  const result = await changeApplicationRole(
                    applicationId,
                    role!
                  )
                  setError(result.error)
                  if (!result.error) setOpen(false)
                })
              }}
            >
              Change role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {blockedReason && (
        <p className="text-sm text-muted-foreground">{blockedReason}</p>
      )}
    </div>
  )
}
