import {
  choiceLabels,
  fileAnswer,
  type FileAnswer,
  type ProjectQuestionAnswer,
} from "@workspace/forms"

import { FileLink } from "@/components/application/file-link"
import { judgeProjectUrl } from "@/lib/judge-reviews"

export function ProjectAnswerView({
  item,
  sign,
}: {
  item: Pick<ProjectQuestionAnswer, "type" | "options" | "answer">
  sign: (file: FileAnswer) => Promise<string>
}) {
  const empty = <p className="text-[#6E6E68]">No answer</p>
  switch (item.type) {
    case "short_text":
    case "long_text":
      return typeof item.answer === "string" && item.answer ? (
        <p className="break-words whitespace-pre-wrap">{item.answer}</p>
      ) : (
        empty
      )
    case "url": {
      const url = typeof item.answer === "string" ? item.answer : null
      const safe = judgeProjectUrl(url)
      if (!url) return empty
      return safe ? (
        <a
          href={safe}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all underline"
        >
          {url}
        </a>
      ) : (
        <p className="break-all">{url}</p>
      )
    }
    case "single_choice":
    case "multiple_choice": {
      const labels = choiceLabels(item.options, item.answer)
      if (labels.length === 0) return empty
      return item.type === "single_choice" ? (
        <p>{labels[0]}</p>
      ) : (
        <ul className="list-inside list-disc">
          {labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      )
    }
    case "file": {
      const file = fileAnswer(item.answer)
      return file ? (
        <FileLink name={file.name} sign={() => sign(file)} />
      ) : (
        empty
      )
    }
  }
}

export function signedUrlOrThrow(
  request: Promise<{ error: string | null; url?: string }>
) {
  return request.then((result) => {
    if (!result.url) throw new Error(result.error ?? "File not found")
    return result.url
  })
}
