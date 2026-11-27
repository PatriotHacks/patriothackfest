import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { Pill } from "@workspace/ui/components/pill"
import { OUTLINE_PILL, PAPER } from "@workspace/ui/lib/brand"
import { cn } from "@workspace/ui/lib/utils"

import { AwardBadges, TrackChips } from "@/components/badges"
import { GalleryAnswer } from "@/components/gallery-answer"
import { PageHeader } from "@/components/page-header"
import { getGalleryProject, getGalleryProjects } from "@/lib/gallery"
import { memberName, truncate } from "@/lib/text"

export const revalidate = 300

export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: PageProps<"/[eventSlug]/[projectId]">): Promise<Metadata> {
  const { eventSlug, projectId } = await params
  const [data, list] = await Promise.all([
    getGalleryProject(eventSlug, projectId),
    getGalleryProjects(eventSlug),
  ])
  if (!data) notFound()
  const summary = list?.projects.find((p) => p.id === data.project.id)?.summary
  const description = summary
    ? truncate(summary, 160)
    : `A project built at ${data.event.name}.`
  return {
    title: `${data.project.name} | ${data.event.name}`,
    description,
    openGraph: {
      type: "article",
      title: data.project.name,
      description,
      url: `/${data.event.slug}/${data.project.id}`,
    },
  }
}

export default async function ProjectPage({
  params,
}: PageProps<"/[eventSlug]/[projectId]">) {
  const { eventSlug, projectId } = await params
  const data = await getGalleryProject(eventSlug, projectId)
  if (!data) notFound()
  const { event, project, answers, team, tracks, awards } = data

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link
        href={`/${event.slug}`}
        className="inline-flex min-h-11 w-fit items-center text-sm underline sm:min-h-0"
      >
        Back to {event.name} projects
      </Link>
      <PageHeader title={project.name}>
        <p className="text-[15px] text-[#6E6E68]">{event.name}</p>
      </PageHeader>
      {(awards.length > 0 || tracks.length > 0) && (
        <div className="flex flex-col gap-2">
          <AwardBadges awards={awards} />
          <TrackChips tracks={tracks} />
        </div>
      )}
      <article className={cn(PAPER, "flex flex-col gap-5 p-6")}>
        {team.length > 0 && (
          <section aria-labelledby="team" className="flex flex-col gap-2">
            <h2 id="team" className="text-lg font-semibold">
              Team
            </h2>
            <ul className="flex flex-wrap gap-2">
              {team.map((name, index) => (
                <li key={index}>
                  <Pill tone="muted">{memberName(name)}</Pill>
                </li>
              ))}
            </ul>
          </section>
        )}
        {answers.map((item) => (
          <section
            key={item.question_id}
            aria-labelledby={`q-${item.question_id}`}
            className="flex flex-col gap-1 border-t border-[#E7E4D9] pt-5 first:border-t-0 first:pt-0"
          >
            <h2 id={`q-${item.question_id}`} className="text-lg font-semibold">
              {item.label}
            </h2>
            <GalleryAnswer item={item} />
          </section>
        ))}
      </article>
      <Link
        href={`/${event.slug}`}
        className={cn(OUTLINE_PILL, "inline-flex items-center justify-center")}
      >
        Back to all projects
      </Link>
    </div>
  )
}
