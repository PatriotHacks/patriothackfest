"use server"

import { redirect } from "next/navigation"
import * as z from "zod"

import { failure, type ActionResult } from "@/lib/action-result"
import { getNamedApplicant } from "@/lib/applicant"

export async function startApplication(formId: string): Promise<ActionResult> {
  const id = z.guid().parse(formId)
  const { supabase } = await getNamedApplicant()

  const { data, error } = await supabase.rpc("start_application", {
    p_form_id: id,
  })
  if (error?.code === "23505")
    return { error: "You already have an application for this event." }
  if (error) return failure(error)

  redirect(`/applications/${data}`)
}
