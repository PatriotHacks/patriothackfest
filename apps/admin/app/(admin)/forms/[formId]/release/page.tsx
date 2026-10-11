import { formatInZone } from "@workspace/forms"
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
import { fetchAll } from "@/lib/fetch-all"
import { hasLevel } from "@/lib/levels"
import { ROLE_LABELS } from "@/lib/roles"

export const maxDuration = 60

const EMAIL_STATUSES = {
  pending: "Pending",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
}

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

  const { data: form, error } = await supabase
    .from("forms")
    .select(
      "id, event_id, role, title, status, decisions_released_at, events(name)"
    )
    .eq("id", formId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!form) notFound()

  const [applications, emailCounts] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("applications")
        .select("id, declined_at, application_decisions(decision)")
        .eq("form_id", formId)
        .eq("status", "submitted")
        .order("id")
        .range(from, to)
    ),
    Promise.all(
      Object.entries(EMAIL_STATUSES).map(async ([status, label]) => {
        const { count, error } = await supabase
          .from("email_log")
          .select("id", { count: "exact", head: true })
          .eq("form_id", formId)
          .eq("status", status)
        if (error) throw new Error(error.message)
        return { status, label, count: count ?? 0 }
      })
    ),
  ])

  const decisionOf = (a: (typeof applications)[number]) =>
    a.application_decisions?.decision ?? null
  const count = (predicate: (a: (typeof applications)[number]) => boolean) =>
    applications.filter(predicate).length
  const accepted = count((a) => decisionOf(a) === "accepted")
  const waitlisted = count((a) => decisionOf(a) === "waitlisted")
  const rejected = count((a) => decisionOf(a) === "rejected")
  const pending = count((a) => decisionOf(a) === "pending")
  const none = count((a) => decisionOf(a) === null)
  const declined = count((a) => a.declined_at !== null)
  const emailCount = (status: keyof typeof EMAIL_STATUSES) =>
    emailCounts.find((c) => c.status === status)?.count ?? 0
  const configured = isEmailConfigured()
  const listHref = `/applications?event=${form.event_id}&role=${form.role}`

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
            Submitted applications ({applications.length})
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Accepted" value={accepted} />
            <Stat label="Waitlisted" value={waitlisted} />
            <Stat label="Not accepted" value={rejected} />
            <Stat label="Pending" value={pending} />
            <Stat label="No decision" value={none} />
            <Stat label="Declined by applicant" value={declined} />
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
              decided={accepted + waitlisted + rejected}
              undecided={pending + none}
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
              {emailCounts.map(({ status, label, count }) => (
                <Stat key={status} label={label} value={count} />
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
              pending={emailCount("pending")}
              sending={emailCount("sending")}
              failed={emailCount("failed")}
              configured={configured}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
