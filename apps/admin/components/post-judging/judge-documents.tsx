"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  saveJudgeCertificate,
  saveJudgeInvitationLetter,
} from "@/app/(admin)/post-judging/actions"
import { DocumentControl } from "@/components/post-judging/document-control"
import { TableCard } from "@/components/table-card"
import {
  certificatePath,
  invitationLetterPath,
  type PostJudgingJudge,
} from "@/lib/judge-documents"

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
              <TableCell className="align-top whitespace-normal">
                <DocumentControl
                  label={`Invitation letter for ${judge.email}`}
                  path={judge.invitation_letter_path}
                  newPath={() => invitationLetterPath(eventId, judge.id)}
                  save={(path) =>
                    saveJudgeInvitationLetter({
                      eventId,
                      judgeId: judge.id,
                      path,
                    })
                  }
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  )
}
