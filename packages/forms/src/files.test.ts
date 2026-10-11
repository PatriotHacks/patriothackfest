import { describe, expect, it } from "vitest"

import { applicationFilePath, fileMaxSizeMb, fileUploadError } from "./files"
import { field } from "./test-utils"

const MB = 1024 * 1024

describe("applicationFilePath", () => {
  it("builds the storage path the upload policy expects", () => {
    expect(
      applicationFilePath({
        userId: "u",
        applicationId: "a",
        fieldId: "f",
        fileId: "x",
      })
    ).toBe("u/a/f/x.pdf")
  })
})

describe("fileUploadError", () => {
  it("accepts PDFs within the size limit", () => {
    expect(
      fileUploadError(field("file"), { type: "application/pdf", size: MB })
    ).toBeNull()
  })

  it("rejects other file types and empty files", () => {
    expect(
      fileUploadError(field("file"), { type: "image/png", size: MB })
    ).toBe("Upload a PDF file")
    expect(
      fileUploadError(field("file"), { type: "application/pdf", size: 0 })
    ).toBe("This file is empty")
  })

  it("uses the field limit capped at 10 MB", () => {
    const small = field("file", { validation: { max_size_mb: 2 } })
    expect(fileMaxSizeMb(small)).toBe(2)
    expect(
      fileUploadError(small, { type: "application/pdf", size: 3 * MB })
    ).toBe("Files must be 2 MB or smaller")
    expect(fileMaxSizeMb(field("file"))).toBe(10)
    expect(
      fileMaxSizeMb(field("file", { validation: { max_size_mb: 50 } }))
    ).toBe(10)
    expect(
      fileUploadError(field("file"), {
        type: "application/pdf",
        size: 10 * MB + 1,
      })
    ).toBe("Files must be 10 MB or smaller")
  })
})
