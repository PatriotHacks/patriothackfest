"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Fragment, useId, useState, useTransition } from "react"

import {
  deleteEventJudge,
  previewJudgeTransfer,
  saveEventJudge,
  setEventJudgeGuest,
} from "@/app/(admin)/judging/judges-actions"
import { TableCard } from "@/components/table-card"
import {
  transferPreviewMessage,
  transferResultMessage,
  type JudgeRosterEntry,
  type JudgeTransferPreview,
} from "@/lib/judges"

type Track = { id: string; name: string; active: boolean }
type Kind = "general" | "sponsor"

const selectClass = "h-8 rounded-md border bg-background px-3 text-sm"

function SponsorTracks({
  tracks,
  scopes,
  trackIds,
  onChange,
}: {
  tracks: Track[]
  scopes: JudgeRosterEntry["scopes"]
  trackIds: string[]
  onChange: (trackIds: string[]) => void
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <legend className="mb-1 text-sm font-semibold">Sponsor tracks</legend>
      {tracks
        .filter(
          (track) =>
            track.active || scopes.some((scope) => scope.id === track.id)
        )
        .map((track) => {
          const referenced = scopes.some(
            (scope) => scope.id === track.id && scope.referenced
          )
          const checked = trackIds.includes(track.id)
          return (
            <label key={track.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                disabled={referenced || (!track.active && !checked)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...trackIds, track.id]
                      : trackIds.filter((value) => value !== track.id)
                  )
                }
              />
              {track.name}
              {!track.active && " (inactive)"}
              {referenced && " — required by existing assignments"}
            </label>
          )
        })}
      {!tracks.some((track) => track.active) && (
        <p className="text-sm text-muted-foreground">
          Add an active sponsor track before assigning new sponsor scopes.
        </p>
      )}
    </fieldset>
  )
}

export function AddJudgeForm({
  eventId,
  tracks,
}: {
  eventId: string
  tracks: Track[]
}) {
  const id = useId()
  const [email, setEmail] = useState("")
  const [kind, setKind] = useState<Kind>("general")
  const [capacity, setCapacity] = useState(20)
  const [trackIds, setTrackIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      aria-label="Add judge"
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        setMessage(null)
        startTransition(async () => {
          try {
            const result = await saveEventJudge({
              eventId,
              email,
              kind,
              active: true,
              capacity,
              trackIds,
            })
            setMessage(
              result.error ?? "Judge added; no invitation email was sent"
            )
            if (!result.error) {
              setEmail("")
              setKind("general")
              setCapacity(20)
              setTrackIds([])
            }
          } catch {
            setMessage("Could not save judge. Try again.")
          }
        })
      }}
    >
      <fieldset disabled={pending} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={`${id}-email`} className="sr-only">
            Judge email
          </Label>
          <Input
            id={`${id}-email`}
            type="email"
            maxLength={320}
            placeholder="judge@example.com"
            className="w-64"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Label htmlFor={`${id}-kind`} className="sr-only">
            Judge type
          </Label>
          <select
            id={`${id}-kind`}
            className={selectClass}
            value={kind}
            onChange={(event) => {
              const next = event.target.value as Kind
              setKind(next)
              if (next === "general") setTrackIds([])
            }}
          >
            <option value="general">General</option>
            <option value="sponsor">Sponsor</option>
          </select>
          <Label htmlFor={`${id}-capacity`} className="sr-only">
            Assignment capacity
          </Label>
          <Input
            id={`${id}-capacity`}
            type="number"
            min={1}
            max={1000}
            title="Assignment capacity"
            className="w-20"
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
            required
          />
          <Button type="submit" variant="outline">
            {pending ? "Adding…" : "Add judge"}
          </Button>
        </div>
        {kind === "sponsor" && (
          <SponsorTracks
            tracks={tracks}
            scopes={[]}
            trackIds={trackIds}
            onChange={setTrackIds}
          />
        )}
      </fieldset>
      {message && (
        <p role="status" aria-live="polite" className="text-sm">
          {message}
        </p>
      )}
    </form>
  )
}

