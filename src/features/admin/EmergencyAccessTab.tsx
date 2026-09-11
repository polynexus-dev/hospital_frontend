import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { ErrorState, EmptyState, LoadingState } from "../../components/ui/QueryStates"
import { listEmergencyAccessLogs, markEmergencyAccessReviewed } from "../../api/core"
import type { EmergencyAccessLog } from "../../types/api"

function ReviewRow({ log }: { log: EmergencyAccessLog }) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState("")

  const markReviewed = useMutation({
    mutationFn: () => markEmergencyAccessReviewed(log.id, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["emergency-access-logs"] }),
  })

  return (
    <div className="grid grid-cols-[1.1fr_1.1fr_1.4fr_1.6fr_0.9fr_1.6fr] gap-2.5 py-2.5 border-b border-border-faint items-center text-[13px] min-w-[1100px]">
      <div className="font-mono text-[12px] text-ink-3">{new Date(log.accessed_at).toLocaleString()}</div>
      <div className="text-ink-3 truncate">{log.actor_email ?? "unknown"}</div>
      <div className="text-ink-2 truncate">{log.model_name} #{log.object_id}</div>
      <div className="text-ink-2 truncate" title={log.reason}>{log.reason}</div>
      <div>
        {log.reviewed ? <Pill tone="ok">Reviewed</Pill> : <Pill tone="warn">Unreviewed</Pill>}
      </div>
      <div>
        {log.reviewed ? (
          <div className="text-[12px] text-ink-4 truncate" title={log.review_notes}>
            by {log.reviewed_by_email ?? "—"} · {log.review_notes || "no notes"}
          </div>
        ) : (
          <div className="flex gap-1.5">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Review notes (optional)"
              className="flex-1 min-w-0 px-2 py-1 text-[12px] border border-border-strong rounded-control bg-page"
            />
            <Button size="sm" variant="primary" disabled={markReviewed.isPending} onClick={() => markReviewed.mutate()}>
              {markReviewed.isPending ? "Saving…" : "Mark reviewed"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function EmergencyAccessTab() {
  const [filter, setFilter] = useState<"unreviewed" | "all">("unreviewed")

  const { data, isLoading, isError } = useQuery({
    queryKey: ["emergency-access-logs", filter],
    queryFn: () => listEmergencyAccessLogs(filter === "unreviewed" ? { reviewed: "false" } : {}),
  })

  const logs = data?.results ?? []

  return (
    <Card>
      <CardHeader className="justify-between">
        <div>
          <div className="text-[13px] font-semibold">Break-glass emergency access</div>
          <div className="text-[12px] text-ink-4">every retrieval that bypassed a clinician's normal assignment scope, for review</div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={filter === "unreviewed" ? "primary" : "secondary"} onClick={() => setFilter("unreviewed")}>
            Unreviewed
          </Button>
          <Button size="sm" variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>
            All
          </Button>
        </div>
      </CardHeader>
      <div className="px-3.5 overflow-x-auto">
        <div className="grid grid-cols-[1.1fr_1.1fr_1.4fr_1.6fr_0.9fr_1.6fr] gap-2.5 py-2.5 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold min-w-[1100px]">
          <div>Time</div>
          <div>Clinician</div>
          <div>Record accessed</div>
          <div>Reason given</div>
          <div>Status</div>
          <div>Review</div>
        </div>
        {isLoading && <LoadingState />}
        {isError && <ErrorState />}
        {!isLoading && !isError && logs.map((log) => <ReviewRow key={log.id} log={log} />)}
        {!isLoading && !isError && logs.length === 0 && (
          <EmptyState message={filter === "unreviewed" ? "No emergency access awaiting review." : "No emergency access has been recorded."} />
        )}
      </div>
    </Card>
  )
}
