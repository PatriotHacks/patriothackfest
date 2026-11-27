import "server-only"

import { unstable_cache } from "next/cache"
import { cache } from "react"
import * as z from "zod"

import {
  projectQuestionAnswerSchema,
  projectQuestionTypeSchema,
} from "@workspace/forms"
import { createPublicClient } from "@workspace/supabase/public"

const eventSlugSchema = z.string().regex(/^[A-Za-z0-9_-]+$/)
const projectIdSchema = z.guid()

const refSchema = z.object({ id: z.guid(), name: z.string() })
const awardSchema = refSchema.extend({ rank: z.number().int() })
const eventSchema = z.object({ slug: z.string(), name: z.string() })

const galleryEventsSchema = z.array(
  eventSchema.extend({ starts_at: z.string().nullable() })
)

const galleryProjectsSchema = z.object({
  event: eventSchema,
  tracks: z.array(refSchema.extend({ sponsor: z.string().nullable() })),
  awards: z.array(awardSchema.extend({ track_id: z.guid().nullable() })),
  projects: z.array(
    refSchema.extend({
      summary: z.string().nullable(),
      tracks: z.array(refSchema),
      awards: z.array(awardSchema),
    })
  ),
})

const galleryProjectSchema = z.object({
  event: eventSchema,
  project: refSchema,
  answers: z.array(
    projectQuestionAnswerSchema.extend({
      type: projectQuestionTypeSchema.exclude(["file"]),
    })
  ),
  team: z.array(z.string().nullable()),
  tracks: z.array(refSchema),
  awards: z.array(awardSchema),
})

export type GalleryEvent = z.infer<typeof galleryEventsSchema>[number]
export type GalleryProjects = z.infer<typeof galleryProjectsSchema>
export type GalleryProjectCard = GalleryProjects["projects"][number]
export type GalleryTrack = GalleryProjects["tracks"][number]
export type GalleryAward = z.infer<typeof awardSchema>
export type GalleryProject = z.infer<typeof galleryProjectSchema>
export type GalleryAnswer = GalleryProject["answers"][number]

export const getGalleryEvents = unstable_cache(
  async () => {
    const { data, error } = await createPublicClient().rpc("gallery_events")
    if (error) throw new Error(error.message)
    return galleryEventsSchema.parse(data)
  },
  ["gallery-events"],
  { revalidate: 300 }
)

export const getGalleryProjects = cache(async (eventSlug: string) => {
  if (!eventSlugSchema.safeParse(eventSlug).success) return null
  const { data, error } = await createPublicClient().rpc("gallery_projects", {
    p_event_slug: eventSlug,
  })
  if (error) throw new Error(error.message)
  return data === null ? null : galleryProjectsSchema.parse(data)
})

export const getGalleryProject = cache(
  async (eventSlug: string, projectId: string) => {
    if (
      !eventSlugSchema.safeParse(eventSlug).success ||
      !projectIdSchema.safeParse(projectId).success
    )
      return null
    const { data, error } = await createPublicClient().rpc("gallery_project", {
      p_event_slug: eventSlug,
      p_project_id: projectId,
    })
    if (error) throw new Error(error.message)
    return data === null ? null : galleryProjectSchema.parse(data)
  }
)
