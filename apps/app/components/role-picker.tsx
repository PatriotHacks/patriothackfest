"use client"

import { ROLE_LABELS, type Role } from "@workspace/supabase/roles"
import Link from "next/link"
import { useState, useTransition } from "react"

import { startApplication } from "@/app/(applicant)/(card)/apply/[eventSlug]/actions"
import { AuthError } from "@/components/auth/auth-fields"

export type RoleOption =
  | { role: Role; status: "open"; formId: string; closesAt: string }
  | { role: Role; status: "not_open" | "closed" }

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  participant: "Build a project with a team over the weekend.",
  volunteer: "Help run the event behind the scenes.",
  judge: "Review projects and help pick the winners.",
}

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
    <div className="flex flex-col gap-[7.5px]">
      {options.map((option) => {
        const open = option.status === "open"
        return (
          <button
            key={option.role}
            type="button"
            disabled={!open || pending}
            onClick={open ? () => start(option.role, option.formId) : undefined}
            className="flex w-full items-center justify-between gap-[15px] rounded-[10px] border-2 border-[#3A4A2B] bg-white px-[15px] py-[12.5px] text-left transition-colors outline-none hover:bg-[#3A4A2B]/5 focus-visible:ring-2 focus-visible:ring-[#3A4A2B]/20 disabled:cursor-not-allowed disabled:border-[#DAD7CC] disabled:bg-[#F1EFE8] disabled:hover:bg-[#F1EFE8]"
          >
            <span className="flex flex-col gap-[2.5px]">
              <span
                className={
                  open
                    ? "text-[16px] font-semibold text-[#3A4A2B]"
                    : "text-[16px] font-semibold text-[#A3A39B]"
                }
              >
                {ROLE_LABELS[option.role]}
              </span>
              <span
                className={
                  open
                    ? "text-[12.5px] text-[#6E6E68]"
                    : "text-[12.5px] text-[#A3A39B]"
                }
              >
                {ROLE_DESCRIPTIONS[option.role]}
              </span>
            </span>
            <span
              className={
                open
                  ? "shrink-0 text-right text-[11px] text-[#6E6E68]"
                  : "shrink-0 text-right text-[11px] font-medium tracking-[0.12em] text-[#8A8A82] uppercase"
              }
            >
              {open
                ? pending && selected === option.role
                  ? "Starting..."
                  : `Closes ${option.closesAt}`
                : UNAVAILABLE_REASONS[option.status]}
            </span>
          </button>
        )
      })}
      <p className="mt-[5px] text-center text-[12.5px] text-[#6E6E68]">
        You can apply for one role per event. Your role is final once you choose
        it.
      </p>
      {error && (
        <AuthError>
          {error}{" "}
          <Link href="/" className="underline">
            Go to your applications
          </Link>
        </AuthError>
      )}
    </div>
  )
}
