import "server-only"

import { notFound } from "next/navigation"
import { cache } from "react"
import * as z from "zod"

import { getApplicant } from "./applicant"
import { projectDetailSchema, type ProjectEvent } from "./projects"

export const getProjectEvents = cache(async (): Promise<ProjectEvent[]> => {
  const { supabase } = await getApplicant()
  const { data, error } = await supabase.rpc("participant_project_events")
  if (error) throw new Error(error.message)
  return data
})

export async function getProjectEvent(slug: string) {
  const event = (await getProjectEvents()).find((event) => event.slug === slug)
  if (!event) notFound()
  return event
}

export async function getProjectDetail(projectId: string, eventId: string) {
  if (!z.guid().safeParse(projectId).success) notFound()
  const { supabase } = await getApplicant()
  const { data, error } = await supabase.rpc("participant_project_detail", {
    p_project_id: projectId,
    p_event_id: eventId,
  })
  if (error) throw new Error(error.message)
  if (!data) notFound()
  return projectDetailSchema.parse(data)
}
