"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { GripVerticalIcon } from "lucide-react"

export function SortableQuestion({
  id,
  label,
  section,
  draggable,
  children,
}: {
  id: string
  label: string
  section: boolean
  draggable: boolean
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !draggable })

  return (
    <Card
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        section && "mt-4 border-l-4 border-l-primary bg-muted/50",
        isDragging && "relative z-10 shadow-lg"
      )}
    >
      <CardContent className="flex gap-3">
        {draggable && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="h-fit cursor-grab rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label={`Reorder ${label}`}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        )}
        <div className="flex-1">{children}</div>
      </CardContent>
    </Card>
  )
}
