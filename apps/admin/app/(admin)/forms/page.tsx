import { formatInZone } from "@workspace/forms"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"
import Link from "next/link"
import { Fragment } from "react"

import { CreateFormButton } from "@/components/create-form-button"
import { DeadlinesForm } from "@/components/deadlines-form"
import { FormStatusBadges } from "@/components/form-status-badges"
import { getAdmin } from "@/lib/admin"
import { hasLevel } from "@/lib/levels"

const ROLES = [
  { role: "participant", label: "Participant" },
  { role: "volunteer", label: "Volunteer" },
  { role: "judge", label: "Judge" },
] as const

export default async function FormsPage() {
  const { supabase, level } = await getAdmin()
  const canEdit = hasLevel(level, "organizer")

  const [events, forms] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, name, starts_at")
      .order("starts_at", { nullsFirst: false })
      .order("slug"),
    supabase
      .from("forms")
      .select(
        "id, event_id, role, title, status, published_at, content_updated_at, submissions_close_at, edits_lock_at"
      ),
  ])
  if (events.error) throw new Error(events.error.message)
  if (forms.error) throw new Error(forms.error.message)

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Forms</h1>
      {events.data.map((event) => (
        <Card key={event.id}>
          <CardHeader>
            <CardTitle>{event.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ROLES.map(({ role, label }, index) => {
              const form = forms.data.find(
                (f) => f.event_id === event.id && f.role === role
              )
              return (
                <Fragment key={role}>
                  {index > 0 && <Separator />}
                  <section className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="w-28 font-medium">{label}</h2>
                      {form ? (
                        <>
                          <Link
                            href={`/forms/${form.id}`}
                            className="underline"
                          >
                            {form.title}
                          </Link>
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
      ))}
    </div>
  )
}
