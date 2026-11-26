import { PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { JudgeDocumentLink } from "@/components/judge/document-link"
import type { JudgeDocuments } from "@/lib/judge-documents"

export function JudgeDocumentsSection({
  eventName,
  eventSlug,
  documents,
}: {
  eventName: string
  eventSlug: string
  documents: JudgeDocuments | null
}) {
  return (
    <section className={cn(PAPER, "flex flex-col gap-3 p-6")}>
      <h2 className="text-xl font-semibold">{eventName}</h2>
      {documents ? (
        <>
          {documents.certificate_path ? (
            <JudgeDocumentLink
              eventSlug={eventSlug}
              kind="certificate"
              name="Download certificate"
            />
          ) : (
            <p>Your certificate is not yet available.</p>
          )}
          {documents.invitation_letter_path && (
            <JudgeDocumentLink
              eventSlug={eventSlug}
              kind="invitation_letter"
              name="Download invitation letter"
            />
          )}
        </>
      ) : (
        <p>Your documents will be available here after judging closes.</p>
      )}
    </section>
  )
}
