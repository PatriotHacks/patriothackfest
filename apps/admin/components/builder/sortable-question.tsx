"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent } from "@workspace/ui/components/card"
import { GripVerticalIcon } from "lucide-react"

export function SortableQuestion({
  id,
  index,
  draggable,
  children,
}: {
  id: string
  index: number
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
      className={isDragging ? "relative z-10 shadow-lg" : undefined}
    >
      <CardContent className="flex gap-3">
        {draggable && (
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="h-fit cursor-grab rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label={`Reorder question ${index + 1}`}
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
