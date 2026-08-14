import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { ApiError } from "../../api/client"
import { createRadiologyReport, listRadiologyReports, verifyRadiologyReport, type RadiologyOrder } from "../../api/radiology"

const textareaClass = "w-full border border-border rounded-control p-2 text-[12.5px] leading-relaxed outline-none focus:border-brand"

export function RadiologyOrderDetailPanel({ order }: { order: RadiologyOrder }) {
  const queryClient = useQueryClient()
  const reportsQuery = useQuery({ queryKey: ["radiology-reports", order.id], queryFn: () => listRadiologyReports(order.id) })
  const report = reportsQuery.data?.results[0] ?? null

  const [draft, setDraft] = useState({ findings: "", impression: "" })
  const [error, setError] = useState<string | null>(null)
  const saveReportMutation = useMutation({
    mutationFn: () => createRadiologyReport({ radiology_order: order.id, ...draft }),
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ["radiology-reports", order.id] })
      queryClient.invalidateQueries({ queryKey: ["radiology-orders"] })
    },
    onError: (err: unknown) => {
      const detail = err instanceof ApiError ? (err.body as { detail?: string } | null)?.detail : undefined
      setError(detail ?? "Could not save this report.")
    },
  })

  const verifyMutation = useMutation({
    mutationFn: () => verifyRadiologyReport(report!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radiology-reports", order.id] })
      queryClient.invalidateQueries({ queryKey: ["radiology-orders"] })
    },
  })

  return (
    <div className="space-y-3">
      {report ? (
        <div className="space-y-1.5 text-[12.5px]">
          <div><span className="text-ink-5">Findings: </span>{report.findings || "—"}</div>
          <div><span className="text-ink-5">Impression: </span>{report.impression || "—"}</div>
          {report.finalized_at ? (
            <span className="text-[11px] text-success font-semibold">Verified</span>
          ) : (
            <Button size="sm" variant="primary" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
              Verify report
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {error && <div className="text-[12px] text-danger-text">{error}</div>}
          <textarea rows={2} placeholder="Findings" className={textareaClass} value={draft.findings} onChange={(e) => setDraft({ ...draft, findings: e.target.value })} />
          <textarea rows={2} placeholder="Impression" className={textareaClass} value={draft.impression} onChange={(e) => setDraft({ ...draft, impression: e.target.value })} />
          <Button size="sm" variant="secondary" onClick={() => saveReportMutation.mutate()} disabled={!draft.findings || !draft.impression || saveReportMutation.isPending}>
            Save report
          </Button>
        </div>
      )}
    </div>
  )
}
