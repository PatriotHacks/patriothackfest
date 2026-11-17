import {
  choiceLabels,
  fileAnswer,
  type ProjectQuestionAnswer,
} from "@workspace/forms"

import { ProjectFileLink } from "@/components/file-link"
import { safeProjectUrl } from "@/lib/organizer-projects"

export function ProjectAnswer({ item }: { item: ProjectQuestionAnswer }) {
  const empty = <p className="text-muted-foreground">No answer</p>
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
      const safe = safeProjectUrl(url)
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
        <ProjectFileLink path={file.path} name={file.name} />
      ) : (
        empty
      )
    }
  }
}
