"use client"

import { EVENT_TIME_ZONE, toZonedInputValue } from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useId, useState, useTransition } from "react"

import { updateDeadlines } from "@/app/(admin)/forms/actions"

type Props = {
  formId: string
  submissionsCloseAt: string | null
  editsLockAt: string | null
  canEdit: boolean
}

export function DeadlinesForm({
  formId,
  submissionsCloseAt,
  editsLockAt,
  canEdit,
}: Props) {
  const id = useId()
  const [close, setClose] = useState(
    submissionsCloseAt ? toZonedInputValue(submissionsCloseAt) : ""
  )
  const [lock, setLock] = useState(
    editsLockAt ? toZonedInputValue(editsLockAt) : ""
  )
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const { error } = await updateDeadlines(formId, close, lock)
      setMessage(error ?? "Deadlines saved")
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-close`}>Submissions close</Label>
          <Input
            id={`${id}-close`}
            type="datetime-local"
            value={close}
            onChange={(e) => setClose(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-lock`}>Edits lock</Label>
          <Input
            id={`${id}-lock`}
            type="datetime-local"
            value={lock}
            onChange={(e) => setLock(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        {canEdit && (
          <Button onClick={save} disabled={pending} variant="outline">
            Save deadlines
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Times are in {EVENT_TIME_ZONE}. Deadline changes apply immediately.
      </p>
      {message && <p className="text-sm">{message}</p>}
    </div>
  )
}
