import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  listTreatmentEstimates,
  downloadTreatmentEstimatePdf,
  updateTreatmentEstimate,
  convertEstimateAdmission,
  type TreatmentEstimate,
} from "../../api/enquiries"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { Pill } from "../../components/ui/Pill"
import { showToast } from "../../components/ui/Toast"

interface Props {
  onNewEstimate: () => void
}

export function SurgicalPipelineTab({ onNewEstimate }: Props) {
  const queryClient = useQueryClient()
  const [selectedStage, setSelectedStage] = useState<string>("all")
  const [selectedPreAuth, setSelectedPreAuth] = useState<string>("all")
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ["treatment-estimates", selectedStage, selectedPreAuth],
    queryFn: () => {
      const params: Record<string, string> = {}
      if (selectedStage !== "all") params.stage = selectedStage
      if (selectedPreAuth !== "all") params.insurance_preauth_status = selectedPreAuth
      return listTreatmentEstimates(params)
    },
  })

  const estimates = data?.results || []

  // Compute Funnel Metrics
  const pipelineValue = estimates.reduce((acc, curr) => acc + (Number(curr.total_estimate) || 0), 0)
  const convertedCount = estimates.filter((e) => e.stage === "converted").length
  const preauthPendingCount = estimates.filter((e) => e.insurance_preauth_status === "submitted" || e.insurance_preauth_status === "query_raised").length
  const scheduledCount = estimates.filter((e) => e.stage === "scheduled").length

  const updateMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: TreatmentEstimate["stage"] }) =>
      updateTreatmentEstimate(id, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatment-estimates"] })
      showToast("Stage updated successfully", "success")
    },
  })

  const convertMutation = useMutation({
    mutationFn: convertEstimateAdmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treatment-estimates"] })
      showToast("Surgical estimate converted to Hospital Admission!", "success")
    },
  })

  const handleDownload = async (estimate: TreatmentEstimate) => {
    setDownloadingId(estimate.id)
    try {
      await downloadTreatmentEstimatePdf(estimate.id, estimate.procedure_name)
      showToast("Estimate PDF downloaded!", "success")
    } catch {
      showToast("Failed to download PDF", "error")
    } finally {
      setDownloadingId(null)
    }
  }

  const getStagePill = (stage: TreatmentEstimate["stage"]) => {
    switch (stage) {
      case "advised":
        return <Pill tone="neutral">Advised</Pill>
      case "counseling":
        return <Pill tone="warn">Counseling</Pill>
      case "estimate_shared":
        return <Pill tone="info">Estimate Shared</Pill>
      case "preauth_in_progress":
        return <Pill tone="warn">Pre-Auth</Pill>
      case "scheduled":
        return <Pill tone="info">OT Scheduled</Pill>
      case "converted":
        return <Pill tone="ok">Admitted</Pill>
      case "dropped":
        return <Pill tone="bad">Dropped</Pill>
      default:
        return <Pill tone="neutral">{stage}</Pill>
    }
  }


  const getPreAuthBadge = (status: TreatmentEstimate["insurance_preauth_status"], tpa?: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-success-bg px-2 py-0.5 text-[10px] font-semibold text-success-text dark:bg-emerald-900/40 dark:text-emerald-300">
            ✓ Cashless Approved ({tpa || "TPA"})
          </span>
        )
      case "submitted":
      case "query_raised":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-warning-bg px-2 py-0.5 text-[10px] font-semibold text-warning-text dark:bg-amber-900/40 dark:text-amber-300">
            ⏳ TPA In Progress ({tpa || "TPA"})
          </span>
        )
      case "denied":
        return (
          <span className="inline-flex items-center gap-1 rounded bg-danger-bg px-2 py-0.5 text-[10px] font-semibold text-danger-text dark:bg-rose-900/40 dark:text-rose-300">
            ✕ Pre-Auth Denied
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-chip-bg px-2 py-0.5 text-[10px] font-medium text-ink-3 dark:bg-slate-800 dark:text-slate-300">
            Self Pay / Direct
          </span>
        )
    }
  }

  return (
    <div className="space-y-5">
      {/* Funnel Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/50">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent-hover dark:text-teal-400">
            Total Pipeline Value
          </div>
          <div className="mt-1 text-2xl font-bold text-ink dark:text-white">
            ₹{pipelineValue.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-ink-4 dark:text-slate-400">
            {estimates.length} Surgical cases in funnel
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-brand/10 to-brand/5 border-brand-border/50">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-dark dark:text-blue-400">
            Pre-Auth In Progress
          </div>
          <div className="mt-1 text-2xl font-bold text-ink dark:text-white">
            {preauthPendingCount}
          </div>
          <div className="mt-1 text-xs text-ink-4 dark:text-slate-400">
            TPA desk review & queries
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/50">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent-hover dark:text-purple-400">
            Scheduled for Surgery
          </div>
          <div className="mt-1 text-2xl font-bold text-ink dark:text-white">
            {scheduledCount}
          </div>
          <div className="mt-1 text-xs text-ink-4 dark:text-slate-400">
            OT bookings confirmed
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-success/10 to-success/5 border-success/50">
          <div className="text-xs font-semibold uppercase tracking-wider text-success-text dark:text-emerald-400">
            Admitted / Converted
          </div>
          <div className="mt-1 text-2xl font-bold text-ink dark:text-white">
            {convertedCount}
          </div>
          <div className="mt-1 text-xs text-ink-4 dark:text-slate-400">
            Successfully admitted to IPD
          </div>
        </Card>
      </div>

      {/* Filter Bar & Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-ink-3 dark:text-slate-400">Stage:</span>
          {["all", "advised", "counseling", "estimate_shared", "preauth_in_progress", "scheduled", "converted"].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStage(st)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedStage === st
                  ? "bg-accent text-white dark:bg-teal-500"
                  : "bg-chip-bg text-ink-3 hover:bg-border-soft dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {st === "all" ? "All Stages" : st.replace(/_/g, " ").toUpperCase()}
            </button>
          ))}
          <select
            value={selectedPreAuth}
            onChange={(e) => setSelectedPreAuth(e.target.value)}
            className="rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-medium focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <option value="all">All Pre-Auth</option>
            <option value="approved">Approved</option>
            <option value="submitted">Submitted</option>
            <option value="query_raised">Query Raised</option>
            <option value="pending_docs">Pending Docs</option>
            <option value="denied">Denied</option>
            <option value="not_applicable">Cash / N/A</option>
          </select>
        </div>

        <Button size="sm" onClick={onNewEstimate}>
          + New Surgical Estimate
        </Button>
      </div>


      {/* Pipeline Estimates Table */}
      <Card className="overflow-hidden border-border dark:border-slate-800">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-ink-4">Loading surgical estimates...</div>
        ) : estimates.length === 0 ? (
          <div className="p-12 text-center text-xs text-ink-4">
            <div className="text-3xl mb-2">🏥</div>
            <p className="font-semibold text-ink-2 dark:text-slate-300">No surgical cases in this pipeline view.</p>
            <p className="mt-1 text-ink-5">Click "+ New Surgical Estimate" to counsel a patient for surgery or admission.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-page font-semibold text-ink-3 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4">Ref # & Patient</th>
                  <th className="py-3 px-4">Procedure & Doctor</th>
                  <th className="py-3 px-4">Room & Stay</th>
                  <th className="py-3 px-4">Estimate (INR)</th>
                  <th className="py-3 px-4">Insurance / Pre-Auth</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-faint dark:divide-slate-800">
                {estimates.map((item) => (
                  <tr key={item.id} className="hover:bg-page/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-bold text-ink dark:text-white">
                        {item.patient_name || "Prospective Patient"}
                      </div>
                      <div className="text-[11px] text-ink-4 dark:text-slate-400 flex items-center gap-1.5">
                        <span className="font-mono text-accent dark:text-teal-400">EST-{item.id.toString().padStart(5, "0")}</span>
                        {item.patient_mobile && <span>• {item.patient_mobile}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-ink dark:text-white">
                        {item.procedure_name}
                      </div>
                      <div className="text-[11px] text-ink-4 dark:text-slate-400">
                        {item.doctor_name || "Surgeon"} {item.department_name ? `(${item.department_name})` : ""}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="capitalize font-medium text-ink dark:text-slate-200">
                        {item.room_category.replace("_", " ")}
                      </div>
                      <div className="text-[11px] text-ink-4 dark:text-slate-400">
                        {item.stay_days} Days Expected
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-ink dark:text-white">
                        ₹{Number(item.total_estimate || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-ink-5">
                        Surgeon: ₹{Number(item.surgeon_fee || 0).toLocaleString()}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {getPreAuthBadge(item.insurance_preauth_status, item.tpa_name)}
                      {item.approved_preauth_amount && (
                        <div className="mt-0.5 text-[10px] text-success font-semibold">
                          Approved: ₹{Number(item.approved_preauth_amount).toLocaleString()}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="mb-1">{getStagePill(item.stage)}</div>
                      <select
                        value={item.stage}

                        onChange={(e) =>
                          updateMutation.mutate({ id: item.id, stage: e.target.value as any })
                        }
                        className="rounded border border-border bg-white px-2 py-1 text-xs font-medium focus:border-accent focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="advised">Advised</option>
                        <option value="counseling">Counseling</option>
                        <option value="estimate_shared">Estimate Shared</option>
                        <option value="preauth_in_progress">Pre-Auth</option>
                        <option value="scheduled">OT Scheduled</option>
                        <option value="converted">Admitted</option>
                        <option value="dropped">Dropped</option>
                      </select>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(item)}
                          disabled={downloadingId === item.id}
                          title="Download Patient Estimate PDF"
                        >
                          {downloadingId === item.id ? "..." : "📄 PDF"}
                        </Button>

                        {item.stage !== "converted" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => convertMutation.mutate(item.id)}
                            disabled={convertMutation.isPending}
                            title="Convert to Hospital Inpatient Admission"
                          >
                            ✓ Admit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
