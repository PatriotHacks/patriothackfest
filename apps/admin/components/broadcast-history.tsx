import { formatInZone } from "@workspace/forms"
import { roleLabel, type Role } from "@workspace/supabase/roles"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Fragment } from "react"

import { retryBroadcast, sendBroadcastBatch } from "@/app/(admin)/email/actions"
import { EmailSender } from "@/components/email-sender"
import { TableCard } from "@/components/table-card"

type Broadcast = {
  id: string
  role: Role | null
  subject: string
  body: string
  created_at: string
  sender_email: string | null
  recipients: number
  sent: number
  failed: number
  pending: number
  sending: number
  cancelled: number
}

export function BroadcastHistory({
  broadcasts,
  eventSlug,
  configured,
}: {
  broadcasts: Broadcast[]
  eventSlug: string
  configured: boolean
}) {
  if (broadcasts.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No broadcasts sent for this event.
      </p>
    )

  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Sender</TableHead>
            <TableHead>Recipients</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead className="text-right">Sent</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead className="text-right">Pending</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {broadcasts.map((b) => (
            <Fragment key={b.id}>
              <TableRow className="border-b-0">
                <TableCell>{formatInZone(b.created_at)}</TableCell>
                <TableCell>{b.sender_email}</TableCell>
                <TableCell>
                  {b.role ? roleLabel(b.role, eventSlug) : "All roles"}
                </TableCell>
                <TableCell className="whitespace-normal">{b.subject}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.sent}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.failed}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.pending + b.sending}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={7} className="whitespace-normal">
                  <div className="flex flex-col gap-3">
                    <details>
                      <summary className="cursor-pointer text-sm text-muted-foreground">
                        Body ({b.recipients} recipients, {b.cancelled}{" "}
                        cancelled)
                      </summary>
                      <pre className="mt-2 font-sans text-sm whitespace-pre-wrap">
                        {b.body}
                      </pre>
                    </details>
                    {b.pending + b.sending + b.failed > 0 && (
                      <EmailSender
                        send={sendBroadcastBatch.bind(null, b.id)}
                        retry={retryBroadcast.bind(null, b.id)}
                        pending={b.pending}
                        sending={b.sending}
                        failed={b.failed}
                        configured={configured}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  )
}
