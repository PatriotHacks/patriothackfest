import {
  fileAnswerSchema,
  isEmptyAnswer,
  isFieldVisible,
  type Answers,
  type Field,
  type PublishedSchema,
} from "@workspace/forms"

import { FileLink } from "./file-link"

function AnswerValue({ field, value }: { field: Field; value: unknown }) {
  if (isEmptyAnswer(field, value) && field.type !== "checkbox")
    return <span className="text-muted-foreground">No answer</span>
  if (field.type === "checkbox") return <>{value === true ? "Yes" : "No"}</>
  if (field.type === "file") {
    const file = fileAnswerSchema.safeParse(value)
    return file.success ? (
      <FileLink path={file.data.path} name={file.data.name} />
    ) : (
      <span className="text-muted-foreground">No answer</span>
    )
  }
  if (Array.isArray(value)) return <>{value.join(", ")}</>
  return <span className="whitespace-pre-wrap">{String(value)}</span>
}

export function AnswersView({
  schema,
  answers,
}: {
  schema: PublishedSchema
  answers: Answers
}) {
  return (
    <dl className="flex flex-col gap-4">
      {schema.fields
        .filter((f) => isFieldVisible(f, answers, schema))
        .map((field) => (
          <div key={field.id} className="flex flex-col gap-1">
            <dt className="text-sm font-medium">{field.label}</dt>
            <dd className="text-sm">
              <AnswerValue field={field} value={answers[field.id]} />
            </dd>
          </div>
        ))}
    </dl>
  )
}
