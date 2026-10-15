import {
  answersSchema,
  hasEditableSections,
  publishedSchemaSchema,
} from "@workspace/forms"
import { ROLE_LABELS } from "@workspace/supabase/roles"
import { Pill } from "@workspace/ui/components/pill"
import { PAPER, SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import { notFound, redirect } from "next/navigation"
import * as z from "zod"

import { BasicInfoView } from "@/components/application/basic-info-view"
import { SubmittedApplication } from "@/components/application/submitted-application"
import { applicationPhase, statusLabel } from "@/lib/application-status"
import { getNamedApplicant } from "@/lib/applicant"
import { deadlineText } from "@/lib/deadline-text"

export default async function ApplicationPage({
  params,
}: PageProps<"/applications/[id]">) {
  const { id } = await params
  if (!z.guid().safeParse(id).success) notFound()
  const { supabase, userId, email } = await getNamedApplicant()

  const [application, profile] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, role, status, answers, updated_at, declined_at, events(name), forms(status, submissions_close_at, edits_lock_at, decisions_released_at, published_schema), application_decisions(decision)"
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
  if (data.status === "draft") redirect(`/draft/${id}`)

  const form = data.forms
  const decision = data.application_decisions?.decision ?? null
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
  const editable =
    phase === "editable_submission" &&
    form.status === "published" &&
    schema !== null &&
    hasEditableSections(schema)

  return (
    <article
      className={cn(
        PAPER,
        "flex flex-col gap-[28px] px-[20px] py-[28px] sm:px-[32px]"
      )}
    >
      <header className="flex flex-col gap-[6px]">
        <div className="flex flex-wrap items-start justify-between gap-[12px]">
          <h1 className={cn(SERIF, "text-[38px] leading-[1.05]")}>
            {schema?.title ?? data.events.name}
          </h1>
          <Pill>{statusLabel(phase, form, decision)}</Pill>
        </div>
        <p className="text-[14.5px] text-[#6E6E68]">
          {data.events.name} · {ROLE_LABELS[data.role]}
        </p>
        {editable && (
          <p className="text-[13px] text-[#6E6E68]">
            {deadlineText(phase, form, true)}
          </p>
        )}
      </header>
      <BasicInfoView profile={profile.data} email={email} />
      {schema && (
        <SubmittedApplication
          key={data.updated_at}
          applicationId={data.id}
          userId={userId}
          schema={schema}
          initialAnswers={answersSchema.parse(data.answers)}
          updatedAt={data.updated_at}
          editable={editable}
        />
      )}
    </article>
  )
}
