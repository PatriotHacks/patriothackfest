import { AuthTextButton } from "@workspace/ui/components/auth-fields"

export function StaleAlert({
  onReload,
  onDismiss,
}: {
  onReload: () => void
  onDismiss: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-[8px] rounded-[11px] border-2 border-[#3A4A2B]/30 bg-white px-[14px] py-[12px] text-[14px] text-[#2A2A26]"
    >
      <p>
        This application was updated in another tab. Reload to see the latest
        answers; saving here overwrites them.
      </p>
      <div className="flex gap-[16px]">
        <AuthTextButton onClick={onReload}>Reload</AuthTextButton>
        <AuthTextButton onClick={onDismiss} className="text-[#6E6E68]">
          Dismiss
        </AuthTextButton>
      </div>
    </div>
  )
}
