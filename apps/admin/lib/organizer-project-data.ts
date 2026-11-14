import "server-only"

import { notFound } from "next/navigation"
import * as z from "zod"

import { requireAdmin } from "./admin"
import {
  projectPageSchema,
  submittedProjectDetailSchema,
  submittedProjectsSchema,
} from "./organizer-projects"

export async function getSubmittedProjects(eventId: string, page: number) {
  const { supabase } = await requireAdmin("organizer")
  const id = z.guid().parse(eventId)
  const selectedPage = projectPageSchema.parse(page)
  const { data, error } = await supabase.rpc("admin_submitted_projects", {
    p_event_id: id,
    p_page: selectedPage,
  })
  if (error) throw new Error(error.message)
  return submittedProjectsSchema.parse(data)
}

export async function getSubmittedProject(
  eventSlug: unknown,
  projectId: string
) {
  const { supabase } = await requireAdmin("organizer")
  if (
    typeof eventSlug !== "string" ||
    !eventSlug ||
    !z.guid().safeParse(projectId).success
  )
    notFound()
  const id = projectId.toLowerCase()
  // Unlike the general event selector, an explicit detail event never falls back.
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, slug, name")
    .eq("slug", eventSlug)
    .maybeSingle()
  if (eventError) throw new Error(eventError.message)
  if (!event) notFound()
  const { data, error } = await supabase.rpc("admin_submitted_project_detail", {
    p_event_id: event.id,
    p_project_id: id,
  })
  if (error) throw new Error(error.message)
  if (data === null) notFound()
  const detail = submittedProjectDetailSchema.parse(data)
  if (detail.project.event_id !== event.id || detail.project.id !== id)
    notFound()
  return { event, detail }
}
