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
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import Link from "next/link"
import { useState, useTransition } from "react"

import { startApplication } from "@/app/(applicant)/apply/[eventSlug]/actions"
import { ROLE_LABELS, type Role } from "@/lib/roles"

type OpenForm = {
  id: string
  role: Role
  title: string
  description: string | null
  closesAt: string
}

export function RolePicker({
  eventName,
  forms,
}: {
  eventName: string
  forms: OpenForm[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function start(formId: string) {
    setError(null)
    startTransition(async () => {
      const result = await startApplication(formId)
      setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          <Link href="/" className="underline">
            Go to your applications
          </Link>
        </p>
      )}
      {forms.map((form) => {
        const label = ROLE_LABELS[form.role]
        return (
          <Card key={form.id}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
              <CardDescription>
                {form.title} - applications close {form.closesAt}
              </CardDescription>
              <CardAction>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={pending}>Apply as {label}</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apply as {label}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your role is locked once you start. You can only have
                        one application for {eventName}, and you cannot switch
                        it to a different role later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => start(form.id)}>
                        Start application
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardAction>
            </CardHeader>
            {form.description && (
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {form.description}
                </p>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
