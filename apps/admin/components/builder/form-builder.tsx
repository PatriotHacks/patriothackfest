"use client"

import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  type Field,
  type FieldType,
} from "@workspace/forms"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { useState } from "react"

import {
  addField,
  archiveField,
  saveField,
  updateFormDetails,
} from "@/app/(admin)/forms/[formId]/actions"
import { DeadlinesForm } from "@/components/deadlines-form"
import { FormStatusBadges } from "@/components/form-status-badges"

import { withType } from "./field-utils"
import { QuestionEditor } from "./question-editor"
import { SaveIndicator } from "./save-indicator"
import { useAutosave } from "./use-autosave"

export type BuilderForm = {
  id: string
  role: string
  title: string
  description: string | null
  status: string
  published_at: string | null
  content_updated_at: string
  submissions_close_at: string | null
  edits_lock_at: string | null
}

type Props = {
  form: BuilderForm
  eventName: string
  initialFields: Field[]
  answeredFieldIds: string[]
  canEdit: boolean
}

export function FormBuilder({
  form,
  eventName,
  initialFields,
  answeredFieldIds,
  canEdit,
}: Props) {
  const [title, setTitle] = useState(form.title)
  const [description, setDescription] = useState(form.description ?? "")
  const [fields, setFields] = useState(initialFields)
  const [newType, setNewType] = useState<FieldType>("short_text")
  const [actionError, setActionError] = useState<string | null>(null)
  const [editedLocally, setEditedLocally] = useState(false)
  const autosave = useAutosave()

  function track(run: () => Promise<{ error: string | null }>) {
    return async () => {
      const result = await run()
      if (!result.error) setEditedLocally(true)
      return result
    }
  }

  function saveDetails(nextTitle: string, nextDescription: string) {
    autosave.schedule(
      "details",
      track(() =>
        updateFormDetails(form.id, {
          title: nextTitle,
          description: nextDescription || null,
        })
      )
    )
  }

  function changeField(next: Field) {
    setFields((current) => current.map((f) => (f.id === next.id ? next : f)))
    autosave.schedule(
      next.id,
      track(() => saveField(next))
    )
  }

  function changeType(field: Field, type: FieldType) {
    const next = withType(field, type)
    setFields((current) => current.map((f) => (f.id === next.id ? next : f)))
    autosave.schedule(
      next.id,
      track(async () => {
        const result = await saveField(next)
        if (result.error) {
          setFields((current) =>
            current.map((f) => (f.id === field.id ? field : f))
          )
        }
        return result
      }),
      0
    )
  }

  async function add() {
    setActionError(null)
    const result = await addField(form.id, newType, fields.length + 1)
    if (result.error || !result.field) {
      setActionError(result.error)
      return
    }
    setEditedLocally(true)
    setFields((current) => [...current, result.field!])
  }

  async function archive(field: Field) {
    setActionError(null)
    const result = await archiveField(field.id)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setEditedLocally(true)
    setFields((current) => current.filter((f) => f.id !== field.id))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {eventName}: {form.role}
        </h1>
        <FormStatusBadges
          form={form}
          unpublishedChanges={editedLocally && form.published_at !== null}
        />
        <div className="ml-auto flex items-center gap-3">
          {canEdit && (
            <SaveIndicator status={autosave.status} error={autosave.error} />
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          You have read-only access to this form.
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      )}

      <Card>
        <CardContent>
          <h2 className="mb-3 font-medium">Settings</h2>
          <DeadlinesForm
            formId={form.id}
            submissionsCloseAt={form.submissions_close_at}
            editsLockAt={form.edits_lock_at}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>

      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="form-title">Title</Label>
              <Input
                id="form-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  saveDetails(e.target.value, description)
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="form-description">Description</Label>
              <Textarea
                id="form-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  saveDetails(title, e.target.value)
                }}
              />
            </div>
          </CardContent>
        </Card>

        {fields.map((field, index) => (
          <Card key={field.id}>
            <CardContent>
              <QuestionEditor
                field={field}
                index={index}
                typeLocked={answeredFieldIds.includes(field.id)}
                issues={[]}
                onChange={changeField}
                onTypeChange={(type) => changeType(field, type)}
                onArchive={() => archive(field)}
              />
            </CardContent>
          </Card>
        ))}

        {canEdit && (
          <div className="flex items-center gap-2">
            <Select
              value={newType}
              onValueChange={(value) => setNewType(value as FieldType)}
            >
              <SelectTrigger aria-label="New question type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {FIELD_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={add}>
              Add question
            </Button>
          </div>
        )}
      </fieldset>
    </div>
  )
}
