"use client"

import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

type Failure = { error: string }

export type SendEmailsResult =
  | Failure
  | {
      error: null
      claimed: number
      sent: number
      failed: number
      remaining: number
    }

export type RetryEmailsResult = Failure | { error: null; count: number }

export function EmailSender({
  send: sendBatch,
  retry: retryFailed,
  pending,
  sending,
  failed,
  configured,
  autoStart = false,
}: {
  send: () => Promise<SendEmailsResult>
  retry: () => Promise<RetryEmailsResult>
  pending: number
  sending: number
  failed: number
  configured: boolean
  autoStart?: boolean
}) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number }>()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retrying, startRetry] = useTransition()

  const started = useRef(false)

  async function send() {
    started.current = true
    setRunning(true)
    setError(null)
    setMessage(null)
    let done = 0
    let sent = 0
    let failures = 0
    setProgress({ done, total: pending })
    try {
      for (;;) {
        const result = await sendBatch()
        if (result.error !== null) throw new Error(result.error)
        done += result.claimed
        sent += result.sent
        failures += result.failed
        setProgress({ done, total: done + result.remaining })
        if (result.remaining === 0) break
        if (result.claimed === 0) {
          setError(
            "No emails could be claimed. Another send may be in progress; try again in a few minutes."
          )
          break
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sending failed")
    }
    setMessage(`Sent ${sent}, failed ${failures}.`)
    setRunning(false)
    router.refresh()
  }

  useEffect(() => {
    if (autoStart && !started.current) void send()
  })

  function retry() {
    setError(null)
    setMessage(null)
    startRetry(async () => {
      const result = await retryFailed()
      if (result.error !== null) setError(result.error)
      else setMessage(`${result.count} failed emails queued again.`)
    })
  }

  const busy = running || retrying

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={send}
          disabled={!configured || busy || pending + sending === 0}
        >
          Send {pending} pending emails
        </Button>
        <Button
          variant="outline"
          onClick={retry}
          disabled={busy || failed === 0}
        >
          Retry {failed} failed
        </Button>
      </div>
      {sending > 0 && !running && (
        <p className="text-sm text-muted-foreground">
          {sending} emails are marked as sending. If a send was interrupted,
          they are picked up again 10 minutes after they were claimed.
        </p>
      )}
      {progress && (
        <div className="flex flex-col gap-1">
          <Progress
            value={
              progress.total === 0
                ? 100
                : (progress.done / progress.total) * 100
            }
            aria-label="Email sending progress"
          />
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {progress.done} of {progress.total} processed
          </p>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
