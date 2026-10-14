"use client"

import {
  BROADCAST_VARIABLES,
  EMAIL_DAILY_LIMIT,
  renderBroadcast,
} from "@workspace/email/broadcast"
import {
  BODY_MAX_LENGTH,
  SUBJECT_MAX_LENGTH,
  validateTemplate,
} from "@workspace/email/templates"
import { ROLE_LABELS, ROLES, type Role } from "@workspace/supabase/roles"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"

import {
  createBroadcast,
  getBroadcastRecipientCount,
  retryBroadcast,
  sendBroadcastBatch,
  sendBroadcastTest,
} from "@/app/(admin)/email/actions"
import { BodyField } from "@/components/body-field"
import { EmailSender } from "@/components/email-sender"
import {
  BROADCAST_SAMPLE_VALUES,
  BROADCAST_VARIABLE_INFO,
} from "@/lib/email-templates"

type Props = {
  eventId: string
  eventName: string
  adminEmail: string
  emailDisabledReason: string | null
}

type Confirm = { recipients: number; dailyUsed: number }

function preview(subject: string, body: string) {
  try {
    return {
      email: renderBroadcast({ subject, body }, BROADCAST_SAMPLE_VALUES),
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export function BroadcastComposer({
  eventId,
  eventName,
  adminEmail,
  emailDisabledReason,
}: Props) {
  const id = useId()
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [queued, setQueued] = useState<{ id: string; count: number } | null>(
    null
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [testing, startTest] = useTransition()
  const [counting, startCount] = useTransition()
  const [creating, startCreate] = useTransition()

  const errors = validateTemplate({ subject, body }, BROADCAST_VARIABLES)
  const rendered = errors.length === 0 ? preview(subject, body) : null
  const roleLabel = role ? ROLE_LABELS[role] : "All roles"
  const remaining = confirm
    ? Math.max(EMAIL_DAILY_LIMIT - confirm.dailyUsed, 0)
    : 0
  const overBudget = confirm !== null && confirm.recipients > remaining
  const disabled = errors.length > 0 || emailDisabledReason !== null

  function sendTest() {
    setMessage(null)
    setError(null)
    startTest(async () => {
      const result = await sendBroadcastTest(subject, body)
      if (result.error) return setError(result.error)
      setMessage(`Test email sent to ${adminEmail}.`)
    })
  }

  function review() {
    setMessage(null)
    setError(null)
    startCount(async () => {
      const result = await getBroadcastRecipientCount(eventId, role)
      if (result.error !== null) return setError(result.error)
      if (result.recipients === 0)
        return setError(`No submitted applications match ${roleLabel}.`)
      setDialogError(null)
      setConfirm(result)
    })
  }

  function send() {
    if (!confirm) return
    setDialogError(null)
    startCreate(async () => {
      const result = await createBroadcast(
        eventId,
        role,
        subject,
        body,
        confirm.recipients
      )
      if (result.error !== null) return setDialogError(result.error)
      setQueued({ id: result.broadcastId, count: confirm.recipients })
      setConfirm(null)
      setSubject("")
      setBody("")
      router.refresh()
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
          <CardDescription>
            Email every submitted application for {eventName}, skipping
            withdrawn and declined applicants. Plain text; a blank line starts a
            new paragraph. The subject becomes the heading, and the sign-off is
            added automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-role`}>Recipients</Label>
            <Select
              value={role ?? "all"}
              onValueChange={(v) => setRole(v === "all" ? null : (v as Role))}
            >
              <SelectTrigger id={`${id}-role`} className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-subject`}>Subject</Label>
            <Input
              id={`${id}-subject`}
              value={subject}
              maxLength={SUBJECT_MAX_LENGTH}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <BodyField
            id={`${id}-body`}
            value={body}
            onChange={setBody}
            maxLength={BODY_MAX_LENGTH}
            variables={BROADCAST_VARIABLES}
            info={BROADCAST_VARIABLE_INFO}
            className="min-h-60"
          />
          {(subject !== "" || body !== "") && errors.length > 0 && (
            <ul className="text-sm text-destructive">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={review} disabled={disabled || counting}>
              {counting ? "Counting..." : "Send"}
            </Button>
            <Button
              variant="outline"
              onClick={sendTest}
              disabled={disabled || testing}
            >
              {testing ? "Sending..." : "Send test to me"}
            </Button>
          </div>
          {emailDisabledReason && (
            <p className="text-sm text-muted-foreground">
              {emailDisabledReason}
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm">{message}</p>}
          {queued && (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">
                Broadcast queued for {queued.count} applicants
              </p>
              <EmailSender
                key={queued.id}
                send={sendBroadcastBatch.bind(null, queued.id)}
                retry={retryBroadcast.bind(null, queued.id)}
                pending={queued.count}
                sending={0}
                failed={0}
                configured={emailDisabledReason === null}
                autoStart
              />
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Rendered with sample data.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rendered?.email ? (
            <>
              <p className="text-sm">
                <span className="text-muted-foreground">Subject: </span>
                {rendered.email.subject}
              </p>
              <iframe
                title="Broadcast preview"
                sandbox=""
                srcDoc={rendered.email.html}
                className="h-[600px] w-full rounded-lg border"
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {rendered?.error ?? "Write a subject and body to see a preview."}
            </p>
          )}
        </CardContent>
      </Card>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !creating) setConfirm(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Send to {confirm?.recipients} applicants of {eventName} (
              {roleLabel})?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Recipients are fixed when you confirm;
              applicants who submit later are not added. {remaining} of the{" "}
              {EMAIL_DAILY_LIMIT} daily emails remain ({confirm?.dailyUsed} sent
              in the last 24 hours or still queued).
            </AlertDialogDescription>
          </AlertDialogHeader>
          {overBudget && (
            <p className="text-sm font-medium text-destructive">
              This would exceed the daily email limit. Try again later or narrow
              the recipients.
            </p>
          )}
          {dialogError && (
            <p role="alert" className="text-sm text-destructive">
              {dialogError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={creating || overBudget}
              onClick={(e) => {
                e.preventDefault()
                send()
              }}
            >
              {creating ? "Queueing..." : "Send"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
