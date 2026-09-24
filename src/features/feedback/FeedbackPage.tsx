import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { StatTile } from "../../components/ui/StatTile"
import { Button } from "../../components/ui/Button"
import { NeutralTag, Pill } from "../../components/ui/Pill"
import { ErrorState, EmptyState, LoadingState } from "../../components/ui/QueryStates"
import {
  getReputationSummary,
  listComplaints,
  listNpsResponses,
  listServiceRecoveryTasks,
  npsByDepartment,
  resolveServiceRecoveryTask,
  sendGoogleReviewPrompt,
  updateGoogleReviewUrl,
} from "../../api/feedback"
import { showToast } from "../../components/ui/Toast"
import type { Tone } from "../../components/ui/tone"

const TABS: { key: "nps" | "reputation" | "complaints" | "recovery"; label: string }[] = [
  { key: "nps", label: "NPS Responses" },
  { key: "reputation", label: "⭐ Google Review Booster" },
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
  const [activeTab, setActiveTab] = useState<"nps" | "reputation" | "complaints" | "recovery">("nps")

  // Service recovery modal
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")

  // Google Review Booster
  const [googleUrl, setGoogleUrl] = useState("")
  const [isEditingGoogleUrl, setIsEditingGoogleUrl] = useState(false)
  const [sendingPromptId, setSendingPromptId] = useState<number | null>(null)

  const { data: reputationData } = useQuery({
    queryKey: ["reputation-summary"],
    queryFn: getReputationSummary,
  })

  const updateGoogleUrlMutation = useMutation({
    mutationFn: (url: string) => updateGoogleReviewUrl(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reputation-summary"] })
      setIsEditingGoogleUrl(false)
      showToast("Google Maps Review URL updated successfully!", "success")
    },
    onError: () => showToast("Failed to update Google review URL", "error"),
  })

  const sendPromptMutation = useMutation({
    mutationFn: (npsResponseId: number) => sendGoogleReviewPrompt(npsResponseId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["reputation-summary"] })
      showToast(res.detail, "success")
    },
    onError: () => showToast("Failed to send WhatsApp review prompt", "error"),
    onSettled: () => setSendingPromptId(null),
  })

  const { data: npsData, isLoading: isNpsLoading, isError: isNpsError } = useQuery({
    queryKey: ["nps-responses"],
    queryFn: () => listNpsResponses(),
    enabled: activeTab === "nps" || activeTab === "reputation",
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

      {/* ⭐ Google Review Booster Workspace */}
      {activeTab === "reputation" && (
        <div className="space-y-3.5">
          {/* Reputation Funnel Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Card padded>
              <div className="text-[11px] text-ink-4 uppercase tracking-wider font-semibold">Net Promoter Score</div>
              <div className="text-2xl font-extrabold text-brand mt-1">
                {reputationData?.nps_score ? `${reputationData.nps_score > 0 ? "+" : ""}${reputationData.nps_score}` : "0"}
              </div>
              <div className="text-[11px] text-success font-semibold mt-1">★ World-Class Experience</div>
            </Card>
            <Card padded>
              <div className="text-[11px] text-ink-4 uppercase tracking-wider font-semibold">Promoters (NPS 9–10)</div>
              <div className="text-2xl font-extrabold text-success mt-1">
                {reputationData?.promoters_count ?? 0}
              </div>
              <div className="text-[11px] text-ink-4 mt-1">Eligible for 5-star reviews</div>
            </Card>
            <Card padded>
              <div className="text-[11px] text-ink-4 uppercase tracking-wider font-semibold">WhatsApp Prompts Sent</div>
              <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">
                {reputationData?.prompts_sent_count ?? 0}
              </div>
              <div className="text-[11px] text-ink-4 mt-1">Direct review requests</div>
            </Card>
            <Card padded>
              <div className="text-[11px] text-ink-4 uppercase tracking-wider font-semibold">Reputation Target</div>
              <div className="text-2xl font-extrabold text-amber-500 mt-1">4.8 ★</div>
              <div className="text-[11px] text-ink-4 mt-1">Google Maps benchmark</div>
            </Card>
          </div>

          {/* Google Place URL Configuration */}
          <Card padded>
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-1.5">
                  <span>📍</span> Hospital Google Business Profile & Maps Link
                </h3>
                <p className="text-xs text-ink-4 mt-0.5">
                  This review link is automatically dispatched via WhatsApp to happy patients and NPS promoters.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const url = reputationData?.google_review_url || "https://maps.google.com"
                    window.open(url, "_blank")
                  }}
                  className="border border-border text-xs"
                >
                  🔗 Test Review Link
                </Button>
                {!isEditingGoogleUrl ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setGoogleUrl(reputationData?.google_review_url || "")
                      setIsEditingGoogleUrl(true)
                    }}
                  >
                    Edit URL
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="url"
                      value={googleUrl}
                      onChange={(e) => setGoogleUrl(e.target.value)}
                      placeholder="https://g.page/r/.../review"
                      className="h-8 px-2.5 border border-brand rounded text-xs w-72 bg-page"
                    />
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={updateGoogleUrlMutation.isPending || !googleUrl.trim()}
                      onClick={() => updateGoogleUrlMutation.mutate(googleUrl)}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditingGoogleUrl(false)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {!isEditingGoogleUrl && (
              <div className="pt-2.5 text-xs font-mono text-brand truncate">
                {reputationData?.google_review_url || "https://g.page/polynexus-hospital/review"}
              </div>
            )}
          </Card>

          {/* Promoters List & Dispatch Queue */}
          <Card>
            <CardHeader>
              <div>
                <div className="text-[13px] font-semibold">Promoters Review Queue (NPS 9–10)</div>
                <div className="text-[12px] text-ink-4">Patients who rated 9 or 10 — prime candidates for 5-star Google reviews</div>
              </div>
            </CardHeader>
            <div className="px-3.5 pb-3.5">
              {isNpsLoading && <LoadingState />}
              {!isNpsLoading && npsResponses.filter((r) => r.category === "promoter").length === 0 && (
                <EmptyState message="No promoters recorded yet. Once patients score 9 or 10, they appear here." />
              )}
              {!isNpsLoading &&
                npsResponses
                  .filter((r) => r.category === "promoter")
                  .map((res) => (
                    <div
                      key={res.id}
                      className="py-3 border-b border-border-faint last:border-b-0 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">{(res as any).patient_name || `Patient #${res.patient}`}</span>
                          <span className="px-1.5 py-0.5 rounded font-bold text-[11px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            {res.score}/10 Promoter
                          </span>
                          {(res as any).doctor_name && (
                            <span className="text-teal-700 dark:text-teal-300 font-semibold">
                              🩺 Dr. {(res as any).doctor_name.replace(/^Dr\.?\s*/i, "")}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-4 font-mono">
                          {(res as any).patient_mobile || "Mobile not listed"} · Reviewed on {new Date(res.created_at).toLocaleDateString("en-IN")}
                        </div>
                        {res.comment && (
                          <div className="text-ink-3 italic mt-1 bg-page/70 p-1.5 rounded border border-border/60 max-w-lg">
                            "{res.comment}"
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={sendPromptMutation.isPending && sendingPromptId === res.id}
                          onClick={() => {
                            setSendingPromptId(res.id)
                            sendPromptMutation.mutate(res.id)
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                        >
                          <span>⭐</span>
                          {sendPromptMutation.isPending && sendingPromptId === res.id ? "Sending…" : "Send WhatsApp Review Link"}
                        </Button>
                      </div>
                    </div>
                  ))}
            </div>
          </Card>
        </div>
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
