import { ApplicationsList } from "@/components/applications-list"

export default async function MentorsPage({
  searchParams,
}: PageProps<"/applications/mentors">) {
  return <ApplicationsList role="volunteer" searchParams={await searchParams} />
}
