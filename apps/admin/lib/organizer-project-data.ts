import "server-only"

import { notFound } from "next/navigation"
import * as z from "zod"

import { requireAdmin } from "./admin"
import {
  eventProjectsSchema,
  projectDetailSchema,
  projectPageSchema,
  projectStatusSchema,
  type ProjectsQuery,
} from "./organizer-projects"

export async function getEventProjects(eventId: string, query: ProjectsQuery) {
  const { supabase } = await requireAdmin("organizer")
  const id = z.guid().parse(eventId)
  const page = projectPageSchema.parse(query.page)
  const status = projectStatusSchema.nullable().parse(query.status)
  const { data, error } = await supabase.rpc("admin_event_projects", {
    p_event_id: id,
    p_status: status ?? undefined,
    p_page: page,
  })
  if (error) throw new Error(error.message)
  return eventProjectsSchema.parse(data)
}

export async function getProject(eventSlug: unknown, projectId: string) {
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
  const { data, error } = await supabase.rpc("admin_project_detail", {
    p_event_id: event.id,
    p_project_id: id,
  })
  if (error) throw new Error(error.message)
  if (data === null) notFound()
  const detail = projectDetailSchema.parse(data)
  if (detail.project.event_id !== event.id || detail.project.id !== id)
    notFound()
  return { event, detail }
}
