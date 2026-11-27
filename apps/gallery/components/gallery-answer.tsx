"use client"

import { ProjectAnswerView } from "@workspace/ui/components/project-answer"

import type { GalleryAnswer as Answer } from "@/lib/gallery"

function noPublicFiles(): Promise<string> {
  throw new Error("Files are not public")
}

export function GalleryAnswer({ item }: { item: Answer }) {
  return <ProjectAnswerView item={item} sign={noPublicFiles} />
}
