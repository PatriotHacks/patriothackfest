import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AwardBadges, TrackChips } from "@/components/badges"
import { GalleryAnswer } from "@/components/gallery-answer"
import { PageHero, Sheet } from "@/components/page-hero"
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
    <>
      <PageHero
        eyebrow={
          <Link
            href={`/${event.slug}`}
            className="hover:text-cream inline-flex min-h-11 items-center gap-2 no-underline"
          >
            <span aria-hidden="true">&larr;</span> {event.name} projects
          </Link>
        }
        title={project.name}
      >
        <AwardBadges awards={awards} />
        <TrackChips tracks={tracks} />
      </PageHero>
      <Sheet>
        <div className="mx-auto flex max-w-[820px] flex-col gap-10">
          {team.length > 0 && (
            <section aria-labelledby="team" className="flex flex-col gap-3">
              <h2 id="team" className="text-2xl font-bold">
                Team
              </h2>
              <ul className="flex flex-wrap gap-2">
                {team.map((name, index) => (
                  <li
                    key={index}
                    className="rounded-full bg-card px-4 py-1.5 text-[15px] font-medium"
                  >
                    {memberName(name)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {answers.map((item) => (
            <section
              key={item.question_id}
              aria-labelledby={`q-${item.question_id}`}
              className="ink hatch [&_a]:text-cream flex flex-col gap-3 px-6 pt-6 pb-7 [--fill:var(--color-card)] [&_a]:underline-offset-[3px]"
            >
              <h2 id={`q-${item.question_id}`} className="text-xl font-bold">
                {item.label}
              </h2>
              <div className="[&_p]:text-text text-muted">
                <GalleryAnswer item={item} />
              </div>
            </section>
          ))}
          <Link href={`/${event.slug}`} className="btn self-start">
            Back to all projects
          </Link>
        </div>
      </Sheet>
    </>
  )
}
