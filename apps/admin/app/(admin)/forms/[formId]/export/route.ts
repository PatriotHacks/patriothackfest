import {
  answersSchema,
  buildApplicationsCsv,
  publishedSchemaSchema,
  toZonedInputValue,
} from "@workspace/forms"
import type { NextRequest } from "next/server"
import * as z from "zod"

import { getAdmin } from "@/lib/admin"
import { fetchAll } from "@/lib/fetch-all"
import { hasLevel } from "@/lib/levels"

const safe = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/forms/[formId]/export">
) {
  const { formId } = await ctx.params
  if (!z.guid().safeParse(formId).success)
    return new Response("Not found", { status: 404 })
  const { supabase, level } = await getAdmin()
  if (!hasLevel(level, "organizer"))
    return new Response("Forbidden", { status: 403 })

  const { data: form, error } = await supabase
    .from("forms")
    .select("id, role, published_schema, decisions_released_at, events(slug)")
    .eq("id", formId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!form) return new Response("Not found", { status: 404 })
  if (!form.published_schema)
    return new Response("This form has not been published", { status: 409 })

  const applications = await fetchAll((from, to) =>
    supabase
      .from("applications")
      .select(
        "id, role, status, submitted_at, declined_at, withdrawn_at, answers, under_18, profiles(full_name, email, school, phone, date_of_birth), application_decisions(decision, decided_at)"
      )
      .eq("form_id", formId)
      .order("created_at")
      .order("id")
      .range(from, to)
  )

  const csv = buildApplicationsCsv(
    publishedSchemaSchema.parse(form.published_schema),
    applications.map((a) => ({
      id: a.id,
      fullName: a.profiles.full_name,
      email: a.profiles.email,
      school: a.profiles.school,
      phone: a.profiles.phone,
      dateOfBirth: a.profiles.date_of_birth,
      under18: a.under_18 === true,
      role: a.role,
      status: a.status,
      submittedAt: a.submitted_at,
      decision: a.application_decisions?.decision ?? "pending",
      decidedAt: a.application_decisions?.decided_at ?? null,
      decisionsReleased: form.decisions_released_at !== null,
      declinedAt: a.declined_at,
      withdrawnAt: a.withdrawn_at,
      answers: answersSchema.parse(a.answers),
      applicationUrl: `${request.nextUrl.origin}/applications/${a.id}`,
    }))
  )

  const date = toZonedInputValue(new Date().toISOString()).slice(0, 10)
  const filename = `${safe(form.events.slug)}-${form.role}-${date}.csv`

  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
