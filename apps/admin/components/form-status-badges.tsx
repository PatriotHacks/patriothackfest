import { Badge } from "@workspace/ui/components/badge"

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
  }
}) {
  return (
    <div className="flex gap-2">
      <Badge variant={form.status === "published" ? "default" : "secondary"}>
        {form.status === "published" ? "Published" : "Draft"}
      </Badge>
      {(unpublishedChanges || hasUnpublishedChanges(form)) && (
        <Badge variant="outline">Unpublished changes</Badge>
      )}
    </div>
  )
}
