import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { StatTile } from "../../components/ui/StatTile"
import { Pill } from "../../components/ui/Pill"
import { Button } from "../../components/ui/Button"
import { LoadingState, EmptyState } from "../../components/ui/QueryStates"
import { claimCallbackTask, completeCallbackTask, listCallbackTasks, logCallbackAttempt } from "../../api/telephony"
import { listUsers } from "../../api/accounts"
import { slaInfo } from "../../lib/sla"

export function CallbacksPage() {
  const queryClient = useQueryClient()

  const pending = useQuery({ queryKey: ["callback-tasks", "pending"], queryFn: () => listCallbackTasks({ status: "pending" }) })
  const inProgress = useQuery({ queryKey: ["callback-tasks", "in_progress"], queryFn: () => listCallbackTasks({ status: "in_progress" }) })
  const escalated = useQuery({ queryKey: ["callback-tasks", "escalated"], queryFn: () => listCallbackTasks({ status: "escalated" }) })
  const done = useQuery({ queryKey: ["callback-tasks", "done"], queryFn: () => listCallbackTasks({ status: "done" }) })

  const queue = useQuery({
    queryKey: ["callback-tasks", "queue"],
    queryFn: () => listCallbackTasks({ ordering: "sla_due_at" }),
  })

  const users = useQuery({ queryKey: ["users"], queryFn: listUsers })
  const userName = (id: number | null) => {
    if (!id) return "Unassigned"
    const u = users.data?.results.find((u) => u.id === id)
    return u ? u.first_name || u.email : `User #${id}`
  }

  const claim = useMutation({
    mutationFn: claimCallbackTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["callback-tasks"] }),
  })
  const complete = useMutation({
    mutationFn: (id: number) => completeCallbackTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["callback-tasks"] }),
  })
  const logAttempt = useMutation({
    mutationFn: logCallbackAttempt,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["callback-tasks"] }),
  })

  const openQueue = queue.data?.results.filter((t) => t.status !== "done") ?? []

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-4 gap-3">
        <StatTile label="Pending" value={pending.data?.count ?? "…"} />
        <StatTile label="In progress" value={inProgress.data?.count ?? "…"} valueClassName="text-warning" />
        <StatTile label="Escalated" value={escalated.data?.count ?? "…"} valueClassName="text-danger" />
        <StatTile label="Done" value={done.data?.count ?? "…"} valueClassName="text-success" />
      </div>

      <Card>
        <div className="px-3.5 py-3 border-b border-border flex items-center gap-2">
          <div className="text-[13px] font-semibold">Callback queue</div>
          <div className="text-[12px] text-ink-4">every unanswered call becomes a task with an owner and SLA</div>
        </div>
        <div className="px-3.5 overflow-x-auto">
          <div className="grid grid-cols-[1.3fr_0.9fr_1.1fr_0.6fr_0.9fr_0.8fr_1.5fr] gap-2.5 py-2.5 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold min-w-[880px]">
            <div>Caller</div>
            <div>Missed at</div>
            <div>IVR path</div>
            <div>Tries</div>
            <div>Owner</div>
            <div>SLA</div>
            <div>Action</div>
          </div>
          {queue.isLoading && <LoadingState />}
          {openQueue.map((task) => {
            const sla = slaInfo(task.sla_due_at, task.status === "done")
            return (
              <div key={task.id} className="grid grid-cols-[1.3fr_0.9fr_1.1fr_0.6fr_0.9fr_0.8fr_1.5fr] gap-2.5 py-2.5 border-b border-border-faint items-center text-[13px] min-w-[880px]">
                <div className="font-mono text-[12.5px]">{task.phone_number}</div>
                <div className="text-ink-3 text-[12.5px]">{new Date(task.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                <div className="text-ink-3 text-[12.5px] truncate">{task.ivr_path || "—"}</div>
                <div className="text-ink-3 text-[12.5px]">{task.attempt_count}</div>
                <div className="text-ink-3 text-[12.5px] truncate">{userName(task.owner)}</div>
                <div><Pill tone={sla.tone}>{sla.text}</Pill></div>
                <div className="flex gap-1.5">
                  {task.status === "pending" && (
                    <Button size="sm" variant="primary" onClick={() => claim.mutate(task.id)} disabled={claim.isPending}>
                      Claim
                    </Button>
                  )}
                  {task.status === "in_progress" && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => logAttempt.mutate(task.id)} disabled={logAttempt.isPending}>
                        +1 try
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => complete.mutate(task.id)} disabled={complete.isPending}>
                        Complete
                      </Button>
                    </>
                  )}
                  {task.status === "escalated" && (
                    <Button size="sm" variant="primary" onClick={() => claim.mutate(task.id)} disabled={claim.isPending}>
                      Claim
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          {!queue.isLoading && openQueue.length === 0 && <EmptyState message="No open callbacks — the queue is clear." />}
        </div>
        <div className="px-3.5 py-2.5 text-[12px] text-ink-4">
          Escalation: 15 min unattended → escalated status (see apps.telephony.tasks.escalate_overdue_callbacks).
        </div>
      </Card>
    </div>
  )
}
