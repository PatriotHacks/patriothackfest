"use client"

import { Switch } from "@workspace/ui/components/switch"
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
  saveInvitationLetter,
  saveJudgeCertificate,
  setJudgeInvitation,
} from "@/app/(admin)/post-judging/actions"
import { DocumentControl } from "@/components/post-judging/document-control"
import { TableCard } from "@/components/table-card"
import {
  certificatePath,
  invitationLetterPath,
  type PostJudgingJudge,
} from "@/lib/judge-documents"

export function InvitationLetter({
  eventId,
  path,
}: {
  eventId: string
  path: string | null
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">Invitation letter</h2>
      <p className="text-sm text-muted-foreground">
        One PDF for the event, shown only to judges with the invitation letter
        switch on.
      </p>
      <DocumentControl
        label="Invitation letter"
        path={path}
        newPath={() => invitationLetterPath(eventId)}
        save={(next) => saveInvitationLetter({ eventId, path: next })}
      />
    </section>
  )
}

function InvitationSwitch({
  eventId,
  judge,
}: {
  eventId: string
  judge: PostJudgingJudge
}) {
  const [checked, setChecked] = useState(judge.receives_invitation)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-1">
      <Switch
        checked={checked}
        disabled={pending}
        aria-label={`Invitation letter for ${judge.email}`}
        onCheckedChange={(receives) => {
          setChecked(receives)
          setError(null)
          startTransition(async () => {
            const result = await setJudgeInvitation({
              eventId,
              judgeId: judge.id,
              receives,
            })
            if (result.error) {
              setChecked(!receives)
              setError(result.error)
            }
          })
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function JudgeDocuments({
  eventId,
  judges,
}: {
  eventId: string
  judges: PostJudgingJudge[]
}) {
  if (judges.length === 0)
    return <p className="text-sm">No active judges for this event.</p>
  return (
    <TableCard>
      <Table aria-label="Judge documents">
        <TableHeader>
          <TableRow>
            <TableHead>Judge</TableHead>
            <TableHead>Certificate</TableHead>
            <TableHead>Invitation letter</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {judges.map((judge) => (
            <TableRow key={judge.id}>
              <TableCell className="align-top break-words whitespace-normal">
                {judge.email}
                {judge.guest && (
                  <p className="text-xs text-muted-foreground">Guest</p>
                )}
              </TableCell>
              <TableCell className="align-top whitespace-normal">
                <DocumentControl
                  label={`Certificate for ${judge.email}`}
                  path={judge.certificate_path}
                  newPath={() => certificatePath(eventId, judge.id)}
                  save={(path) =>
                    saveJudgeCertificate({ eventId, judgeId: judge.id, path })
                  }
                />
              </TableCell>
              <TableCell className="align-top">
                <InvitationSwitch eventId={eventId} judge={judge} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  )
}
