import { ApplicationsList } from "@/components/applications-list"

export default async function ParticipantsPage({
  searchParams,
}: PageProps<"/applications/participants">) {
  return (
    <ApplicationsList role="participant" searchParams={await searchParams} />
  )
}
