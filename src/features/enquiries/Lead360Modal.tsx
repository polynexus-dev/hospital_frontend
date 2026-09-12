import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Enquiry } from "../../types/api"
import { getEnquiryHistory, addEnquiryNote, updateEnquiry } from "../../api/enquiries"
import { Button } from "../../components/ui/Button"
import { showToast } from "../../components/ui/Toast"
import { PrintableOPDSlipModal } from "./PrintableOPDSlipModal"

interface Props {
  enquiry: Enquiry
  onClose: () => void
  ownerName: string | null
}

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

export function Lead360Modal({ enquiry, onClose, ownerName }: Props) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "marketing" | "estimates">("overview")
  const [newNote, setNewNote] = useState("")
  const [followUpDate, setFollowUpDate] = useState(enquiry.follow_up_date || "")
  const [showOpdSlipModal, setShowOpdSlipModal] = useState(false)

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["enquiry-history", enquiry.id],
    queryFn: () => getEnquiryHistory(enquiry.id),
  })

  const addNoteMutation = useMutation({
    mutationFn: (note: string) => addEnquiryNote(enquiry.id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      setNewNote("")
      showToast("Internal note appended successfully", "success")
    },
    onError: () => {
      showToast("Failed to add note", "error")
    },
  })

  const updateFollowUpMutation = useMutation({
    mutationFn: (date: string | null) => updateEnquiry(enquiry.id, { follow_up_date: date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      showToast("Callback date updated", "success")
    },
    onError: () => {
      showToast("Failed to update callback date", "error")
    },
  })

  const stageColors: Record<string, string> = {
    new: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    contacted: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    scheduled: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
    visited: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    follow_up: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800",
    lost: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
  }

  const slaBreached = enquiry.sla_due_at && new Date(enquiry.sla_due_at).getTime() < Date.now()

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-surface border border-border-strong rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-border bg-page/50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-ink">{enquiry.name}</h2>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${stageColors[enquiry.stage] || ""}`}>
                  {enquiry.stage.toUpperCase()}
                </span>
                {enquiry.urgency !== "normal" && (
                  <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                    {enquiry.urgency.toUpperCase()}
                  </span>
                )}
                {enquiry.patient && (
                  <span className="px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                    ✓ Patient #{enquiry.patient}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-3 flex-wrap">
                <a href={`tel:${enquiry.mobile}`} className="font-mono text-brand hover:underline">
                  📞 {enquiry.mobile}
                </a>
                {enquiry.email && <span>✉️ {enquiry.email}</span>}
                {enquiry.consulting_doctor_name && (
                  <span className="font-semibold text-teal-700 dark:text-teal-300">
                    🩺 Dr. {enquiry.consulting_doctor_name.replace(/^Dr\.?\s*/i, "")}
                  </span>
                )}
                {ownerName && <span className="text-ink-4">👤 Owner: {ownerName}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowOpdSlipModal(true)}
                className="px-2.5 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded flex items-center gap-1.5 shadow-xs transition"
                title="Generate and print official OPD consultation token"
              >
                <span>🖨️</span>
                <span>OPD Slip</span>
              </button>
              <button onClick={onClose} className="text-ink-4 hover:text-ink text-base p-1">✕</button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-border/70 text-xs">
            <div className="bg-surface p-2 rounded border border-border">
              <span className="text-[10.5px] text-ink-4 block">Est. Revenue</span>
              <span className="font-bold text-ink text-[13px]">
                {enquiry.estimated_value ? INR.format(Number(enquiry.estimated_value)) : "₹0"}
              </span>
            </div>
            <div className="bg-surface p-2 rounded border border-border">
              <span className="text-[10.5px] text-ink-4 block">Lead Score</span>
              <span className="font-bold text-ink text-[13px]">{enquiry.score} / 100</span>
            </div>
            <div className="bg-surface p-2 rounded border border-border">
              <span className="text-[10.5px] text-ink-4 block">SLA Status</span>
              <span className={`font-semibold text-[11.5px] ${slaBreached ? "text-danger-text" : "text-emerald-600"}`}>
                {slaBreached ? "🚨 SLA Breached" : "✓ Within SLA"}
              </span>
            </div>
            <div className="bg-surface p-2 rounded border border-border">
              <span className="text-[10.5px] text-ink-4 block">Callback Date</span>
              <span className="font-bold text-teal-700 dark:text-teal-300 text-[11.5px]">
                {enquiry.follow_up_date || "Not Scheduled"}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-surface px-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === "overview" ? "border-brand text-brand" : "border-transparent text-ink-4 hover:text-ink"
            }`}
          >
            📋 Overview & Notes
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "timeline" ? "border-brand text-brand" : "border-transparent text-ink-4 hover:text-ink"
            }`}
          >
            ⏱️ Audit Timeline ({(history?.stage_changes.length || 0) + (history?.assignment_changes.length || 0)})
          </button>
          <button
            onClick={() => setActiveTab("marketing")}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === "marketing" ? "border-brand text-brand" : "border-transparent text-ink-4 hover:text-ink"
            }`}
          >
            🎯 Marketing & Attribution
          </button>
          <button
            onClick={() => setActiveTab("estimates")}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "estimates" ? "border-brand text-brand" : "border-transparent text-ink-4 hover:text-ink"
            }`}
          >
            🏥 Surgical Estimates ({history?.estimates.length || 0})
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* ⭐ Google Review Booster Banner for Completed Leads */}
              {enquiry.stage === "completed" && (
                <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block flex items-center gap-1">
                      <span>⭐</span> Patient Visit Completed — Request 5-Star Google Review
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Happy patients are 7x more likely to leave a 5-star Google rating if asked within 24 hours
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      const text = encodeURIComponent(
                        `Dear ${enquiry.name}, thank you for visiting us for ${enquiry.service_requested || "your consultation"}! We hope you had a comfortable experience. Would you mind taking 30 seconds to share your review on Google Maps to help others in our community? https://g.page/polynexus-hospital/review`
                      )
                      window.open(`https://wa.me/${enquiry.mobile.replace(/[^0-9]/g, "")}?text=${text}`, "_blank")
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shrink-0 font-bold"
                  >
                    <span>💬</span> Send via WhatsApp
                  </Button>
                </div>
              )}

              {/* Scheduled Callback Setter */}
              <div className="bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-xs font-bold text-teal-900 dark:text-teal-200 block">
                      ⏰ Next Callback / Follow-up Schedule
                    </span>
                    <span className="text-[11px] text-teal-700 dark:text-teal-400">
                      Set a callback date for the tele-calling team
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="h-8 px-2 border border-teal-300 dark:border-teal-700 rounded text-xs bg-surface"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={updateFollowUpMutation.isPending || followUpDate === enquiry.follow_up_date}
                      onClick={() => updateFollowUpMutation.mutate(followUpDate || null)}
                    >
                      Save Date
                    </Button>
                  </div>
                </div>
              </div>

              {/* Service & Clinical Details */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-page p-3 rounded-lg border border-border">
                <div>
                  <span className="text-ink-4 block text-[11px]">Service Requested:</span>
                  <span className="font-semibold text-ink">{enquiry.service_requested || "General Consultation"}</span>
                </div>
                <div>
                  <span className="text-ink-4 block text-[11px]">Primary Source:</span>
                  <span className="font-semibold text-ink capitalize">{enquiry.source}</span>
                </div>
                {enquiry.lost_reason && (
                  <div className="col-span-2 text-rose-700 bg-rose-50 dark:bg-rose-950/40 p-2 rounded border border-rose-200">
                    <span className="font-bold">Lost Reason: </span> {enquiry.lost_reason} — {enquiry.lost_notes}
                  </div>
                )}
              </div>

              {/* Internal Notes History */}
              <div>
                <label className="text-xs font-bold text-ink block mb-1.5">📝 Coordinator Notes & Call Log</label>
                <div className="bg-page border border-border rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs font-mono text-ink-2 leading-relaxed">
                  {enquiry.notes ? enquiry.notes : <span className="text-ink-5 italic">No notes logged yet.</span>}
                </div>
              </div>

              {/* Add New Note */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-3 block">Add Note / Call Outcome</label>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="e.g. Spoke with patient. Family requested Sunday morning slot with Dr. Sharma..."
                    className="flex-1 p-2 border border-border-strong rounded-control text-xs bg-page focus:outline-hidden focus:border-brand"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={addNoteMutation.isPending || !newNote.trim()}
                    onClick={() => addNoteMutation.mutate(newNote)}
                    className="self-end"
                  >
                    {addNoteMutation.isPending ? "Adding…" : "Add Note"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="space-y-4">
              {historyLoading ? (
                <div className="text-xs text-ink-4 text-center py-6">Loading audit trail…</div>
              ) : (
                <>
                  <div>
                    <h4 className="text-xs font-bold text-ink mb-2">Stage Progression History</h4>
                    {(history?.stage_changes.length || 0) === 0 ? (
                      <div className="text-xs text-ink-5 p-2 bg-page rounded border border-border">
                        Created directly in <strong>{enquiry.stage}</strong> stage.
                      </div>
                    ) : (
                      <div className="space-y-2 border-l-2 border-border ml-2 pl-3">
                        {history?.stage_changes.map((sc) => (
                          <div key={sc.id} className="relative text-xs">
                            <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-brand" />
                            <div className="font-semibold text-ink">
                              Moved: <span className="capitalize">{sc.from_stage || "New"}</span> → <span className="capitalize font-bold text-brand">{sc.to_stage}</span>
                            </div>
                            <div className="text-[11px] text-ink-4">
                              By {sc.changed_by_name || "System"} on {new Date(sc.created_at).toLocaleString("en-IN")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border">
                    <h4 className="text-xs font-bold text-ink mb-2">Lead Ownership Changes</h4>
                    {(history?.assignment_changes.length || 0) === 0 ? (
                      <div className="text-xs text-ink-5 p-2 bg-page rounded border border-border">
                        Initially assigned to <strong>{ownerName || "Unassigned"}</strong> (no subsequent reassignments).
                      </div>
                    ) : (
                      <div className="space-y-2 border-l-2 border-border ml-2 pl-3">
                        {history?.assignment_changes.map((ac) => (
                          <div key={ac.id} className="relative text-xs">
                            <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-teal-500" />
                            <div className="font-semibold text-ink">
                              Reassigned: <span>{ac.from_owner_name || "Unassigned"}</span> → <span className="font-bold text-teal-700 dark:text-teal-300">{ac.to_owner_name}</span>
                            </div>
                            {ac.reason && <div className="text-[11px] text-ink-3 italic">Reason: {ac.reason}</div>}
                            <div className="text-[11px] text-ink-4">
                              By {ac.changed_by_name || "System"} on {new Date(ac.created_at).toLocaleString("en-IN")}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "marketing" && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-page p-3 rounded-lg border border-border">
                <div>
                  <span className="text-[11px] text-ink-4 block">Campaign</span>
                  <span className="font-semibold text-ink">{enquiry.campaign || "Direct / Unspecified"}</span>
                </div>
                <div>
                  <span className="text-[11px] text-ink-4 block">UTM Source</span>
                  <span className="font-semibold text-ink">{enquiry.utm_source || "—"}</span>
                </div>
                <div>
                  <span className="text-[11px] text-ink-4 block">UTM Medium</span>
                  <span className="font-semibold text-ink">{enquiry.utm_medium || "—"}</span>
                </div>
                <div>
                  <span className="text-[11px] text-ink-4 block">UTM Campaign</span>
                  <span className="font-semibold text-ink">{enquiry.utm_campaign || "—"}</span>
                </div>
                <div>
                  <span className="text-[11px] text-ink-4 block">UTM Term</span>
                  <span className="font-semibold text-ink">{enquiry.utm_term || "—"}</span>
                </div>
                <div>
                  <span className="text-[11px] text-ink-4 block">UTM Content</span>
                  <span className="font-semibold text-ink">{enquiry.utm_content || "—"}</span>
                </div>
              </div>

              {enquiry.landing_page && (
                <div className="bg-page p-3 rounded-lg border border-border">
                  <span className="text-[11px] text-ink-4 block">Landing Page URL</span>
                  <a href={enquiry.landing_page} target="_blank" rel="noreferrer" className="text-brand hover:underline font-mono text-[11px] break-all">
                    {enquiry.landing_page}
                  </a>
                </div>
              )}

              {enquiry.referrer_url && (
                <div className="bg-page p-3 rounded-lg border border-border">
                  <span className="text-[11px] text-ink-4 block">Referrer URL</span>
                  <span className="font-mono text-[11px] text-ink-3 break-all">{enquiry.referrer_url}</span>
                </div>
              )}

              <div className="text-[11px] text-ink-4">
                Created: {new Date(enquiry.created_at).toLocaleString("en-IN")} · Last Updated: {new Date(enquiry.updated_at).toLocaleString("en-IN")}
              </div>
            </div>
          )}

          {activeTab === "estimates" && (
            <div className="space-y-3">
              {(history?.estimates.length || 0) === 0 ? (
                <div className="text-center py-8 text-xs text-ink-4">
                  No surgical or IPD estimates generated for this lead yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {history?.estimates.map((est) => (
                    <div key={est.id} className="bg-page p-3 rounded-lg border border-border flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-xs text-ink">{est.procedure_name}</div>
                        <div className="text-[11px] text-ink-4 mt-0.5">
                          Room: {est.room_category} · Mode: {est.payment_mode} · Status: <span className="font-semibold text-brand">{est.stage}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-xs text-ink">{INR.format(Number(est.total_estimate))}</div>
                        <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-surface border border-border font-mono">
                          {est.insurance_preauth_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-page/30 flex justify-between items-center text-xs">
          <div className="text-ink-4">Lead ID: #{enquiry.id}</div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {showOpdSlipModal && (
        <PrintableOPDSlipModal
          enquiry={enquiry}
          onClose={() => setShowOpdSlipModal(false)}
        />
      )}
    </div>
  )
}
