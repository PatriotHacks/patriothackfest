import {
  answersSchema,
  formatInZone,
  hasEditableSections,
  publishedSchemaSchema,
} from "@workspace/forms"
import { ROLE_LABELS } from "@workspace/supabase/roles"
import { notFound, redirect } from "next/navigation"
import * as z from "zod"

import { DraftForm } from "@/components/application/draft-form"
import { AuthCard } from "@/components/auth/auth-card"
import { SignOutLink } from "@/components/auth/sign-out-link"
import { applicationPhase } from "@/lib/application-status"
import { getNamedApplicant } from "@/lib/applicant"
import { deadlineText } from "@/lib/deadline-text"

export default async function DraftPage({ params }: PageProps<"/draft/[id]">) {
  const { id } = await params
  if (!z.guid().safeParse(id).success) notFound()
  const { supabase, userId, email } = await getNamedApplicant()

  const [application, profile] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, role, status, answers, updated_at, declined_at, events(name), forms(status, submissions_close_at, edits_lock_at, decisions_released_at, published_schema)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, school, phone, date_of_birth")
      .eq("id", userId)
      .single(),
  ])
  if (application.error) throw new Error(application.error.message)
  if (profile.error) throw new Error(profile.error.message)
  if (!application.data) notFound()
  const { data } = application
  if (data.status !== "draft") redirect(`/applications/${id}`)

  const form = data.forms
  const phase = applicationPhase(
    data.status,
    data.declined_at,
    form,
    Date.now()
  )
  const schema =
    form.published_schema === null
      ? null
      : publishedSchemaSchema.parse(form.published_schema)
  const subtitle = `${data.events.name} · ${ROLE_LABELS[data.role]}`

  if (
    phase === "closed_draft" ||
    schema === null ||
    form.status !== "published"
  )
    return (
      <AuthCard
        title={schema?.title ?? data.events.name}
        description={subtitle}
      >
        <p className="text-center text-[14.5px] text-[#6E6E68]">
          {phase === "closed_draft"
            ? "Submissions are closed. This application was not submitted."
            : "This form is not accepting changes right now."}
        </p>
        <SignOutLink />
      </AuthCard>
    )

  return (
    <AuthCard
      wide
      title={schema.title}
      description={
        <>
          {subtitle}
          <span className="mt-[4px] block text-[13px]">
            {deadlineText(phase, form, false)}
          </span>
        </>
      }
    >
      {schema.description && (
        <p className="mb-[24px] text-center text-[14.5px] whitespace-pre-wrap text-[#6E6E68]">
          {schema.description}
        </p>
      )}
      <DraftForm
        key={data.updated_at}
        applicationId={data.id}
        userId={userId}
        email={email}
        profile={profile.data}
        schema={schema}
        initialAnswers={answersSchema.parse(data.answers)}
        updatedAt={data.updated_at}
        editNote={
          form.edits_lock_at && hasEditableSections(schema)
            ? `After submitting, you can edit answers in some sections until ${formatInZone(form.edits_lock_at)}.`
            : null
        }
      />
      <SignOutLink />
    </AuthCard>
  )
}
