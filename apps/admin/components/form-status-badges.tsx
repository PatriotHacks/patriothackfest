import { Pill } from "@workspace/ui/components/pill"

import { hasUnpublishedChanges } from "@/lib/form-status"

export function FormStatusBadges({
  form,
  unpublishedChanges = false,
}: {
  unpublishedChanges?: boolean
  form: {
    status: string
    published_at: string | null
    content_updated_at: string
    decisions_released_at?: string | null
  }
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Pill tone={form.status === "published" ? "olive" : "muted"}>
        {form.status === "published" ? "Published" : "Draft"}
      </Pill>
      {(unpublishedChanges || hasUnpublishedChanges(form)) && (
        <Pill tone="amber">Unpublished changes</Pill>
      )}
      {form.decisions_released_at && <Pill tone="outline">Released</Pill>}
    </div>
  )
}
