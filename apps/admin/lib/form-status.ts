export function hasUnpublishedChanges(form: {
  published_at: string | null
  content_updated_at: string
}) {
  return (
    form.published_at !== null &&
    new Date(form.content_updated_at) > new Date(form.published_at)
  )
}
