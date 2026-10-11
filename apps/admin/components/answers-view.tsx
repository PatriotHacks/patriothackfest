import {
  fileAnswerSchema,
  isEmptyAnswer,
  isFieldVisible,
  type Answers,
  type Field,
  type PublishedSchema,
} from "@workspace/forms"

const noAnswer = <span className="text-muted-foreground">No answer</span>

function AnswerValue({ field, value }: { field: Field; value: unknown }) {
  if (field.type === "checkbox") return <>{value === true ? "Yes" : "No"}</>
  if (isEmptyAnswer(field, value)) return noAnswer
  if (field.type === "file") {
    const file = fileAnswerSchema.safeParse(value)
    return file.success ? <>{file.data.name}</> : noAnswer
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
  const visible = schema.fields.filter((f) =>
    isFieldVisible(f, answers, schema)
  )
  if (visible.length === 0)
    return <p className="text-sm text-muted-foreground">No questions.</p>

  return (
    <dl className="flex flex-col gap-4">
      {visible.map((field) => (
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
