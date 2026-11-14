"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { getApplicant } from "@/lib/applicant"
import {
  completeProjectContentSchema,
  fieldErrors,
  projectFailure,
  projectSaveSchema,
} from "@/lib/projects"

export type ProjectResult = {
  error: string | null
  projectId?: string
  updatedAt?: string
  fieldErrors?: Record<string, string>
}

export async function createProject(eventId: string): Promise<ProjectResult> {
  const { supabase } = await getApplicant()
  const id = z.guid().safeParse(eventId)
  if (!id.success) return { error: "Invalid event" }
  const { data, error } = await supabase.rpc("participant_create_project", {
    p_event_id: id.data,
  })
  if (error) return projectFailure(error)
  revalidatePath("/projects", "layout")
  return { error: null, projectId: data }
}

export async function saveProject(input: unknown): Promise<ProjectResult> {
  const { supabase } = await getApplicant()
  const parsed = projectSaveSchema.safeParse(input)
  if (!parsed.success)
    return {
      error: "Some project fields need attention",
      fieldErrors: fieldErrors(parsed.error.issues),
    }
  const value = parsed.data
  if (value.submit) {
    const complete = completeProjectContentSchema.safeParse(value.content)
    if (!complete.success)
      return {
        error: "Some project fields need attention",
        fieldErrors: fieldErrors(complete.error.issues),
      }
  }
  const { data, error } = await supabase.rpc("participant_save_project", {
    p_project_id: value.projectId,
    p_content: value.content,
    p_track_ids: value.trackIds,
    p_submit: value.submit,
    p_expected_updated_at: value.updatedAt,
  })
  if (error) return projectFailure(error)
  revalidatePath("/projects", "layout")
  return { error: null, updatedAt: data }
}

export async function addProjectCollaborator(
  projectId: string,
  email: string
): Promise<ProjectResult> {
  const { supabase } = await getApplicant()
  const input = z
    .object({
      projectId: z.guid(),
      email: z.string().trim().toLowerCase().pipe(z.email()),
    })
    .safeParse({ projectId, email })
  if (!input.success)
    return { error: "Enter a valid project and collaborator email" }
  const { error } = await supabase.rpc("participant_add_project_collaborator", {
    p_project_id: input.data.projectId,
    p_email: input.data.email,
  })
  if (error) return projectFailure(error)
  revalidatePath("/projects", "layout")
  return { error: null }
}

export async function removeProjectCollaborator(
  projectId: string,
  userId: string
): Promise<ProjectResult> {
  const { supabase } = await getApplicant()
  const input = z
    .object({ projectId: z.guid(), userId: z.guid() })
    .safeParse({ projectId, userId })
  if (!input.success) return { error: "Invalid collaborator" }
  const { error } = await supabase.rpc(
    "participant_remove_project_collaborator",
    { p_project_id: input.data.projectId, p_user_id: input.data.userId }
  )
  if (error) return projectFailure(error)
  revalidatePath("/projects", "layout")
  return { error: null }
}

export async function withdrawProject(
  projectId: string
): Promise<ProjectResult> {
  const { supabase } = await getApplicant()
  const id = z.guid().safeParse(projectId)
  if (!id.success) return { error: "Invalid project" }
  const { error } = await supabase.rpc("participant_withdraw_project", {
    p_project_id: id.data,
  })
  if (error) return projectFailure(error)
  revalidatePath("/projects", "layout")
  return { error: null }
}
