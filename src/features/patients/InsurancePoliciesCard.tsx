import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, extractApiError } from "../../api/client"
import { useAuthStore } from "../../store/auth"

// Patient-linked insurance (MedNet "inactive patient insurance"): a policy
// can be made inactive with a reason; it is then hidden here and can't be
// chosen at the OPD desk or used for bills. Only users with
// finance.manage_inactive_insurance see inactive policies and reactivate them.

interface Policy {
  id: number
  insurer: string
  scheme: string
  policy_number: string
  member_id: string
  sum_insured: string
  valid_from: string | null
  valid_to: string | null
  eligibility_status: string
  is_active: boolean
  deactivated_at: string | null
  deactivated_by_name: string
  deactivation_reason: string
}

export function InsurancePoliciesCard({ patientId }: { patientId: number }) {
  const qc = useQueryClient()
  const perms = useAuthStore((s) => s.user?.permissions ?? [])
  const canSeeInactive = perms.includes("finance.manage_inactive_insurance")
  const canChange = perms.includes("finance.change_insurancepolicy")
  const canView = perms.includes("finance.view_insurancepolicy")
  const [showInactive, setShowInactive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = ["patient-insurance", patientId, showInactive]
  const q = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ results: Policy[] }>(`/finance/insurance-policies/?patient=${patientId}${showInactive ? "&include_inactive=1" : ""}`),
    enabled: canView,
  })
  const act = useMutation({
    mutationFn: ({ id, verb, reason }: { id: number; verb: "deactivate" | "activate"; reason?: string }) =>
      api.post(`/finance/insurance-policies/${id}/${verb}/`, reason ? { reason } : {}),
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: ["patient-insurance", patientId] }) },
    onError: (e) => setError(extractApiError(e)),
  })
  if (!canView) return null
  const rows = q.data?.results ?? []
  const deactivate = (p: Policy) => {
    const reason = window.prompt(`Make ${p.insurer} (${p.policy_number}) inactive? Give the reason:`)
    if (reason && reason.trim()) act.mutate({ id: p.id, verb: "deactivate", reason: reason.trim() })
  }

  return (
    <div className="rounded-xl border border-border bg-white dark:bg-slate-800 px-4 py-3" aria-label="Patient insurance">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10.5px] uppercase tracking-[.06em] font-semibold text-ink-4">Insurance</div>
        {canSeeInactive && (
          <label className="flex items-center gap-1.5 text-[12px] text-ink-4">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Include inactive
          </label>
        )}
      </div>
      {rows.length === 0 && <div className="text-[12.5px] text-ink-5">No insurance on record.</div>}
      <div className="space-y-1.5">
        {rows.map((p) => (
          <div key={p.id} className={`flex items-start justify-between gap-3 text-[12.5px] ${p.is_active ? "" : "opacity-60"}`}>
            <div>
              <div className="font-semibold">{p.insurer}{p.scheme ? ` · ${p.scheme}` : ""} {!p.is_active && <span className="ml-1 text-[11px] font-semibold text-danger-text">INACTIVE</span>}</div>
              <div className="text-ink-4">
                Policy {p.policy_number}{p.member_id ? ` · member ${p.member_id}` : ""}{p.valid_to ? ` · valid to ${p.valid_to}` : ""} · {p.eligibility_status}
              </div>
              {!p.is_active && <div className="text-[11.5px] text-ink-4">Made inactive by {p.deactivated_by_name || "—"}: {p.deactivation_reason}</div>}
            </div>
            {p.is_active && canChange && <button className="text-[12px] font-semibold text-danger-text" onClick={() => deactivate(p)}>Make inactive</button>}
            {!p.is_active && canSeeInactive && <button className="text-[12px] font-semibold text-brand" onClick={() => act.mutate({ id: p.id, verb: "activate" })}>Reactivate</button>}
          </div>
        ))}
      </div>
      {error && <div className="text-[12px] text-danger-text mt-1">{error}</div>}
    </div>
  )
}
