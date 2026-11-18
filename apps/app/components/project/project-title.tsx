"use client"

import { createContext, use, useState, type ReactNode } from "react"

const ProjectTitleContext = createContext<((name: string) => void) | null>(null)

// The page heading follows the saved name, including teammates' autosaves.
export function ProjectTitle({
  initial,
  className,
  children,
}: {
  initial: string
  className: string
  children: ReactNode
}) {
  const [name, setName] = useState(initial)
  return (
    <ProjectTitleContext value={setName}>
      <h1 className={className}>{name.trim() || "Untitled project"}</h1>
      {children}
    </ProjectTitleContext>
  )
}

export function useProjectTitle() {
  return use(ProjectTitleContext)
}
