"use client"

import type { ProjectQuestionAnswer } from "@workspace/forms"

import { judgeProjectFileUrl } from "@/app/(judge)/judge/actions"
import {
  ProjectAnswerView,
  signedUrlOrThrow,
} from "@/components/project/answer-view"

export function JudgeAnswers({
  eventSlug,
  assignmentId,
  answers,
}: {
  eventSlug: string
  assignmentId: string
  answers: ProjectQuestionAnswer[]
}) {
  return answers.map((item) => (
    <section key={item.question_id} className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">{item.label}</h2>
      <ProjectAnswerView
        item={item}
        sign={() =>
          signedUrlOrThrow(
            judgeProjectFileUrl(eventSlug, assignmentId, item.question_id)
          )
        }
      />
    </section>
  ))
}
