import { formatInZone } from "@workspace/forms"
import { ROLE_LABELS } from "@workspace/supabase/roles"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import * as z from "zod"

import { EmailSender } from "@/components/email-sender"
import { ReleaseButton } from "@/components/release-button"
import { getAdmin } from "@/lib/admin"
import { EMAIL_NOT_CONFIGURED, isEmailConfigured } from "@/lib/email"
import { hasLevel } from "@/lib/levels"

export const maxDuration = 60

const EMAIL_STATUSES = [
  ["emails_pending", "Pending"],
  ["emails_sending", "Sending"],
  ["emails_sent", "Sent"],
  ["emails_failed", "Failed"],
  ["emails_cancelled", "Cancelled"],
] as const

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-lg border px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

export default async function ReleasePage({
  params,
}: PageProps<"/forms/[formId]/release">) {
  const { formId } = await params
  if (!z.guid().safeParse(formId).success) notFound()
  const { supabase, level } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")

  const [formResult, countsResult] = await Promise.all([
    supabase
      .from("forms")
      .select(
        "id, event_id, role, title, status, decisions_released_at, events(name, slug)"
      )
      .eq("id", formId)
      .maybeSingle(),
    supabase.rpc("admin_release_counts", { p_form_id: formId }).single(),
  ])
  if (formResult.error) throw new Error(formResult.error.message)
  if (countsResult.error) throw new Error(countsResult.error.message)
  const form = formResult.data
  const counts = countsResult.data
  if (!form) notFound()

  const configured = isEmailConfigured()
  const listHref = `/applications?event=${encodeURIComponent(form.events.slug)}&role=${form.role}`

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Release decisions</h1>
          <p className="text-muted-foreground">
            {form.events.name} · {ROLE_LABELS[form.role]} · {form.title}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={listHref}>Applications</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/forms/${form.id}/export`}>Export CSV</a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Decisions</CardTitle>
          <CardDescription>
            Submitted applications ({counts.submitted})
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Accepted" value={counts.accepted} />
            <Stat label="Waitlisted" value={counts.waitlisted} />
            <Stat label="Not accepted" value={counts.rejected} />
            <Stat label="Pending" value={counts.pending} />
            <Stat label="No decision" value={counts.undecided} />
            <Stat label="Declined by applicant" value={counts.declined} />
          </dl>
          {form.decisions_released_at ? (
            <p className="text-sm">
              Decisions were released on{" "}
              {formatInZone(form.decisions_released_at)}. Organizers can still
              change decisions; each change queues a new email.
            </p>
          ) : (
            <ReleaseButton
              formId={form.id}
              title={form.title}
              decided={counts.accepted + counts.waitlisted + counts.rejected}
              undecided={counts.pending + counts.undecided}
              disabledReason={
                form.status === "published"
                  ? null
                  : "Publish the form before releasing decisions."
              }
            />
          )}
        </CardContent>
      </Card>

      {form.decisions_released_at && (
        <Card>
          <CardHeader>
            <CardTitle>Decision emails</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {EMAIL_STATUSES.map(([key, label]) => (
                <Stat key={key} label={label} value={counts[key]} />
              ))}
            </dl>
            {!configured && (
              <Alert variant="destructive">
                <AlertTitle>Sending is disabled</AlertTitle>
                <AlertDescription>{EMAIL_NOT_CONFIGURED}</AlertDescription>
              </Alert>
            )}
            <EmailSender
              formId={form.id}
              pending={counts.emails_pending}
              sending={counts.emails_sending}
              failed={counts.emails_failed}
              configured={configured}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
