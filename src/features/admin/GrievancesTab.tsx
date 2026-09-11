import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import { ErrorState, EmptyState, LoadingState } from "../../components/ui/QueryStates"
import { createGrievanceTicket, listGrievanceTickets, resolveGrievanceTicket } from "../../api/privacy"
import type { GrievancePriority, GrievanceStatus, GrievanceTicket } from "../../types/api"
import type { Tone } from "../../components/ui/tone"

const STATUS_TONE: Record<GrievanceStatus, Tone> = {
  open: "warn",
  in_progress: "info",
  resolved: "ok",
  escalated: "bad",
}

const PRIORITY_TONE: Record<GrievancePriority, Tone> = {
  low: "neutral",
  normal: "info",
  high: "warn",
  urgent: "bad",
}

function NewGrievanceForm({ onCreated }: { onCreated: () => void }) {
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<GrievancePriority>("normal")

  const create = useMutation({
    mutationFn: () => createGrievanceTicket({ subject, description, priority }),
    onSuccess: () => {
      setSubject("")
      setDescription("")
      onCreated()
    },
  })

  return (
    <Card padded className="flex flex-col gap-2.5">
      <div className="text-[12.5px] font-semibold">Log a new grievance</div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="px-2 py-1.5 text-[12.5px] border border-border-strong rounded-control bg-page"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={2}
        className="px-2 py-1.5 text-[12.5px] border border-border-strong rounded-control bg-page"
      />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as GrievancePriority)}
        className="px-2 py-1.5 text-[12.5px] border border-border-strong rounded-control bg-page w-fit"
      >
        <option value="low">Low</option>
        <option value="normal">Normal</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
      <div>
        <Button size="sm" variant="primary" disabled={!subject || !description || create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Submitting…" : "Submit grievance"}
        </Button>
      </div>
    </Card>
  )
}

function GrievanceRow({ ticket, onChanged }: { ticket: GrievanceTicket; onChanged: () => void }) {
  const [resolution, setResolution] = useState("")
  const resolve = useMutation({ mutationFn: () => resolveGrievanceTicket(ticket.id, resolution), onSuccess: onChanged })

  return (
    <div className="py-2.5 border-b border-border-faint text-[13px] flex flex-col gap-1.5">
      <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr_1.1fr_1.9fr] gap-2.5 items-center min-w-[900px]">
        <div className="font-semibold truncate">{ticket.subject}</div>
        <div><Pill tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Pill></div>
        <div><Pill tone={STATUS_TONE[ticket.status]}>{ticket.status.replace("_", " ")}</Pill></div>
        <div className="font-mono text-[11.5px] text-ink-4">due {new Date(ticket.sla_due_at).toLocaleDateString()}</div>
        <div className="text-ink-3 truncate" title={ticket.description}>{ticket.description}</div>
      </div>
      {ticket.status !== "resolved" ? (
        <div className="flex gap-1.5">
          <input
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Resolution"
            className="flex-1 min-w-0 px-2 py-1 text-[12px] border border-border-strong rounded-control bg-page"
          />
          <Button size="sm" variant="primary" disabled={resolve.isPending} onClick={() => resolve.mutate()}>
            {resolve.isPending ? "Saving…" : "Resolve"}
          </Button>
        </div>
      ) : (
        <div className="text-[11.5px] text-ink-4">{ticket.resolution}</div>
      )}
    </div>
  )
}

export function GrievancesTab() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ["grievance-tickets"],
    queryFn: () => listGrievanceTickets(),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["grievance-tickets"] })
  const tickets = data?.results ?? []

  return (
    <div className="flex flex-col gap-3.5">
      <NewGrievanceForm onCreated={refresh} />
      <Card>
        <CardHeader>
          <div className="text-[13px] font-semibold">Grievances</div>
          <div className="text-[12px] text-ink-4">DPDP §2.5 — routed to the hospital's designated grievance officer, tracked to SLA</div>
        </CardHeader>
        <div className="px-3.5 overflow-x-auto">
          {isLoading && <LoadingState />}
          {isError && <ErrorState />}
          {!isLoading && !isError && tickets.map((t) => <GrievanceRow key={t.id} ticket={t} onChanged={refresh} />)}
          {!isLoading && !isError && tickets.length === 0 && <EmptyState message="No grievances logged yet." />}
        </div>
      </Card>
    </div>
  )
}
