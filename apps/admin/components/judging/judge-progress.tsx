import { Progress } from "@workspace/ui/components/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { TableCard } from "@/components/table-card"
import type { JudgeProgress } from "@/lib/judge-progress"

export function JudgeProgressTable({ judges }: { judges: JudgeProgress[] }) {
  return (
    <>
      <h3 className="font-semibold">Judge progress</h3>
      {judges.length === 0 ? (
        <p className="text-sm">No judges have assignments yet.</p>
      ) : (
        <TableCard>
          <Table aria-label="Judge review progress">
            <TableHeader>
              <TableRow>
                <TableHead>Judge</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>In progress</TableHead>
                <TableHead>Not started</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {judges.map((judge) => (
                <TableRow key={judge.judge_id}>
                  <TableCell className="break-words whitespace-normal">
                    {judge.email}
                    {!judge.active && (
                      <p className="text-xs text-muted-foreground">Inactive</p>
                    )}
                  </TableCell>
                  <TableCell>{judge.completed}</TableCell>
                  <TableCell>{judge.in_progress}</TableCell>
                  <TableCell>{judge.not_started}</TableCell>
                  <TableCell>{judge.total}</TableCell>
                  <TableCell>
                    <div className="flex min-w-24 flex-col gap-1">
                      <span>
                        {judge.completed} / {judge.total}
                      </span>
                      <Progress
                        aria-label={`${judge.email} completed ${judge.completed} of ${judge.total}`}
                        value={(judge.completed / judge.total) * 100}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </>
  )
}
