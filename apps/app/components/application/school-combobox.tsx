"use client"

import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronsUpDownIcon } from "lucide-react"
import { useState } from "react"

import { isListedSchool, searchSchools } from "@/lib/schools"

import { FormInput } from "./form-controls"

const RESULT_LIMIT = 50

export function SchoolCombobox({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  describedBy,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  invalid: boolean
  describedBy: string | undefined
  disabled: boolean
}) {
  const [other, setOther] = useState(value !== "" && !isListedSchool(value))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const results = searchSchools(query, RESULT_LIMIT)

  function choose(name: string) {
    setOpen(false)
    setQuery("")
    onChange(name)
    onBlur()
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={other ? undefined : id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={!other && invalid}
            aria-describedby={other ? undefined : describedBy}
            disabled={disabled}
            className={cn(
              "flex h-[48px] w-full items-center justify-between gap-2 rounded-[8px] border-2 border-[#3A4A2B] bg-white px-[14px] text-left text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-[#3A4A2B]/20 disabled:cursor-not-allowed disabled:border-[#DAD7CC] disabled:bg-[#F1EFE8] aria-invalid:border-destructive",
              other || value === "" ? "text-[#A3A39B]" : "text-[#2A2A26]"
            )}
          >
            <span className="truncate">
              {other ? "Other" : value || "Search for your school"}
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-[#6E6E68]" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search schools"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandGroup>
                {results.map((name) => (
                  <CommandItem
                    key={name}
                    value={name}
                    data-checked={!other && name === value}
                    onSelect={() => {
                      setOther(false)
                      choose(name)
                    }}
                  >
                    {name}
                  </CommandItem>
                ))}
                <CommandItem
                  value="__other__"
                  data-checked={other}
                  onSelect={() => {
                    setOther(true)
                    choose("")
                  }}
                >
                  Other (not listed)
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {other && (
        <FormInput
          id={id}
          placeholder="Your school's name"
          autoComplete="organization"
          maxLength={200}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}
    </div>
  )
}
