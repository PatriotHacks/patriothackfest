"use client"

import type { ProjectQuestionAnswer } from "@workspace/forms"
import { signedUrlOrThrow } from "@workspace/supabase/storage"
import { ProjectAnswerView } from "@workspace/ui/components/project-answer"

import { projectFileUrl } from "@/app/(admin)/project-submissions/actions"

export function ProjectAnswers({
  answers,
}: {
  answers: ProjectQuestionAnswer[]
}) {
  return answers.map((item) => (
    <div key={item.question_id} className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold">{item.label}</h2>
      <ProjectAnswerView
        item={item}
        sign={(file) => signedUrlOrThrow(projectFileUrl(file.path))}
      />
    </div>
  ))
}
