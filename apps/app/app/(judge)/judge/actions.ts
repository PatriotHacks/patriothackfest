"use server"

import { revalidatePath } from "next/cache"

import { getApplicant } from "@/lib/applicant"
import { getJudgeEvent, type JudgeEvent } from "@/lib/judge-access"
import {
  acknowledgeJudgeBriefing,
  getJudgeQueue,
} from "@/lib/judge-review-data"
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
}

export async function saveJudgeReview(input: unknown): Promise<ReviewResult> {
  const { supabase } = await getApplicant()
  const parsed = reviewSaveSchema.safeParse(input)
  if (!parsed.success) return { error: "Check the scorecard fields" }
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
  eventSlug: string,
  afterId?: string
): Promise<{ error: string | null; href?: string }> {
  await getApplicant()
  if (!judgeRouteSchema.shape.eventSlug.safeParse(eventSlug).success)
    return { error: "Invalid judging event" }
  try {
    const queue = await getJudgeQueue(eventSlug)
    return queue
      ? { error: null, href: judgeContinuation(eventSlug, queue, afterId) }
      : { error: "Judge access unavailable" }
  } catch {
    return { error: "Could not load your judging queue. Try again." }
  }
}

export async function acknowledgeBriefing(
  eventSlug: string
): Promise<{ error: string | null; href?: string }> {
  await getApplicant()
  if (!judgeRouteSchema.shape.eventSlug.safeParse(eventSlug).success)
    return { error: "Invalid judging event" }
  try {
    await acknowledgeJudgeBriefing(eventSlug)
  } catch {
    return {
      error:
        "Could not record that you read the briefing. Try again or contact an organizer.",
    }
  }
  revalidatePath("/judge")
  return continueJudgeQueue(eventSlug)
}

export async function checkJudgeReview(
  eventSlug: string
): Promise<{ error: string | null; event?: JudgeEvent }> {
  await getApplicant()
  if (!judgeRouteSchema.shape.eventSlug.safeParse(eventSlug).success)
    return { error: "Invalid judging event" }
  try {
    const event = await getJudgeEvent(eventSlug)
    return event
      ? { error: null, event }
      : {
          error:
            "Judge access unavailable. Ask an organizer to check your roster entry.",
        }
  } catch {
    return {
      error:
        "Could not check the deadline. Your unsaved inputs are still here; try again.",
    }
  }
}
