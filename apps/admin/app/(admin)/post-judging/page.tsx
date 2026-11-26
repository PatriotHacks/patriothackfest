import { Card, CardContent } from "@workspace/ui/components/card"
import { redirect } from "next/navigation"

import { EventTabs } from "@/components/event-tabs"
import { PageHeader } from "@/components/page-header"
import {
  InvitationLetter,
  JudgeDocuments,
} from "@/components/post-judging/judge-documents"
import { getAdmin } from "@/lib/admin"
import { selectEvent } from "@/lib/events"
import { postJudgingRosterSchema } from "@/lib/judge-documents"
import { hasLevel } from "@/lib/levels"

const DESCRIPTION =
  "Certificates and invitation letters for judges. Judges can download their documents in the judge portal once judging closes."

export default async function PostJudgingPage({
  searchParams,
}: PageProps<"/post-judging">) {
  const { supabase, level } = await getAdmin()
  if (!hasLevel(level, "organizer")) redirect("/forms")
  const { event: slug } = await searchParams
  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, slug, name, starts_at, ends_at")
    .order("starts_at", { nullsFirst: false })
    .order("slug")
  if (eventsError) throw new Error(eventsError.message)
  const event = selectEvent(events, typeof slug === "string" ? slug : undefined)
  if (!event)
    return (
      <PageHeader title="Post-judging" description="No events configured." />
    )

  const [settings, roster] = await Promise.all([
    supabase
      .from("event_competition_settings")
      .select("invitation_letter_path")
      .eq("event_id", event.id)
      .maybeSingle(),
    supabase.rpc("admin_post_judging_roster", { p_event_id: event.id }),
  ])
  if (settings.error) throw new Error(settings.error.message)
  if (roster.error) throw new Error(roster.error.message)

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <PageHeader title="Post-judging" description={DESCRIPTION} />
      <EventTabs
        events={events}
        selected={event.slug}
        basePath="/post-judging"
      />
      {settings.data ? (
        <>
          <Card>
            <CardContent>
              <InvitationLetter
                key={event.id}
                eventId={event.id}
                path={settings.data.invitation_letter_path}
              />
            </CardContent>
          </Card>
          <JudgeDocuments
            key={event.id}
            eventId={event.id}
            judges={postJudgingRosterSchema.parse(roster.data)}
          />
        </>
      ) : (
        <p className="text-sm">
          Save competition settings in Judging Management before uploading judge
          documents.
        </p>
      )}
    </div>
  )
}