export function EventJudgeForm({
  eventId,
  tracks,
  judge,
  started,
  onClose,
}: {
  eventId: string
  tracks: Track[]
  judge: JudgeRosterEntry
  started: boolean
  onClose?: () => void
}) {
  const id = useId()
  const [email, setEmail] = useState(judge.email)
  const [kind, setKind] = useState<Kind>(judge.kind)
  const [active, setActive] = useState(judge.active)
  const [capacity, setCapacity] = useState(judge.capacity)
  const [trackIds, setTrackIds] = useState(
    judge.scopes.map((scope) => scope.id)
  )
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<JudgeTransferPreview | null>(
    null
  )
  const [pending, startTransition] = useTransition()
  const deactivating = judge.active && !active

  function save() {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await saveEventJudge({
          eventId,
          judgeId: judge.id,
          email,
          kind,
          active,
          capacity,
          trackIds,
        })
        setMessage(
          result.error ??
            (deactivating && result.transfer
              ? `Judge saved. ${transferResultMessage(result.transfer)}`
              : "Judge saved")
        )
        if (!result.error) setEmail(email.trim().toLowerCase())
      } catch {
        setMessage("Could not save judge. Try again.")
      }
    })
  }

  return (
    <form
      aria-label={`Edit ${judge.email}`}
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!(started && deactivating)) return save()
        setMessage(null)
        startTransition(async () => {
          try {
            const result = await previewJudgeTransfer({
              eventId,
              judgeId: judge.id,
            })
            setMessage(result.error)
            if (result.preview) setConfirming(result.preview)
          } catch {
            setMessage("Could not check assignments. Try again.")
          }
        })
      }}
    >
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-email`}>Judge email</Label>
            <Input
              id={`${id}-email`}
              type="email"
              maxLength={320}
              className="w-64"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={judge.has_assignments && !judge.bound}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-kind`}>Judge type</Label>
            <select
              id={`${id}-kind`}
              className={selectClass}
              value={kind}
              disabled={judge.has_assignments}
              onChange={(event) => {
                const next = event.target.value as Kind
                setKind(next)
                if (next === "general") setTrackIds([])
              }}
            >
              <option value="general">General</option>
              <option value="sponsor">Sponsor</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-capacity`}>Capacity</Label>
            <Input
              id={`${id}-capacity`}
              type="number"
              min={1}
              max={1000}
              className="w-24"
              value={capacity}
              onChange={(event) => setCapacity(Number(event.target.value))}
              required
            />
          </div>
          <label className="flex h-8 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Active — uncheck and save to deactivate
          </label>
        </div>
        {kind === "sponsor" && (
          <SponsorTracks
            tracks={tracks}
            scopes={judge.scopes}
            trackIds={trackIds}
            onChange={setTrackIds}
          />
        )}
        {judge.bound && (
          <p className="text-sm text-muted-foreground">
            This entry is linked to an account. An email correction must match
            that same account's current verified email; it cannot transfer
            access to someone else.
          </p>
        )}
        {judge.has_assignments && (
          <p className="text-sm text-muted-foreground">
            Judge type and assignment-referenced tracks cannot change. Capacity
            changes never remove existing work.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="outline">
            {pending ? "Saving…" : "Save judge"}
          </Button>
          {onClose && (
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
          {message && (
            <p role="status" aria-live="polite" className="text-sm">
              {message}
            </p>
          )}
        </div>
      </fieldset>
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(next) => {
          if (!next) setConfirming(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate judge</AlertDialogTitle>
            <AlertDialogDescription>
              {judge.email} loses judge access. Submitted reviews stay and still
              count. {confirming && transferPreviewMessage(confirming)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirming(null)
                save()
              }}
            >
              Deactivate judge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

function GuestJudgeDialog({
  eventId,
  judge,
  started,
  onResult,
}: {
  eventId: string
  judge: JudgeRosterEntry
  started: boolean
  onResult: (message: string) => void
}) {
  const making = !judge.guest
  const needsPreview = making && started
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<JudgeTransferPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setError(null)
        setPreview(null)
        if (!next || !needsPreview) return
        startTransition(async () => {
          try {
            const result = await previewJudgeTransfer({
              eventId,
              judgeId: judge.id,
            })
            setError(result.error)
            if (result.preview) setPreview(result.preview)
          } catch {
            setError("Could not check assignments. Try again.")
          }
        })
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`${making ? "Make guest" : "Remove guest"} ${judge.email}`}
        >
          {making ? "Make guest" : "Remove guest"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {making ? "Make guest judge" : "Remove guest status"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {making
              ? `${judge.email} keeps portal access and can read every submitted project, but gets no assignments. Submitted reviews stay and still count.`
              : `${judge.email} becomes eligible for assignments again. Click Generate missing assignments to give them work.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {needsPreview && (
          <p className="text-sm">
            {preview
              ? transferPreviewMessage(preview)
              : !error && "Checking assignments…"}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || (needsPreview && !preview)}
            onClick={(event) => {
              event.preventDefault()
              setError(null)
              startTransition(async () => {
                try {
                  const result = await setEventJudgeGuest({
                    eventId,
                    judgeId: judge.id,
                    guest: making,
                  })
                  setError(result.error)
                  if (!result.transfer) return
                  setOpen(false)
                  onResult(
                    making
                      ? `${judge.email} is now a guest judge.${started ? ` ${transferResultMessage(result.transfer)}` : ""}`
                      : `${judge.email} is no longer a guest judge.`
                  )
                } catch {
                  setError("Could not update guest status. Try again.")
                }
              })
            }}
          >
            {pending ? "Saving…" : making ? "Make guest" : "Remove guest"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteJudgeDialog({
  eventId,
  judge,
}: {
  eventId: string
  judge: JudgeRosterEntry
}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setError(null)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Delete ${judge.email}`}
        >
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete judge</AlertDialogTitle>
          <AlertDialogDescription>
            Remove {judge.email} from this event&apos;s judge roster. They lose
            judge access for this event and are not emailed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              setError(null)
              startTransition(async () => {
                try {
                  const result = await deleteEventJudge({
                    eventId,
                    judgeId: judge.id,
                  })
                  setError(result.error)
                  if (!result.error) setOpen(false)
                } catch {
                  setError("Could not delete judge. Try again.")
                }
              })
            }}
          >
            {pending ? "Deleting…" : "Delete judge"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function JudgeRoster({
  eventId,
  judges,
  tracks,
  started,
}: {
  eventId: string
  judges: JudgeRosterEntry[]
  tracks: Track[]
  started: boolean
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <section className="flex flex-col gap-4" aria-labelledby="judges-heading">
      <h2 id="judges-heading" className="text-xl font-semibold">
        Judges
      </h2>
      <p className="text-sm text-muted-foreground">
        Add emails before or after registration. Judges sign in with an email
        code on the participant portal at /judge; they do not need to apply as
        participants. Adding a judge sends no email and grants no admin access.
      </p>
      <AddJudgeForm key={`new-${eventId}`} eventId={eventId} tracks={tracks} />
      {notice && (
        <p role="status" aria-live="polite" className="text-sm">
          {notice}
        </p>
      )}
      {judges.length === 0 ? (
        <p className="text-sm">No judges for this event yet.</p>
      ) : (
        <TableCard>
          <Table aria-label="Judges">
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tracks</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Load</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {judges.map((judge) => {
                const open = editing === judge.id
                return (
                  <Fragment key={judge.id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        {judge.email}
                      </TableCell>
                      <TableCell>
                        {judge.kind === "sponsor" ? "Sponsor" : "General"}
                      </TableCell>
                      <TableCell className="max-w-64 whitespace-normal">
                        {judge.scopes.length > 0
                          ? judge.scopes.map((scope) => scope.name).join(", ")
                          : "—"}
                      </TableCell>
                      <TableCell>{judge.capacity}</TableCell>
                      <TableCell>{judge.workload}</TableCell>
                      <TableCell>
                        {judge.active ? "Active" : "Inactive"} ·{" "}
                        {judge.bound ? "Linked" : "Not linked yet"}
                        {judge.guest && (
                          <Badge variant="secondary" className="ml-2">
                            Guest
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          {!started && (
                            <DeleteJudgeDialog
                              eventId={eventId}
                              judge={judge}
                            />
                          )}
                          <GuestJudgeDialog
                            eventId={eventId}
                            judge={judge}
                            started={started}
                            onResult={setNotice}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-expanded={open}
                            aria-label={`Edit ${judge.email}`}
                            onClick={() => setEditing(open ? null : judge.id)}
                          >
                            {open ? "Close" : "Edit"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="whitespace-normal">
                          <EventJudgeForm
                            eventId={eventId}
                            tracks={tracks}
                            judge={judge}
                            started={started}
                            onClose={() => setEditing(null)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </section>
  )
}
