import { formatDateRangeInZone, formatInZone } from "@workspace/forms"
import { ROLE_LABELS, ROLES } from "@workspace/supabase/roles"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import Link from "next/link"

import { DeclineButton } from "@/components/application/decline-button"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import {
  applicantAction,
  applicationPhase,
  declinedText,
  isFormOpen,
  statusLabel,
} from "@/lib/application-status"
import { getNamedApplicant } from "@/lib/applicant"
import { deadlineText } from "@/lib/deadline-text"

export default async function DashboardPage() {
  const { supabase, fullName } = await getNamedApplicant()

  const [events, forms, applications] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, name, starts_at, ends_at")
      .order("starts_at", { nullsFirst: false })
      .order("slug"),
    supabase
      .from("forms")
      .select(
        "id, event_id, role, status, submissions_close_at, edits_lock_at, decisions_released_at"
      ),
    supabase
      .from("applications")
      .select(
        "id, event_id, form_id, role, status, declined_at, created_at, application_decisions(decision)"
      )
      .order("created_at", { ascending: false }),
  ])
  if (events.error) throw new Error(events.error.message)
  if (forms.error) throw new Error(forms.error.message)
  if (applications.error) throw new Error(applications.error.message)

  const now = Date.now()
  const eventName = new Map(events.data.map((e) => [e.id, e.name]))
  const appliedEventIds = new Set(applications.data.map((a) => a.event_id))
  const openEvents = events.data
    .filter((event) => !appliedEventIds.has(event.id))
    .map((event) => ({
      event,
      forms: forms.data
        .filter((f) => f.event_id === event.id && isFormOpen(f, now))
        .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role)),
    }))
    .filter(({ forms }) => forms.length > 0)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <p className="text-muted-foreground">Welcome, {fullName}.</p>
      </div>

      {applications.data.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Your applications</h2>
          {applications.data.map((application) => {
            const form = forms.data.find((f) => f.id === application.form_id)
            if (!form) return null
            const decision = application.application_decisions?.decision ?? null
            const phase = applicationPhase(
              application.status,
              application.declined_at,
              form,
              now
            )
            const action = applicantAction(phase, form, decision)
            const name = eventName.get(application.event_id)!
            return (
              <Card key={application.id}>
                <CardHeader>
                  <CardTitle>{name}</CardTitle>
                  <CardDescription>
                    {ROLE_LABELS[application.role]}
                  </CardDescription>
                  <CardAction>
                    <ApplicationStatusBadge
                      status={statusLabel(phase, form, decision)}
                    />
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    {phase === "declined"
                      ? declinedText(decision)
                      : deadlineText(phase, form)}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {action?.kind === "decline" && (
                      <DeclineButton
                        applicationId={application.id}
                        eventName={name}
                        decision={action.decision}
                        size="sm"
                      />
                    )}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/applications/${application.id}`}>
                        {phase === "draft" ? "Continue" : "View"}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Open applications</h2>
        {openEvents.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No applications are open right now.
          </p>
        )}
        {openEvents.map(({ event, forms }) => (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle>{event.name}</CardTitle>
              {event.starts_at && (
                <CardDescription>
                  {formatDateRangeInZone(event.starts_at, event.ends_at)}
                </CardDescription>
              )}
              <CardAction>
                <Button asChild size="sm">
                  <Link href={`/apply/${event.slug}`}>Apply</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm">
                {forms.map((form) => (
                  <li key={form.id}>
                    <span className="font-medium">
                      {ROLE_LABELS[form.role]}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      - applications close{" "}
                      {formatInZone(form.submissions_close_at!)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
