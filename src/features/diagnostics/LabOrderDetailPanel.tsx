import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import type { Tone } from "../../components/ui/tone"
import { ApiError } from "../../api/client"
import { createLabResult, listLabResults, listLabTests, verifyLabResult, type LabOrder, type LabResultFlag } from "../../api/laboratory"

const FLAG_TONE: Record<LabResultFlag, Tone> = { normal: "ok", high: "warn", low: "warn", critical: "bad" }
const inputClass = "h-8 px-2.5 border border-border-strong rounded-control text-[12.5px]"

// The lab-order equivalent of AdmissionDetailPanel — enter results per
// ordered test, then verify (pathologist sign-off) locks them. See
// apps.laboratory.models.LabResult's docstring for why "verify" and
// "finalize" are the same transition here.
export function LabOrderDetailPanel({ order }: { order: LabOrder }) {
  const queryClient = useQueryClient()
  const isClosed = order.status === "verified"

  const testsQuery = useQuery({ queryKey: ["lab-tests"], queryFn: () => listLabTests() })
  const resultsQuery = useQuery({ queryKey: ["lab-results", order.id], queryFn: () => listLabResults(order.id) })
  const tests = testsQuery.data?.results ?? []
  const results = resultsQuery.data?.results ?? []
  const resultedTestIds = new Set(results.map((r) => r.lab_test))
  const pendingTests = tests.filter((t) => order.ordered_tests.includes(t.id) && !resultedTestIds.has(t.id))

  const [draft, setDraft] = useState({ lab_test: 0, value: "", unit: "", flag: "normal" as LabResultFlag })
  const [error, setError] = useState<string | null>(null)
  const addResultMutation = useMutation({
    mutationFn: () => createLabResult({ lab_order: order.id, ...draft }),
    onSuccess: () => {
      setDraft({ lab_test: 0, value: "", unit: "", flag: "normal" })
      setError(null)
      queryClient.invalidateQueries({ queryKey: ["lab-results", order.id] })
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] })
    },
    onError: (err: unknown) => {
      const detail = err instanceof ApiError ? (err.body as { detail?: string } | null)?.detail : undefined
      setError(detail ?? "Could not save this result.")
    },
  })

  const verifyMutation = useMutation({
    mutationFn: (id: number) => verifyLabResult(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-results", order.id] })
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] })
    },
  })

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {results.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 text-[12.5px] border border-border-soft rounded-control px-2.5 py-1.5">
            <span>
              <span className="font-semibold">{r.lab_test_name}</span>: {r.value} {r.unit}
              {r.reference_range && <span className="text-ink-5"> (ref: {r.reference_range})</span>}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Pill tone={FLAG_TONE[r.flag]}>{r.flag}</Pill>
              {r.finalized_at ? (
                <span className="text-[11px] text-success font-semibold">Verified</span>
              ) : (
                <button className="text-[11px] text-brand font-semibold" onClick={() => verifyMutation.mutate(r.id)} disabled={verifyMutation.isPending}>
                  Verify
                </button>
              )}
            </div>
          </div>
        ))}
        {results.length === 0 && <div className="text-[12.5px] text-ink-4">No results entered yet.</div>}
      </div>

      {!isClosed && pendingTests.length > 0 && (
        <div className="border-t border-border-soft pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1.5">Enter result</div>
          {error && <div className="text-[12px] text-danger-text mb-1.5">{error}</div>}
          <div className="flex flex-wrap gap-1.5">
            <select className={inputClass} value={draft.lab_test} onChange={(e) => setDraft({ ...draft, lab_test: Number(e.target.value) })}>
              <option value={0}>Select test…</option>
              {pendingTests.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input placeholder="Value" className={`${inputClass} w-24`} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
            <input placeholder="Unit" className={`${inputClass} w-20`} value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            <select className={inputClass} value={draft.flag} onChange={(e) => setDraft({ ...draft, flag: e.target.value as LabResultFlag })}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
              <option value="critical">Critical</option>
            </select>
            <Button size="sm" variant="secondary" onClick={() => addResultMutation.mutate()} disabled={!draft.lab_test || !draft.value || addResultMutation.isPending}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
