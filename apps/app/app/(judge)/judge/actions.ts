"use server"

import { revalidatePath } from "next/cache"

import { getApplicant } from "@/lib/applicant"
import { getJudgeEvent, type JudgeEvent } from "@/lib/judge-access"
import { getJudgeAssignment, getJudgeQueue } from "@/lib/judge-review-data"
import {
  judgeContinuation,
  judgeRouteSchema,
  judgeScorecardSchema,
  reviewSaveSchema,
  type JudgeScorecard,
} from "@/lib/judge-reviews"

export type ReviewResult = {
  error: string | null
  assignment?: JudgeScorecard
  fieldErrors?: Record<string, string>
}

export async function saveJudgeReview(input: unknown): Promise<ReviewResult> {
  const { supabase } = await getApplicant()
  const parsed = reviewSaveSchema.safeParse(input)
  if (!parsed.success)
    return {
      error: "Check the scorecard fields",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [
          issue.path.join("."),
          issue.message,
        ])
      ),
    }
  const value = parsed.data
  const { data, error } = await supabase.rpc("judge_save_review", {
    p_event_slug: value.eventSlug,
    p_assignment_id: value.assignmentId,
    p_scores: value.scores,
    p_notes: value.notes,
    p_submit: value.submit,
  })
  if (error) return { error: error.message }
  const assignment = judgeScorecardSchema.parse(data)
  try {
    revalidatePath("/judge")
  } catch {
    /* Persistence succeeded; a cache refresh failure must not report a failed save. */
  }
  return { error: null, assignment }
}

export async function continueJudgeQueue(
  eventSlug: string
): Promise<{ error: string | null; href?: string }> {
  await getApplicant()
  if (!judgeRouteSchema.shape.eventSlug.safeParse(eventSlug).success)
    return { error: "Invalid judging event" }
  try {
    const queue = await getJudgeQueue(eventSlug)
    return queue
      ? { error: null, href: judgeContinuation(eventSlug, queue) }
      : { error: "Judge access unavailable" }
  } catch {
    return {
      error:
        "Your review is submitted, but the queue could not be loaded. Try Continue again.",
    }
  }
}

export async function checkJudgeReview(
  input: unknown
): Promise<ReviewResult & { event?: JudgeEvent }> {
  await getApplicant()
  const parsed = judgeRouteSchema.strict().safeParse(input)
  if (!parsed.success) return { error: "Invalid assignment" }
  const { eventSlug, assignmentId } = parsed.data
  try {
    const event = await getJudgeEvent(eventSlug)
    if (!event)
      return {
        error:
          "Judge access unavailable. Ask an organizer to check your roster entry.",
      }
    const detail = await getJudgeAssignment(eventSlug, assignmentId)
    return detail
      ? { error: null, event, assignment: detail.assignment }
      : {
          error:
            "Assignment unavailable. Return to your dashboard or contact an organizer.",
        }
  } catch {
    return {
      error:
        "Could not check the deadline. Your unsaved inputs are still here; try again.",
    }
  }
}
