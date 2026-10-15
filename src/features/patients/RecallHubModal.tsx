import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { listPatientRecalls, type RecallPatient } from "../../api/patients"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { Pill } from "../../components/ui/Pill"
import { showToast } from "../../components/ui/Toast"
import { viewRecord } from "../../store/recordViewer"

interface Props {
  open: boolean
  onClose: () => void
  onBookAppointment?: (patient: RecallPatient) => void
}

export function RecallHubModal({ open, onClose, onBookAppointment }: Props) {
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchReason, setSearchReason] = useState<string>("")

  const { data, isLoading } = useQuery({
    queryKey: ["patient-recalls", filterStatus, searchReason],
    queryFn: () => {
      const params: { status?: string; reason?: string } = {}
      if (filterStatus !== "all") params.status = filterStatus
      if (searchReason) params.reason = searchReason
      return listPatientRecalls(params)
    },
    enabled: open,
  })

  if (!open) return null

  const summary = data?.summary || { overdue: 0, due_today: 0, due_this_week: 0, total_recalls: 0 }
  const recalls = data?.results || []

  const handleWhatsApp = (patient: RecallPatient) => {
    const text = encodeURIComponent(
      `Hello ${patient.full_name}, this is a gentle health reminder from Lifecare Hospital. Your scheduled ${patient.recall_reason} is due. Please reply to this message or call us to reserve your appointment.`
    )
    window.open(`https://wa.me/${patient.mobile.replace(/[^0-9]/g, "")}?text=${text}`, "_blank")
    showToast("WhatsApp reminder opened!", "success")
  }

  const getUrgencyBadge = (urgency: RecallPatient["urgency"]) => {
    switch (urgency) {
      case "overdue":
        return <Pill tone="bad">Overdue</Pill>
      case "due_today":
        return <Pill tone="warn">Due Today</Pill>
      default:
        return <Pill tone="neutral">Upcoming</Pill>
    }
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl ring-1 ring-border dark:bg-slate-900 dark:ring-slate-800 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-faint px-6 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-ink dark:text-white flex items-center gap-2">
              <span>🩺</span> Clinical Recall & Patient Retention Hub
            </h2>
            <p className="text-xs text-ink-4 dark:text-slate-400">
              Proactively engage chronic care patients, post-surgical follow-ups, and milestone health recalls
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-chip-bg hover:text-ink-3 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3 bg-danger-bg/50 border-danger-border dark:bg-red-950/20 dark:border-red-900/40">
              <div className="text-[11px] font-semibold text-danger-text dark:text-red-400 uppercase tracking-wider">
                Overdue Recalls
              </div>
              <div className="text-xl font-bold text-danger-text dark:text-red-100 mt-0.5">
                {summary.overdue}
              </div>
              <div className="text-[10px] text-danger-text/80">Immediate attention needed</div>
            </Card>

            <Card className="p-3 bg-warning-bg/50 border-warning/30 dark:bg-amber-950/20 dark:border-amber-900/40">
              <div className="text-[11px] font-semibold text-warning-text dark:text-amber-400 uppercase tracking-wider">
                Due Today
              </div>
              <div className="text-xl font-bold text-warning-text dark:text-amber-100 mt-0.5">
                {summary.due_today}
              </div>
              <div className="text-[10px] text-warning-text/80">Scheduled for today's outreach</div>
            </Card>

            <Card className="p-3 bg-brand-tint/50 border-brand-border dark:bg-blue-950/20 dark:border-blue-900/40">
              <div className="text-[11px] font-semibold text-brand-dark dark:text-blue-400 uppercase tracking-wider">
                Due This Week
              </div>
              <div className="text-xl font-bold text-brand-dark dark:text-blue-100 mt-0.5">
                {summary.due_this_week}
              </div>
              <div className="text-[10px] text-brand/80">Upcoming 7-day pipeline</div>
            </Card>

            <Card className="p-3 bg-accent-tint/50 border-accent/25 dark:bg-teal-950/20 dark:border-teal-900/40">
              <div className="text-[11px] font-semibold text-accent-hover dark:text-teal-400 uppercase tracking-wider">
                Total Recalls
              </div>
              <div className="text-xl font-bold text-accent-hover dark:text-teal-100 mt-0.5">
                {summary.total_recalls}
              </div>
              <div className="text-[10px] text-accent/80">Active retention pool</div>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-page/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center gap-1.5">
              {["all", "overdue", "due_today", "due_this_week", "upcoming"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                    filterStatus === st
                      ? "bg-accent text-white dark:bg-teal-500"
                      : "bg-white text-ink-3 hover:bg-chip-bg dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {st === "all" ? "All" : st.replace(/_/g, " ").toUpperCase()}
                </button>
              ))}
            </div>

            <div className="w-48">
              <input
                type="text"
                placeholder="Filter by recall reason..."
                value={searchReason}
                onChange={(e) => setSearchReason(e.target.value)}
                className="w-full rounded border border-border bg-white px-2.5 py-1 text-xs focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-border dark:border-slate-800">
            {isLoading ? (
              <div className="p-8 text-center text-ink-4">Loading recall patients...</div>
            ) : recalls.length === 0 ? (
              <div className="p-8 text-center text-ink-4">
                <span>🎉</span>
                <p className="mt-1 font-semibold text-ink-2 dark:text-slate-300">No pending recalls in this view.</p>
                <p className="text-[11px] text-slate-400">All scheduled follow-ups are up to date.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-page font-semibold text-ink-3 dark:bg-slate-800/60 dark:text-slate-400 border-b border-border dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Recall Reason</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Outreach Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-faint dark:divide-slate-800">
                  {recalls.map((p) => (
                    <tr key={p.id} onClick={(ev) => viewRecord(ev, p, { subtitle: "Patient recall" })} title="Click to view details" className="hover:bg-page/50 dark:hover:bg-slate-800/30 cursor-pointer">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-ink dark:text-white">{p.full_name}</div>
                        <div className="text-[10px] font-mono text-accent dark:text-teal-400">{p.uhid || `ID: ${p.id}`}</div>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-mono text-ink-2 dark:text-slate-300">{p.mobile || "No phone"}</div>
                        <div className="text-[10px] text-slate-400">Lang: {p.preferred_language.toUpperCase()}</div>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="font-medium text-ink dark:text-slate-200">{p.recall_reason}</span>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-medium text-ink-2 dark:text-slate-300">
                          {new Date(p.next_recall_due_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">{getUrgencyBadge(p.urgency)}</td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {p.mobile && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleWhatsApp(p)}
                              title="Send WhatsApp Health Recall"
                              className="text-success-text hover:text-success-text hover:bg-success-bg dark:text-emerald-400"
                            >
                              💬 WhatsApp
                            </Button>
                          )}
                          {onBookAppointment && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                onBookAppointment(p)
                                onClose()
                              }}
                            >
                              📅 Book OPD
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-border-faint px-6 py-3 dark:border-slate-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
