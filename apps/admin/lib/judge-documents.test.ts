import { describe, expect, it } from "vitest"

import {
  certificatePath,
  invitationLetterPath,
  judgeCertificateInput,
  postJudgingRosterSchema,
} from "./judge-documents"

const eventId = "a0000000-0000-4000-8000-000000000001"
const judgeId = "b0000000-0000-4000-8000-000000000001"
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

describe("judge document paths", () => {
  it("builds a fresh certificate path in the judge's slot", () => {
    const path = certificatePath(eventId, judgeId)
    expect(path).toMatch(
      new RegExp(`^${eventId}/certificates/${judgeId}/${uuid}\\.pdf$`)
    )
    expect(certificatePath(eventId, judgeId)).not.toBe(path)
  })
  it("builds a fresh invitation letter path for the event", () => {
    expect(invitationLetterPath(eventId)).toMatch(
      new RegExp(`^${eventId}/invitation-letter/${uuid}\\.pdf$`)
    )
  })
})

describe("judge document schemas", () => {
  it("accepts a path or null and rejects blanks", () => {
    const input = { eventId, judgeId }
    expect(
      judgeCertificateInput.safeParse({ ...input, path: null }).success
    ).toBe(true)
    expect(
      judgeCertificateInput.safeParse({ ...input, path: "" }).success
    ).toBe(false)
    expect(
      judgeCertificateInput.safeParse({ ...input, path: "x", extra: 1 }).success
    ).toBe(false)
  })
  it("parses the post-judging roster", () => {
    const judge = {
      id: judgeId,
      email: "judge@example.com",
      guest: false,
      receives_invitation: true,
      certificate_path: null,
    }
    expect(postJudgingRosterSchema.parse([judge])).toEqual([judge])
  })
})
