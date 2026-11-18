import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
vi.mock("@/lib/project-file-actions", () => ({ projectFileUrl: vi.fn() }))
import { JudgeProjectDetails } from "./project-details"

const q = (n: number) => `b0000000-0000-4000-8000-00000000000${n}`
const options = [
  { id: q(8), label: "Web" },
  { id: q(9), label: "Mobile" },
]
describe("judge project rendering", () => {
  it("escapes answers and rejects unsafe links without fetching URLs", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeProjectDetails, {
        detail: {
          project: { name: "Project" },
          assignment: {
            id: "a0000000-0000-4000-8000-000000000001",
            track_id: null,
            track_name: null,
            creativity_score: null,
            technical_score: null,
            impact_score: null,
            presentation_score: null,
            total_score: null,
            submitted_at: null,
            notes: "",
          },
          answers: [
            {
              question_id: q(1),
              label: "What inspired you?",
              type: "long_text",
              options: null,
              answer: "<i>Curiosity</i>",
            },
            {
              question_id: q(2),
              label: "Anything else?",
              type: "short_text",
              options: null,
              answer: null,
            },
            {
              question_id: q(3),
              label: "Platform",
              type: "multiple_choice",
              options,
              answer: [q(9), "removed"],
            },
            {
              question_id: q(4),
              label: "Primary",
              type: "single_choice",
              options,
              answer: q(8),
            },
            {
              question_id: q(5),
              label: "Slides",
              type: "url",
              options: null,
              answer: "https://slides.example.test/deck",
            },
            {
              question_id: q(6),
              label: "Bad link",
              type: "url",
              options: null,
              answer: "ftp://files.example.test",
            },
            {
              question_id: q(7),
              label: "Pitch deck",
              type: "file",
              options: null,
              answer: {
                path: "p/q/f.pdf",
                name: "deck.pdf",
                size: 10,
                type: "application/pdf",
              },
            },
          ],
          team: ["Ada <b>Lovelace</b>", null],
        },
      })
    )
    expect(html).toContain('<h2 class="text-lg font-semibold">Team</h2>')
    expect(html).toContain("<li>Ada &lt;b&gt;Lovelace&lt;/b&gt;</li>")
    expect(html).toContain("<li>Unnamed participant</li>")
    expect(html).toContain("General judging")
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain("What inspired you?")
    expect(html).toContain("&lt;i&gt;Curiosity&lt;/i&gt;")
    expect(html).toContain("No answer")
    expect(html).toContain("<li>Mobile</li>")
    expect(html).not.toContain("removed")
    expect(html).toContain("<p>Web</p>")
    expect(html).toContain('href="https://slides.example.test/deck"')
    expect(html).toContain("ftp://files.example.test</p>")
    expect(html).toContain("View deck.pdf")
    expect(html).not.toContain("p/q/f.pdf")
  })
  it("omits the team section when names are hidden", () => {
    const html = renderToStaticMarkup(
      createElement(JudgeProjectDetails, {
        detail: {
          project: { name: "Project" },
          assignment: {
            id: "a0000000-0000-4000-8000-000000000001",
            track_id: null,
            track_name: null,
            creativity_score: null,
            technical_score: null,
            impact_score: null,
            presentation_score: null,
            total_score: null,
            submitted_at: null,
            notes: "",
          },
          answers: [],
          team: [],
        },
      })
    )
    expect(html).not.toContain(">Team</h2>")
  })
})
