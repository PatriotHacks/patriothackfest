"use client"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"

import { AuthButton } from "@/components/auth/auth-fields"
import { PAPER, SERIF } from "@/components/paper"

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className={cn(
          PAPER,
          "max-w-[429px] gap-0 px-[16.5px] pt-[25px] pb-[17.5px] sm:max-w-[429px]"
        )}
      >
        <DialogTitle
          className={cn(
            SERIF,
            "text-center text-[38.5px] leading-[1.05] font-normal"
          )}
        >
          Settings
        </DialogTitle>
        <DialogClose asChild>
          <AuthButton type="button">Close</AuthButton>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
