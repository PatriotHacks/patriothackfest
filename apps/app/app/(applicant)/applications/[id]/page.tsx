import { formatInZone, publishedSchemaSchema } from "@workspace/forms"
import type { Database } from "@workspace/supabase/types"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import * as z from "zod"

import { ApplicationForm } from "@/components/application/application-form"
import { AnswersView } from "@/components/application/answers-view"
import { DeclineButton } from "@/components/application/decline-button"
import { WithdrawButton } from "@/components/application/withdraw-button"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import {
  applicantAction,
  applicationPhase,
  declinedText,
  statusLabel,
  type ApplicationPhase,
  type FormTiming,
} from "@/lib/application-status"
import { getNamedApplicant } from "@/lib/applicant"
import { deadlineText } from "@/lib/deadline-text"
import { ROLE_LABELS } from "@/lib/roles"

type Decision = Database["public"]["Enums"]["decision"]

const answersSchema = z.record(z.string(), z.unknown())

function phaseNote(
  phase: ApplicationPhase,
  form: FormTiming,
  application: {
    withdrawn_at: string | null
    declined_at: string | null
    decision: Decision | null
  }
) {
  switch (phase) {
    case "withdrawn":
      return `You withdrew this application on ${formatInZone(application.withdrawn_at!)}. You cannot apply to this event again.`
    case "declined":
      return `${declinedText(application.decision)} on ${formatInZone(application.declined_at!)}. This is final.`
    case "closed_draft":
      return "Submissions are closed. This application was not submitted."
    case "locked_submission":
      return "Answers are locked and can no longer be changed."
    default:
      return deadlineText(phase, form)
  }
}

export default async function ApplicationPage({
  params,
}: PageProps<"/applications/[id]">) {
  const { id } = await params
  if (!z.guid().safeParse(id).success) notFound()
  const { supabase, userId } = await getNamedApplicant()

  const { data: application, error } = await supabase
    .from("applications")
    .select(
      "id, role, status, answers, updated_at, withdrawn_at, declined_at, events(name), forms(status, submissions_close_at, edits_lock_at, decisions_released_at, published_schema), application_decisions(decision)"
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!application) notFound()

  const form = application.forms
  const eventName = application.events.name
  const decision = application.application_decisions?.decision ?? null
  const phase = applicationPhase(
    application.status,
    application.declined_at,
    form,
    Date.now()
  )
  const status = statusLabel(phase, form, decision)
  const action = applicantAction(phase, form, decision)
  const schema =
    form.published_schema === null
      ? null
      : publishedSchemaSchema.parse(form.published_schema)
  const answers = answersSchema.parse(application.answers)
  const editable =
    schema !== null &&
    form.status === "published" &&
    (phase === "draft" || phase === "editable_submission")
  const note =
    !editable && (phase === "draft" || phase === "editable_submission")
      ? "This form is not accepting changes right now."
      : phaseNote(phase, form, { ...application, decision })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/" className="text-sm text-muted-foreground underline">
        Back to applications
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{eventName}</CardTitle>
          <CardDescription>
            {ROLE_LABELS[application.role]} application
          </CardDescription>
          <CardAction>
            <ApplicationStatusBadge status={status} />
          </CardAction>
        </CardHeader>
        {note && (
          <CardContent>
            <p className="text-sm text-muted-foreground">{note}</p>
          </CardContent>
        )}
      </Card>

      {schema === null ? (
        <p className="text-sm text-muted-foreground">
          This form is not available right now.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{schema.title}</h1>
            {schema.description && (
              <p className="whitespace-pre-wrap text-muted-foreground">
                {schema.description}
              </p>
            )}
          </div>
          {editable ? (
            <ApplicationForm
              key={application.updated_at}
              mode={phase === "draft" ? "draft" : "edit"}
              applicationId={application.id}
              userId={userId}
              schema={schema}
              initialAnswers={answers}
              updatedAt={application.updated_at}
              editNote={
                phase === "draft" && form.edits_lock_at
                  ? `After submitting, you can edit your answers until ${formatInZone(form.edits_lock_at)}.`
                  : null
              }
            />
          ) : (
            <AnswersView schema={schema} answers={answers} />
          )}
        </>
      )}

      {action?.kind === "withdraw" && (
        <WithdrawButton applicationId={application.id} eventName={eventName} />
      )}
      {action?.kind === "decline" && (
        <DeclineButton
          applicationId={application.id}
          eventName={eventName}
          decision={action.decision}
        />
      )}
    </div>
  )
}
