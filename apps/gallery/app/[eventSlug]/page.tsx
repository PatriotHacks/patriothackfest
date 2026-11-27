import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { ProjectGallery } from "@/components/project-gallery"
import { getGalleryProjects } from "@/lib/gallery"
import { truncate } from "@/lib/text"

export const revalidate = 300

export function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: PageProps<"/[eventSlug]">): Promise<Metadata> {
  const { eventSlug } = await params
  const data = await getGalleryProjects(eventSlug)
  if (!data) notFound()
  const title = `${data.event.name} Projects`
  const description = `Browse ${data.projects.length} projects built at ${data.event.name}.`
  return {
    title,
    description,
    openGraph: { title, description, url: `/${data.event.slug}` },
  }
}

export default async function EventPage({ params }: PageProps<"/[eventSlug]">) {
  const { eventSlug } = await params
  const data = await getGalleryProjects(eventSlug)
  if (!data) notFound()
  const count = data.projects.length

  return (
    <>
      <PageHeader title={data.event.name}>
        <p className="text-[15px] text-[#6E6E68]">
          Project gallery &middot; {count}{" "}
          {count === 1 ? "project" : "projects"}
        </p>
      </PageHeader>
      <h2 className="sr-only">Projects</h2>
      <ProjectGallery
        eventSlug={data.event.slug}
        tracks={data.tracks}
        hasWinners={data.projects.some((project) => project.awards.length > 0)}
        projects={data.projects.map((project) => ({
          ...project,
          summary: project.summary && truncate(project.summary, 180),
        }))}
      />
    </>
  )
}
