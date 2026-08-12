import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { StatTile } from "../../components/ui/StatTile"
import { Button } from "../../components/ui/Button"
import { NeutralTag, Pill } from "../../components/ui/Pill"
import { ErrorState, EmptyState, LoadingState } from "../../components/ui/QueryStates"
import {
  listComplaints,
  listNpsResponses,
  listServiceRecoveryTasks,
  npsByDepartment,
  resolveServiceRecoveryTask,
} from "../../api/feedback"
import type { Tone } from "../../components/ui/tone"

const TABS: { key: "nps" | "complaints" | "recovery"; label: string }[] = [
  { key: "nps", label: "NPS Responses" },
  { key: "complaints", label: "Complaints Log" },
  { key: "recovery", label: "Service Recovery Tasks" },
]

const complaintTone: Record<"open" | "investigating" | "closed", Tone> = {
  open: "warn",
  investigating: "info",
  closed: "ok",
}

const recoveryTone: Record<"pending" | "in_progress" | "resolved", Tone> = {
  pending: "warn",
  in_progress: "info",
  resolved: "ok",
}

export function FeedbackPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"nps" | "complaints" | "recovery">("nps")

  // Service recovery modal
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")

  const { data: npsData, isLoading: isNpsLoading, isError: isNpsError } = useQuery({
    queryKey: ["nps-responses"],
    queryFn: () => listNpsResponses(),
    enabled: activeTab === "nps",
  })

  const { data: complaintsData, isLoading: isComplaintsLoading } = useQuery({
    queryKey: ["complaints"],
    queryFn: () => listComplaints(),
    enabled: activeTab === "complaints",
  })

  const { data: recoveryData, isLoading: isRecoveryLoading } = useQuery({
    queryKey: ["service-recovery-tasks"],
    queryFn: () => listServiceRecoveryTasks(),
    enabled: activeTab === "recovery",
  })

  const deptQuery = useQuery({
    queryKey: ["nps-by-department"],
    queryFn: npsByDepartment,
  })

  const resolveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      resolveServiceRecoveryTask(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-recovery-tasks"] })
      setSelectedTaskId(null)
      setResolutionNotes("")
    },
  })

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTaskId || !resolutionNotes.trim()) return
    resolveMutation.mutate({ id: selectedTaskId, notes: resolutionNotes })
  }

  const npsResponses = npsData?.results ?? []
  const complaints = complaintsData?.results ?? []
  const recoveryTasks = recoveryData?.results ?? []
  const deptRows = deptQuery.data ?? []

  // Metrics
  const promoters = npsResponses.filter((r) => r.category === "promoter").length
  const detractors = npsResponses.filter((r) => r.category === "detractor").length
  const resolvedRecoveryCount = recoveryTasks.filter((t) => t.status === "resolved").length

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Promoters (9-10)" value={promoters} valueClassName="text-success" />
        <StatTile label="Detractors (0-6)" value={detractors} valueClassName="text-danger" />
        <StatTile label="Service recovery tasks" value={recoveryTasks.length} valueClassName="text-warning" />
      </div>

      <div className="grid grid-cols-2 gap-3.5 items-start">
        <Card padded>
          <div className="flex items-baseline gap-2.5 mb-3">
            <div className="text-[13px] font-semibold">Routing rules</div>
            <div className="text-[12px] text-ink-4">how each NPS response gets actioned automatically</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-control bg-brand-tint border border-brand-border p-3">
              <div className="text-[11px] tracking-[.08em] uppercase font-semibold text-brand mb-1.5">
                Promoter routing
              </div>
              <div className="text-[12.5px] text-ink-2 leading-relaxed">
                Scores of 9–10 automatically trigger a request to leave a public Google review.
              </div>
              <div className="flex items-baseline gap-1.5 mt-2.5">
                <div className="text-[22px] font-semibold text-brand tracking-[-.02em]">{promoters}</div>
                <div className="text-[11.5px] text-ink-4">promoter{promoters === 1 ? "" : "s"} this period</div>
              </div>
            </div>
            <div className="rounded-control bg-danger-bg border border-danger-border p-3">
              <div className="text-[11px] tracking-[.08em] uppercase font-semibold text-danger-text mb-1.5">
                Detractor routing
              </div>
              <div className="text-[12.5px] text-ink-2 leading-relaxed">
                Scores of 0–6 automatically open a service-recovery task with a 2-hour SLA.
              </div>
              <div className="flex items-baseline gap-1.5 mt-2.5">
                <div className="text-[22px] font-semibold text-danger-text tracking-[-.02em]">{detractors}</div>
                <div className="text-[11.5px] text-ink-4">routed to recovery · {resolvedRecoveryCount} resolved</div>
              </div>
            </div>
          </div>
        </Card>

        <Card padded>
          <div className="flex items-baseline gap-2.5 mb-3">
            <div className="text-[13px] font-semibold">NPS by department</div>
            <div className="text-[12px] text-ink-4">response volume and average score</div>
          </div>
          <div className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr_0.7fr] gap-2 pb-2 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold">
            <div>Department</div>
            <div className="text-right">Total</div>
            <div className="text-right">Prom.</div>
            <div className="text-right">Detr.</div>
            <div className="text-right">Avg</div>
          </div>
          {deptQuery.isLoading && <LoadingState />}
          {!deptQuery.isLoading &&
            deptRows.map((row) => (
              <div
                key={row.department__name ?? "unassigned"}
                className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.8fr_0.7fr] gap-2 py-2 border-b border-border-faint items-center text-[13px]"
              >
                <div className="truncate">{row.department__name ?? "Unassigned"}</div>
                <div className="text-right text-ink-3">{row.total}</div>
                <div className="text-right text-success">{row.promoters}</div>
                <div className="text-right text-danger">{row.detractors}</div>
                <div className="text-right font-semibold">{row.avg_score?.toFixed(1) ?? "—"}</div>
              </div>
            ))}
          {!deptQuery.isLoading && deptRows.length === 0 && (
            <div className="text-[13px] text-ink-4 py-2">No department data yet.</div>
          )}
        </Card>
      </div>

      <div className="flex border border-border rounded-control overflow-hidden w-fit">
        {TABS.map((tab, i) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-none whitespace-nowrap px-3.5 h-8 flex items-center text-[12.5px] font-semibold ${
              i > 0 ? "border-l border-border" : ""
            } ${activeTab === tab.key ? "bg-brand-tint text-brand" : "bg-transparent text-ink-4 hover:bg-page"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* NPS Responses */}
      {activeTab === "nps" && (
        <Card>
          <CardHeader>
            <div className="text-[13px] font-semibold">NPS responses</div>
            <div className="text-[12px] text-ink-4">patient satisfaction score submissions</div>
          </CardHeader>
          <div className="px-3.5 overflow-x-auto">
            <div className="grid grid-cols-[0.6fr_0.9fr_0.8fr_2fr_0.8fr] gap-2.5 py-2.5 border-b border-border-soft text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold min-w-[760px]">
              <div>Score</div>
              <div>Category</div>
              <div>Patient</div>
              <div>Comment</div>
              <div className="text-right">Date</div>
            </div>
            {isNpsLoading && <LoadingState />}
            {isNpsError && <ErrorState />}
            {!isNpsLoading &&
              !isNpsError &&
              npsResponses.map((res) => (
                <div
                  key={res.id}
                  className="grid grid-cols-[0.6fr_0.9fr_0.8fr_2fr_0.8fr] gap-2.5 py-2.5 border-b border-border-faint items-center text-[13px] min-w-[760px]"
                >
                  <div className="font-semibold">{res.score}/10</div>
                  <div>
                    {res.category === "promoter" ? (
                      <Pill tone="ok">Promoter</Pill>
                    ) : res.category === "detractor" ? (
                      <Pill tone="bad">Detractor</Pill>
                    ) : (
                      <NeutralTag>Passive</NeutralTag>
                    )}
                  </div>
                  <div className="text-ink-3">Patient #{res.patient}</div>
                  <div className="text-ink-3 italic truncate">
                    {res.comment ? `"${res.comment}"` : "No comment provided"}
                  </div>
                  <div className="text-right text-ink-4 text-[12px]">
                    {new Date(res.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            {!isNpsLoading && !isNpsError && npsResponses.length === 0 && (
              <EmptyState message="No NPS responses recorded yet." />
            )}
          </div>
        </Card>
      )}

      {/* Complaints Log */}
      {activeTab === "complaints" && (
        <Card>
          <CardHeader>
            <div className="text-[13px] font-semibold">Complaints log</div>
            <div className="text-[12px] text-ink-4">registered patient complaints</div>
          </CardHeader>
          <div className="px-3.5">
            {isComplaintsLoading && <LoadingState />}
            {!isComplaintsLoading && complaints.length === 0 && (
              <EmptyState message="No active complaints logged." />
            )}
            {!isComplaintsLoading &&
              complaints.map((c) => (
                <div key={c.id} className="py-3 border-b border-border-faint last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone={complaintTone[c.status]}>{c.status.toUpperCase()}</Pill>
                    <div className="text-[11.5px] text-ink-4">{new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-[13px] text-ink-2 font-medium mt-1.5">{c.description}</div>
                  {c.root_cause && (
                    <div className="text-[12px] text-ink-4 mt-1">Root cause: {c.root_cause}</div>
                  )}
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Service Recovery Tasks */}
      {activeTab === "recovery" && (
        <Card>
          <CardHeader>
            <div className="text-[13px] font-semibold">Service recovery queue</div>
            <div className="text-[12px] text-ink-4">detractor follow-ups within SLA</div>
          </CardHeader>
          <div className="px-3.5">
            {isRecoveryLoading && <LoadingState />}
            {!isRecoveryLoading && recoveryTasks.length === 0 && (
              <EmptyState message="No pending recovery tasks for detractors." />
            )}
            {!isRecoveryLoading &&
              recoveryTasks.map((t) => (
                <div key={t.id} className="py-3 border-b border-border-faint last:border-b-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-[13px] font-semibold">Recovery task #{t.id}</div>
                      <Pill tone={recoveryTone[t.status]}>{t.status.replace("_", " ").toUpperCase()}</Pill>
                    </div>
                    <div className="text-[11.5px] text-ink-4 mt-1">
                      SLA due {new Date(t.sla_due_at).toLocaleString()}
                    </div>
                    {t.resolution_notes && (
                      <div className="text-[12px] text-success mt-1">Resolution: {t.resolution_notes}</div>
                    )}
                  </div>
                  {t.status !== "resolved" && (
                    <Button size="sm" variant="primary" onClick={() => setSelectedTaskId(t.id)}>
                      Resolve task
                    </Button>
                  )}
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Resolve Modal */}
      {selectedTaskId && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTaskId(null)}
        >
          <div className="bg-surface rounded-card p-5 w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-semibold mb-1">Resolve service recovery</div>
            <div className="text-[12px] text-ink-4 mb-3">
              Describe the action taken with this detractor before marking it resolved.
            </div>
            <form onSubmit={handleResolveSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] tracking-[.06em] uppercase text-ink-4 font-semibold mb-1.5">
                  Resolution notes *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe action taken with detractor (e.g. called patient, offered free follow-up OPD)..."
                  className="w-full px-3 py-2 border border-border-strong rounded-control text-[13px]"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => setSelectedTaskId(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={resolveMutation.isPending}>
                  {resolveMutation.isPending ? "Submitting..." : "Complete Recovery"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
