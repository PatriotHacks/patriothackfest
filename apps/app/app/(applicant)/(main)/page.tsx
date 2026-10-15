import {
  formatDateRangeInZone,
  hasEditableSections,
  publishedSchemaSchema,
} from "@workspace/forms"
import { ROLE_LABELS } from "@workspace/supabase/roles"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"

import { DeclineButton } from "@/components/application/decline-button"
import { WithdrawButton } from "@/components/application/withdraw-button"
import { OUTLINE_PILL, PAPER, SERIF } from "@/components/paper"
import {
  applicantAction,
  applicationPhase,
  declinedText,
  statusLabel,
} from "@/lib/application-status"
import { getNamedApplicant } from "@/lib/applicant"
import { deadlineText } from "@/lib/deadline-text"

export default async function DashboardPage() {
  const { supabase, userId, fullName } = await getNamedApplicant()

  const { data: applications, error } = await supabase
    .from("applications")
    .select(
      "id, role, status, declined_at, events(name, starts_at, ends_at), forms(status, submissions_close_at, edits_lock_at, decisions_released_at, published_schema), application_decisions(decision)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)

  const now = Date.now()

  return (
    <div className="flex max-w-[720px] flex-col gap-[24px] font-(family-name:--font-auth-sans) text-[#3A4A2B]">
      <div className="flex flex-col gap-[6px]">
        <h1 className={cn(SERIF, "text-[40px] leading-[1.05]")}>Dashboard</h1>
        <p className="text-[15px] text-[#6E6E68]">Welcome, {fullName}.</p>
      </div>

      {applications.map((application) => {
        const form = application.forms
        const event = application.events
        const decision = application.application_decisions?.decision ?? null
        const phase = applicationPhase(
          application.status,
          application.declined_at,
          form,
          now
        )
        const action = applicantAction(phase, form, decision)
        const canEdit =
          form.published_schema !== null &&
          hasEditableSections(
            publishedSchemaSchema.parse(form.published_schema)
          )
        const note =
          phase === "declined"
            ? declinedText(decision)
            : deadlineText(phase, form, canEdit)

        return (
          <article
            key={application.id}
            className={cn(PAPER, "flex flex-col gap-[16px] p-[24px]")}
          >
            <div className="flex flex-wrap items-start justify-between gap-[12px]">
              <div className="flex flex-col gap-[4px]">
                <h2 className={cn(SERIF, "text-[30px] leading-[1.1]")}>
                  {event.name}
                </h2>
                <p className="text-[14.5px] text-[#6E6E68]">
                  {event.starts_at
                    ? `${formatDateRangeInZone(event.starts_at, event.ends_at)} · `
                    : ""}
                  {ROLE_LABELS[application.role]}
                </p>
              </div>
              <span className="rounded-full bg-[#3A4A2B] px-[12px] py-[4px] text-[13px] font-medium text-[#F8F7F2]">
                {statusLabel(phase, form, decision)}
              </span>
            </div>
            {note && <p className="text-[14.5px] text-[#6E6E68]">{note}</p>}
            <div className="flex flex-wrap gap-[10px]">
              <Link
                href={
                  application.status === "draft"
                    ? `/draft/${application.id}`
                    : `/applications/${application.id}`
                }
                className={cn(
                  OUTLINE_PILL,
                  "inline-flex items-center justify-center"
                )}
              >
                {phase === "draft"
                  ? "Continue application"
                  : "View application"}
              </Link>
              {action?.kind === "withdraw" && (
                <WithdrawButton
                  applicationId={application.id}
                  eventName={event.name}
                />
              )}
              {action?.kind === "decline" && (
                <DeclineButton
                  applicationId={application.id}
                  eventName={event.name}
                  decision={action.decision}
                />
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
