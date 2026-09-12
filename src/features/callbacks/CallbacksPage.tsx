import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { StatTile } from "../../components/ui/StatTile"
import { Pill } from "../../components/ui/Pill"
import { Button } from "../../components/ui/Button"
import { LoadingState, EmptyState } from "../../components/ui/QueryStates"
import { claimCallbackTask, completeCallbackTask, listCallbackTasks, logCallbackAttempt } from "../../api/telephony"
import { createEnquiry } from "../../api/enquiries"
import { listUsers } from "../../api/accounts"
import { slaInfo } from "../../lib/sla"
import type { CallbackTask } from "../../types/api"

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

  const [convertingTask, setConvertingTask] = useState<CallbackTask | null>(null)

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
                  <Button size="sm" variant="secondary" onClick={() => setConvertingTask(task)}>
                    + Lead
                  </Button>
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

      {convertingTask && (
        <CallbackToEnquiryModal task={convertingTask} onClose={() => setConvertingTask(null)} />
      )}
    </div>
  )
}
function CallbackToEnquiryModal({
  task,
  onClose,
}: {
  task: CallbackTask
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [serviceRequested, setServiceRequested] = useState("")
  const [notes, setNotes] = useState(task.ivr_path ? `From IVR: ${task.ivr_path}` : "")

  const convert = useMutation({
    mutationFn: async () => {
      await createEnquiry({
        name: name || `Caller ${task.phone_number}`,
        mobile: task.phone_number,
        source: "ivr",
        service_requested: serviceRequested,
        notes: notes,
      })
      await completeCallbackTask(task.id, "Converted to enquiry lead")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["callback-tasks"] })
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border-strong rounded-xl p-5 w-[420px] shadow-2xl space-y-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-sm font-bold text-ink">Convert Call to CRM Enquiry</h3>
          <button onClick={onClose} className="text-ink-4 hover:text-ink text-xs p-1">✕</button>
        </div>
        <div className="space-y-2 text-xs">
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Caller Phone Number</label>
            <input value={task.phone_number} disabled className="w-full h-8 px-2.5 border border-border rounded bg-page/50 font-mono text-ink-3" />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Caller / Patient Name</label>
            <input
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Service / Speciality Enquired</label>
            <input
              placeholder="e.g. Cardiology OPD, Knee Replacement, MRI"
              value={serviceRequested}
              onChange={(e) => setServiceRequested(e.target.value)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Call Notes / Disposition</label>
            <textarea
              rows={2}
              placeholder="Summary of conversation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border justify-end">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={convert.isPending}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={() => convert.mutate()} disabled={convert.isPending}>
            {convert.isPending ? "Creating Enquiry…" : "Create Lead & Resolve"}
          </Button>
        </div>
      </div>
    </div>
  )
}
