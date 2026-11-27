import { SERIF } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { JudgeDocumentsSection } from "@/components/judge/documents"
import { getJudgeDocuments } from "@/lib/judge-documents"
import { getJudgeEvent, getJudgeEvents } from "@/lib/judge-access"
import { judgeWindowStatus } from "@/lib/judge-status"

export default async function JudgeCertificatePage() {
  const events = await getJudgeEvents()
  return (
    <>
      <h1 className={cn(SERIF, "text-4xl")}>Certificate</h1>
      {events.map((event) => (
        <EventDocuments key={event.event_id} slug={event.slug} />
      ))}
    </>
  )
}

async function EventDocuments({ slug }: { slug: string }) {
  const event = await getJudgeEvent(slug)
  if (!event) return null
  const documents =
    judgeWindowStatus(event) === "ended" ? await getJudgeDocuments(slug) : null
  return (
    <JudgeDocumentsSection
      eventName={event.name}
      eventSlug={slug}
      documents={documents}
    />
  )
}
