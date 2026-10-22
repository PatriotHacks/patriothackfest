import { ApplicationsList } from "@/components/applications-list"

export default async function JudgesPage({
  searchParams,
}: PageProps<"/applications/judges">) {
  return <ApplicationsList role="judge" searchParams={await searchParams} />
}
