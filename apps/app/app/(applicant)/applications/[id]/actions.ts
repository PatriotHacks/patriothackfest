"use server"

import { answersSchema, type AnswerErrors } from "@workspace/forms"
import type { Json } from "@workspace/supabase/types"
import { refresh } from "next/cache"
import * as z from "zod"

import { failure, ok, type ActionResult } from "@/lib/action-result"
import { getApplicant } from "@/lib/applicant"

export type SaveResult = ActionResult & {
  fieldErrors?: AnswerErrors
  updatedAt?: string
}

const errorDetails = z.record(z.string(), z.string())

function answerFailure(error: {
  code: string
  message: string
  details: string
}): SaveResult {
  if (error.code !== "PT422") return failure(error)
  return {
    error: "Some answers need attention",
    fieldErrors: errorDetails.parse(JSON.parse(error.details)),
  }
}

export async function getUpdatedAt(
  applicationId: string
): Promise<ActionResult & { updatedAt?: string }> {
  const id = z.guid().parse(applicationId)
  const { supabase } = await getApplicant()

  const { data, error } = await supabase
    .from("applications")
    .select("updated_at")
    .eq("id", id)
    .single()
  if (error) return failure(error)
  return { error: null, updatedAt: data.updated_at }
}

export async function saveAnswers(
  applicationId: string,
  answers: Record<string, unknown>
): Promise<SaveResult> {
  const id = z.guid().parse(applicationId)
  const input = answersSchema.parse(answers)
  const { supabase } = await getApplicant()

  const { data, error } = await supabase.rpc("save_application_answers", {
    p_application_id: id,
    p_answers: input as Json,
  })
  if (error) return answerFailure(error)

  return { error: null, updatedAt: data }
}

export async function submitApplication(
  applicationId: string
): Promise<SaveResult> {
  const id = z.guid().parse(applicationId)
  const { supabase } = await getApplicant()

  const { error } = await supabase.rpc("submit_application", {
    p_application_id: id,
  })
  if (error) return answerFailure(error)

  refresh()
  return ok
}

export async function withdrawApplication(
  applicationId: string
): Promise<ActionResult> {
  const id = z.guid().parse(applicationId)
  const { supabase } = await getApplicant()

  const { error } = await supabase.rpc("withdraw_application", {
    p_application_id: id,
  })
  if (error) return failure(error)

  refresh()
  return ok
}

export async function declineOffer(
  applicationId: string
): Promise<ActionResult> {
  const id = z.guid().parse(applicationId)
  const { supabase } = await getApplicant()

  const { error } = await supabase.rpc("decline_application_offer", {
    p_application_id: id,
  })
  if (error) return failure(error)

  refresh()
  return ok
}
