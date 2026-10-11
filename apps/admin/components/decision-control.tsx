"use client"

import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { useState, useTransition } from "react"

import { setDecisions } from "@/app/(admin)/applications/actions"
import type { Decision } from "@/lib/roles"

import { DecisionSelect } from "./decision-select"

export function DecisionControl({
  applicationId,
  decision,
  blockedReason,
}: {
  applicationId: string
  decision: Decision | null
  blockedReason: string | null
}) {
  const [value, setValue] = useState<Decision | undefined>(
    decision ?? undefined
  )
  const [savedDecision, setSavedDecision] = useState(decision)
  const [message, setMessage] = useState<string | null>(null)
  if (decision !== savedDecision) {
    setSavedDecision(decision)
    setValue(decision ?? undefined)
  }
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="decision">Decision</Label>
          <DecisionSelect
            id="decision"
            value={value}
            onChange={(next) => {
              setValue(next)
              setMessage(null)
            }}
            disabled={blockedReason !== null || pending}
          />
        </div>
        <Button
          disabled={
            blockedReason !== null || pending || !value || value === decision
          }
          onClick={() =>
            startTransition(async () => {
              const result = await setDecisions([applicationId], value!)
              setMessage(result.error ?? "Decision saved")
            })
          }
        >
          Save decision
        </Button>
      </div>
      {blockedReason && (
        <p className="text-sm text-muted-foreground">{blockedReason}</p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  )
}
