"use server"

import { revalidatePath } from "next/cache"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { requireAdmin } from "@/lib/admin"
import { saveCompetitionSettingsPatch } from "@/lib/competition-settings"
import {
  competitionTrackInput,
  projectQuestionInput,
  submissionSettingsInput,
  type CompetitionTrackInput,
  type ProjectQuestionInput,
  type SubmissionSettingsInput,
} from "@/lib/judging"

export async function saveSubmissionSettings(
  input: SubmissionSettingsInput
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = submissionSettingsInput.safeParse(input)
  if (!parsed.success)
    return failure({
      message: parsed.error.issues[0]?.message ?? "Invalid settings",
    })
  const result = await saveCompetitionSettingsPatch(supabase, parsed.data)
  if (result.error) return result
  revalidatePath("/submission-forms")
  revalidatePath("/judging")
  return ok
}

export async function saveCompetitionTrack(
  input: CompetitionTrackInput
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = competitionTrackInput.safeParse(input)
  if (!parsed.success)
    return failure({
      message: parsed.error.issues[0]?.message ?? "Invalid track",
    })
  const value = parsed.data
  const { error } = await supabase.rpc("admin_save_competition_track", {
    p_event_id: value.eventId,
    p_track_id: value.trackId,
    p_name: value.name,
    p_sponsor: value.sponsor,
    p_description: value.description,
    p_reviews: value.reviews,
    p_active: value.active,
  })
  if (error) return failure(error)
  revalidatePath("/submission-forms")
  revalidatePath("/judging")
  return ok
}

export async function saveProjectQuestion(
  input: ProjectQuestionInput
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const parsed = projectQuestionInput.safeParse(input)
  if (!parsed.success)
    return failure({
      message: parsed.error.issues[0]?.message ?? "Invalid question",
    })
  const value = parsed.data
  const { error } = await supabase.rpc("admin_save_project_question", {
    p_event_id: value.eventId,
    p_question_id: value.questionId,
    p_label: value.label,
    p_help_text: value.helpText,
    p_required: value.required,
    p_max_length: value.maxLength,
  })
  if (error) return failure(error)
  revalidatePath("/submission-forms")
  return ok
}

export async function archiveProjectQuestion(
  eventId: string,
  questionId: string
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const input = z
    .object({ eventId: z.guid(), questionId: z.guid() })
    .safeParse({ eventId, questionId })
  if (!input.success) return failure({ message: "Invalid question" })
  const { error } = await supabase.rpc("admin_archive_project_question", {
    p_event_id: input.data.eventId,
    p_question_id: input.data.questionId,
  })
  if (error) return failure(error)
  revalidatePath("/submission-forms")
  return ok
}

export async function reorderProjectQuestions(
  eventId: string,
  questionIds: string[]
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const input = z
    .object({ eventId: z.guid(), questionIds: z.array(z.guid()) })
    .safeParse({ eventId, questionIds })
  if (!input.success) return failure({ message: "Invalid question order" })
  const { error } = await supabase.rpc("admin_reorder_project_questions", {
    p_event_id: input.data.eventId,
    p_question_ids: input.data.questionIds,
  })
  if (error) return failure(error)
  revalidatePath("/submission-forms")
  return ok
}

export async function setJudgesSeeAnswers(
  eventId: string,
  value: boolean
): Promise<ActionResult> {
  const { supabase } = await requireAdmin("organizer")
  const input = z
    .object({ eventId: z.guid(), value: z.boolean() })
    .safeParse({ eventId, value })
  if (!input.success) return failure({ message: "Invalid setting" })
  const { error } = await supabase.rpc("admin_set_judges_see_answers", {
    p_event_id: input.data.eventId,
    p_value: input.data.value,
  })
  if (error) return failure(error)
  revalidatePath("/submission-forms")
  return ok
}
