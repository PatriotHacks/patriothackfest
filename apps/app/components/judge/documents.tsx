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
              name="Certificate (PDF)"
            />
          ) : (
            <p>
              Thank you for your willingness to judge! Unfortunately, you
              didn&apos;t complete your judging assignments, so you won&apos;t
              be receiving a certificate at this time. However, we hope
              you&apos;ll join us for judging in the Spring!
            </p>
          )}
          {documents.invitation_letter_path && (
            <JudgeDocumentLink
              eventSlug={eventSlug}
              kind="invitation_letter"
              name="Invitation letter (PDF)"
            />
          )}
        </>
      ) : (
        <p>Your documents will be available here after judging closes.</p>
      )}
    </section>
  )
}
