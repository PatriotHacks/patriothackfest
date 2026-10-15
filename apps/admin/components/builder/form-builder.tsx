"use client"

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  FIELD_TYPE_LABELS,
  QUESTION_TYPES,
  type Field,
  isConditionSourceType,
  isSection,
  validateForPublish,
  type FieldType,
  type QuestionType,
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
import { useId, useState, useTransition } from "react"

import {
  addField,
  archiveField,
  publishForm,
  reorderFields,
  saveField,
  updateFormDetails,
} from "@/app/(admin)/forms/[formId]/actions"
import { DeadlinesForm } from "@/components/deadlines-form"
import { FormStatusBadges } from "@/components/form-status-badges"

import { BasicInfoItem } from "./basic-info-item"
import { withType } from "./field-utils"
import { PreviewPane } from "./preview-pane"
import { QuestionEditor } from "./question-editor"
import { SaveIndicator } from "./save-indicator"
import { SectionEditor } from "./section-editor"
import { SortableQuestion } from "./sortable-question"
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

function numberItems(fields: Field[]) {
  let sections = 1
  let questions = 0
  return fields.map((field) => (isSection(field) ? sections++ : questions++))
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
  const [newType, setNewType] = useState<QuestionType>("short_text")
  const [actionError, setActionError] = useState<string | null>(null)
  const [editedLocally, setEditedLocally] = useState(false)
  const autosave = useAutosave()
  const [showIssues, setShowIssues] = useState(false)
  const [publishErrors, setPublishErrors] = useState<string[]>([])
  const [publishMessage, setPublishMessage] = useState<string | null>(null)
  const [publishing, startPublish] = useTransition()
  const issues = validateForPublish(
    {
      title,
      submissions_close_at: form.submissions_close_at,
      edits_lock_at: form.edits_lock_at,
    },
    fields
  )
  const visibleIssues = showIssues ? issues : []
  const formIssues = visibleIssues.filter((i) => i.field_id === null)
  const itemNumbers = numberItems(fields)
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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

  function publish() {
    setShowIssues(true)
    setPublishErrors([])
    setPublishMessage(null)
    startPublish(async () => {
      if (!(await autosave.flush())) {
        setPublishErrors(["Fix the save errors before publishing"])
        return
      }
      if (issues.length > 0) return
      const { error } = await publishForm(form.id)
      if (error) {
        setPublishErrors(error.split("\n"))
        return
      }
      setEditedLocally(false)
      setShowIssues(false)
      setPublishMessage(
        form.status === "published" ? "Changes saved" : "Form published"
      )
    })
  }

  function reorder({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = fields.findIndex((f) => f.id === active.id)
    const to = fields.findIndex((f) => f.id === over.id)
    const next = arrayMove(fields, from, to)
    setFields(next)
    autosave.schedule(
      "order",
      track(() =>
        reorderFields(
          form.id,
          next.map((f) => f.id)
        )
      ),
      0
    )
  }

  async function add(type: FieldType) {
    setActionError(null)
    const result = await addField(form.id, type)
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
            <>
              <SaveIndicator status={autosave.status} error={autosave.error} />
              <Button onClick={publish} disabled={publishing}>
                {form.status === "published" ? "Save" : "Publish"}
              </Button>
            </>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          You have read-only access to this form.
        </p>
      )}
      {publishMessage && <p className="text-sm">{publishMessage}</p>}
      {(formIssues.length > 0 || publishErrors.length > 0) && (
        <ul role="alert" className="text-sm text-destructive">
          {[...formIssues.map((i) => i.message), ...publishErrors].map(
            (message) => (
              <li key={message}>{message}</li>
            )
          )}
        </ul>
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

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
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

          <BasicInfoItem />
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={reorder}
          >
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {fields.map((field, index) => {
                const number = itemNumbers[index]!
                const issues = visibleIssues
                  .filter((i) => i.field_id === field.id)
                  .map((i) => i.message)
                return (
                  <SortableQuestion
                    key={field.id}
                    id={field.id}
                    label={`${isSection(field) ? "section" : "question"} ${number + 1}`}
                    section={isSection(field)}
                    draggable={canEdit}
                  >
                    {isSection(field) ? (
                      <SectionEditor
                        section={field}
                        index={number}
                        typeLocked={answeredFieldIds.includes(field.id)}
                        issues={issues}
                        onChange={changeField}
                        onTypeChange={(type) => changeType(field, type)}
                        onArchive={() => archive(field)}
                      />
                    ) : (
                      <QuestionEditor
                        field={field}
                        index={number}
                        typeLocked={answeredFieldIds.includes(field.id)}
                        conditionSources={fields
                          .slice(0, index)
                          .filter((f) => isConditionSourceType(f.type))}
                        issues={issues}
                        onChange={changeField}
                        onTypeChange={(type) => changeType(field, type)}
                        onArchive={() => archive(field)}
                      />
                    )}
                  </SortableQuestion>
                )
              })}
            </SortableContext>
          </DndContext>

          {canEdit && (
            <div className="flex items-center gap-2">
              <Select
                value={newType}
                onValueChange={(value) => setNewType(value as QuestionType)}
              >
                <SelectTrigger aria-label="New question type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {FIELD_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => add(newType)}>
                Add question
              </Button>
              <Button variant="outline" onClick={() => add("section")}>
                Add section
              </Button>
            </div>
          )}
        </fieldset>
        <Card className="lg:sticky lg:top-6">
          <CardContent>
            <p className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Preview (working copy)
            </p>
            <PreviewPane
              title={title}
              description={description}
              fields={fields}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
