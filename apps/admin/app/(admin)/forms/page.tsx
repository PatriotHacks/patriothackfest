import { formatInZone } from "@workspace/forms"
import { ROLE_LABELS, ROLES } from "@workspace/supabase/roles"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { Fragment } from "react"

import { CreateFormButton } from "@/components/create-form-button"
import { DeadlinesForm } from "@/components/deadlines-form"
import { EventTabs } from "@/components/event-tabs"
import { FormStatusBadges } from "@/components/form-status-badges"
import { PageHeader } from "@/components/page-header"
import { getAdmin } from "@/lib/admin"
import { selectEvent } from "@/lib/events"
import { hasLevel } from "@/lib/levels"
import { TEXT_LINK } from "@/lib/styles"

export default async function FormsPage({ searchParams }: PageProps<"/forms">) {
  const { event: slug } = await searchParams
  const { supabase, level } = await getAdmin()
  const canEdit = hasLevel(level, "organizer")

  const [events, forms] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, name, starts_at, ends_at")
      .order("starts_at", { nullsFirst: false })
      .order("slug"),
    supabase
      .from("forms")
      .select(
        "id, event_id, role, status, published_at, content_updated_at, submissions_close_at, edits_lock_at, decisions_released_at"
      ),
  ])
  if (events.error) throw new Error(events.error.message)
  if (forms.error) throw new Error(forms.error.message)

  const event = selectEvent(
    events.data,
    typeof slug === "string" ? slug : undefined
  )

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Forms"
        description="Application forms, deadlines, and exports for each event."
      />
      {event ? (
        <EventTabs
          events={events.data}
          selected={event.slug}
          basePath="/forms"
        />
      ) : (
        <p className="text-sm text-muted-foreground">No events</p>
      )}
      {event && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            {ROLES.map((role, index) => {
              const form = forms.data.find(
                (f) => f.event_id === event.id && f.role === role
              )
              return (
                <Fragment key={role}>
                  {index > 0 && <Separator />}
                  <section className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2
                        className={cn(SERIF, "w-32 text-[26px] leading-[1.1]")}
                      >
                        {form ? (
                          <Link
                            href={`/forms/${form.id}`}
                            className={cn(TEXT_LINK, "font-normal")}
                          >
                            {ROLE_LABELS[role]}
                          </Link>
                        ) : (
                          ROLE_LABELS[role]
                        )}
                      </h2>
                      {form ? (
                        <>
                          <FormStatusBadges form={form} />
                          {form.published_at && (
                            <span className="text-sm text-muted-foreground">
                              Published {formatInZone(form.published_at)}
                            </span>
                          )}
                        </>
                      ) : canEdit ? (
                        <CreateFormButton eventId={event.id} role={role} />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No form
                        </span>
                      )}
                    </div>
                    {form && (
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/applications?event=${encodeURIComponent(event.slug)}&role=${role}`}
                          >
                            Applications
                          </Link>
                        </Button>
                        {canEdit && (
                          <>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/forms/${form.id}/release`}>
                                Release decisions
                              </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm">
                              <a href={`/forms/${form.id}/export`}>
                                Export CSV
                              </a>
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    {form && (
                      <DeadlinesForm
                        formId={form.id}
                        submissionsCloseAt={form.submissions_close_at}
                        editsLockAt={form.edits_lock_at}
                        canEdit={canEdit}
                      />
                    )}
                  </section>
                </Fragment>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
