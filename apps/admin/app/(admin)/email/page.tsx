import { redirect } from "next/navigation"

import { BroadcastComposer } from "@/components/broadcast-composer"
import { BroadcastHistory } from "@/components/broadcast-history"
import { EmailTemplateEditor } from "@/components/email-template-editor"
import { EventTabs } from "@/components/event-tabs"
import { getAdmin } from "@/lib/admin"
import { EMAIL_NOT_CONFIGURED, isEmailConfigured } from "@/lib/email"
import { selectEvent } from "@/lib/events"
import { hasLevel } from "@/lib/levels"

export const maxDuration = 60

export default async function EmailPage({ searchParams }: PageProps<"/email">) {
  const { event: slug } = await searchParams
  const { supabase, level, email } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")

  const [template, events] = await Promise.all([
    supabase
      .from("email_templates")
      .select("subject, body")
      .eq("key", "status_update")
      .single(),
    supabase
      .from("events")
      .select("id, slug, name, starts_at, ends_at")
      .order("starts_at", { nullsFirst: false })
      .order("slug"),
  ])
  if (template.error) throw new Error(template.error.message)
  if (events.error) throw new Error(events.error.message)

  const event = selectEvent(
    events.data,
    typeof slug === "string" ? slug : undefined
  )
  const history = event
    ? await supabase.rpc("admin_broadcast_history", { p_event_id: event.id })
    : null
  if (history?.error) throw new Error(history.error.message)

  const emailDisabledReason = isEmailConfigured() ? null : EMAIL_NOT_CONFIGURED

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Email</h1>
          <p className="text-muted-foreground">
            The status update email sent when decisions are released. Edits
            apply to every email sent afterward, including emails already
            queued.
          </p>
        </div>
        <EmailTemplateEditor
          initialSubject={template.data.subject}
          initialBody={template.data.body}
          adminEmail={email}
          emailDisabledReason={emailDisabledReason}
        />
      </section>
      <section className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold">Broadcasts</h2>
          <p className="text-muted-foreground">
            Send a one-off email to applicants of an event.
          </p>
        </div>
        {event ? (
          <>
            <EventTabs
              events={events.data}
              selected={event.slug}
              basePath="/email"
            />
            <BroadcastComposer
              key={event.id}
              eventId={event.id}
              eventName={event.name}
              adminEmail={email}
              emailDisabledReason={emailDisabledReason}
            />
            <div className="flex flex-col gap-3">
              <h3 className="font-medium">History</h3>
              <BroadcastHistory
                broadcasts={history?.data ?? []}
                configured={emailDisabledReason === null}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No events</p>
        )}
      </section>
    </div>
  )
}
