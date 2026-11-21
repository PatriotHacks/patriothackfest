import { notFound, redirect } from "next/navigation"

import { judgeBriefingHref, judgeRouteSchema } from "@/lib/judge-reviews"

export default async function JudgeBriefingPage({
  params,
}: PageProps<"/judge/[eventSlug]/briefing">) {
  const { eventSlug } = await params
  if (!judgeRouteSchema.shape.eventSlug.safeParse(eventSlug).success) notFound()
  redirect(judgeBriefingHref(eventSlug))
}
