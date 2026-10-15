"use client"

import { ROLE_LABELS, type Role } from "@workspace/supabase/roles"
import Link from "next/link"
import { useState, useTransition } from "react"

import { startApplication } from "@/app/(applicant)/(card)/apply/[eventSlug]/actions"
import { AuthButton, AuthError } from "@/components/auth/auth-fields"

export type RoleOption =
  | { role: Role; status: "open"; formId: string; closesAt: string }
  | { role: Role; status: "not_open" | "closed" }

const UNAVAILABLE_REASONS = {
  not_open: "Not open yet",
  closed: "Applications closed",
}

export function RolePicker({ options }: { options: RoleOption[] }) {
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Role | null>(null)
  const [pending, startTransition] = useTransition()

  function start(role: Role, formId: string) {
    setError(null)
    setSelected(role)
    startTransition(async () => {
      const result = await startApplication(formId)
      setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-[8px]">
      {options.map((option) => {
        const open = option.status === "open"
        return (
          <div
            key={option.role}
            className={
              open
                ? "flex h-[62px] items-center justify-between gap-[16.5px] rounded-[11px] border-2 border-[#3A4A2B] bg-white px-[16.5px]"
                : "flex h-[62px] items-center justify-between gap-[16.5px] rounded-[11px] border-2 border-[#DAD7CC] bg-[#F1EFE8] px-[16.5px]"
            }
          >
            <span
              className={
                open
                  ? "truncate text-[17.5px] font-semibold text-[#3A4A2B]"
                  : "truncate text-[17.5px] font-semibold text-[#A3A39B]"
              }
            >
              {ROLE_LABELS[option.role]}
            </span>
            {open ? (
              <AuthButton
                type="button"
                disabled={pending}
                onClick={() => start(option.role, option.formId)}
                aria-label={`Apply as ${ROLE_LABELS[option.role]}`}
                className="mt-0 h-[36px] w-auto px-[20px] text-[15px]"
              >
                {pending && selected === option.role ? "Starting..." : "Apply"}
              </AuthButton>
            ) : (
              <span className="shrink-0 text-right text-[12px] font-medium tracking-[0.12em] text-[#8A8A82] uppercase">
                {UNAVAILABLE_REASONS[option.status]}
              </span>
            )}
          </div>
        )
      })}
      <p className="mt-[5.5px] text-center text-[14px] text-[#6E6E68]">
        You can apply for one role per event. Your role is final once you choose
        it.
      </p>
      {error && (
        <AuthError>
          {error}{" "}
          <Link href="/start" className="underline">
            Go to your applications
          </Link>
        </AuthError>
      )}
    </div>
  )
}
