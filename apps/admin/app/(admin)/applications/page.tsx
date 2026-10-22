import { redirect } from "next/navigation"

import { filtersQuery, parseFilters } from "@/lib/application-filters"
import { APPLICATION_TABS, tabPath } from "@/lib/application-tabs"

export default async function ApplicationsPage({
  searchParams,
}: PageProps<"/applications">) {
  const filters = parseFilters(await searchParams)
  redirect(`${tabPath(APPLICATION_TABS[0])}${filtersQuery(filters)}`)
}
