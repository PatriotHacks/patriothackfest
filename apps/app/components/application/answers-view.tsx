import {
  fileAnswerSchema,
  isEmptyAnswer,
  isFieldVisible,
  type Answers,
  type Field,
  type PublishedSchema,
  type Question,
} from "@workspace/forms"

import { FileLink } from "./file-link"

function AnswerValue({ field, value }: { field: Field; value: unknown }) {
  if (isEmptyAnswer(field, value) && field.type !== "checkbox")
    return <span className="text-[#A3A39B]">No answer</span>
  if (field.type === "checkbox") return <>{value === true ? "Yes" : "No"}</>
  if (field.type === "file") {
    const file = fileAnswerSchema.safeParse(value)
    return file.success ? (
      <FileLink path={file.data.path} name={file.data.name} />
    ) : (
      <span className="text-[#A3A39B]">No answer</span>
    )
  }
  if (Array.isArray(value)) return <>{value.join(", ")}</>
  return <span className="whitespace-pre-wrap">{String(value)}</span>
}

export function AnswerList({
  schema,
  answers,
  questions,
}: {
  schema: PublishedSchema
  answers: Answers
  questions: readonly Question[]
}) {
  return (
    <dl className="flex flex-col gap-[16px]">
      {questions
        .filter((f) => isFieldVisible(f, answers, schema))
        .map((field) => (
          <div key={field.id} className="flex flex-col gap-[4px]">
            <dt className="text-[15px] font-semibold">{field.label}</dt>
            <dd className="text-[15px]">
              <AnswerValue field={field} value={answers[field.id]} />
            </dd>
          </div>
        ))}
    </dl>
  )
}
