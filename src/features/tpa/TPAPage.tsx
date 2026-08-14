import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { NeutralTag, SuccessTag } from "../../components/ui/Pill"
import { LoadingState } from "../../components/ui/QueryStates"
import { listPreAuthRequests, listTPACompanies, listClaims, updateClaim } from "../../api/tpa"
import type { Claim } from "../../api/tpa"

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

function ClaimStatusBadge({ status }: { status: Claim["status"] }) {
  switch (status) {
    case "settled":
      return <SuccessTag>SETTLED</SuccessTag>
    case "partially_settled":
      return <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">PARTIALLY SETTLED</span>
    case "under_review":
      return <span className="px-2 py-0.5 text-xs font-bold rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-200">UNDER REVIEW</span>
    case "rejected":
      return <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200">REJECTED</span>
    default:
      return <NeutralTag>SUBMITTED</NeutralTag>
  }
}

function SettleClaimRow({ claim }: { claim: Claim }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [settledAmount, setSettledAmount] = useState(String(claim.settled_amount))

  const settle = useMutation({
    mutationFn: (status: Claim["status"]) => updateClaim(claim.id, { status, settled_amount: Number(settledAmount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tpa-claims"] })
      setIsEditing(false)
    },
  })

  if (!isEditing) {
    return (
      <button onClick={() => setIsEditing(true)} className="text-[11.5px] font-semibold text-brand hover:underline">
        Settle
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={settledAmount}
        onChange={(e) => setSettledAmount(e.target.value)}
        className="w-24 h-7 px-2 border border-border-strong rounded-control text-xs font-mono"
      />
      <Button size="sm" variant="primary" onClick={() => settle.mutate("partially_settled")} disabled={settle.isPending}>
        Partial
      </Button>
      <Button size="sm" variant="primary" onClick={() => settle.mutate("settled")} disabled={settle.isPending}>
        Full
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)}>
        ✕
      </Button>
    </div>
  )
}

export function TPAPage() {
  const [activeTab, setActiveTab] = useState<"desk" | "claims" | "directory">("desk")

  const { data: claimsData, isLoading: isClaimsLoading } = useQuery({
    queryKey: ["preauth-claims"],
    queryFn: listPreAuthRequests,
    enabled: activeTab === "desk",
  })

  const { data: tpaClaimsData, isLoading: isTpaClaimsLoading } = useQuery({
    queryKey: ["tpa-claims"],
    queryFn: listClaims,
    enabled: activeTab === "claims",
  })

  const { data: tpaData, isLoading: isTpaLoading } = useQuery({
    queryKey: ["tpa-companies"],
    queryFn: listTPACompanies,
    enabled: activeTab === "directory",
  })

  const claims = claimsData?.results ?? []
  const tpaClaims = tpaClaimsData?.results ?? []
  const tpas = tpaData?.results ?? []

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <SuccessTag>APPROVED</SuccessTag>
      case "query_raised":
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">QUERY RAISED</span>
      case "rejected":
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200">REJECTED</span>
      default:
        return <NeutralTag>SUBMITTED</NeutralTag>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">TPA & Pre-Authorization Desk</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Insurance directory, pre-authorization claim tracking, TAT turnaround timers, & document checklist
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        {[
          { key: "desk", label: "Pre-Auth Claims Desk" },
          { key: "claims", label: "Settlement Tracker" },
          { key: "directory", label: "Insurer & TPA Directory" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: CLAIMS DESK */}
      {activeTab === "desk" && (
        <Card className="overflow-hidden">
          {isClaimsLoading ? (
            <LoadingState />
          ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-semibold">Claim ID & Patient</th>
                  <th className="px-6 py-3 font-semibold">TPA Insurer</th>
                  <th className="px-6 py-3 font-semibold">Policy No.</th>
                  <th className="px-6 py-3 font-semibold">Claimed / Approved</th>
                  <th className="px-6 py-3 font-semibold">Checklist</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {claims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">
                      PreAuth #{c.id}
                      <span className="block text-xs font-normal text-slate-500">{c.patient_name}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold">{c.tpa_name}</td>
                    <td className="px-6 py-4 text-xs font-mono">{c.policy_number}</td>
                    <td className="px-6 py-4 text-xs font-mono">
                      <span className="block text-slate-400">Claimed: ₹{Number(c.claim_amount).toLocaleString("en-IN")}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Approved: ₹{Number(c.approved_amount).toLocaleString("en-IN")}</span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {Object.keys(c.checklist || {}).length > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Verified Docs</span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(c.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* TAB 2: SETTLEMENT TRACKER */}
      {activeTab === "claims" && (
        <Card className="overflow-hidden">
          {isTpaClaimsLoading ? (
            <LoadingState />
          ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-semibold">Claim # & Patient</th>
                  <th className="px-6 py-3 font-semibold">TPA Insurer</th>
                  <th className="px-6 py-3 font-semibold">Billed / Settled</th>
                  <th className="px-6 py-3 font-semibold">Outstanding</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {tpaClaims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">
                      {c.claim_number || `Claim #${c.id}`}
                      <span className="block text-xs font-normal text-slate-500">{c.patient_name}</span>
                    </td>
                    <td className="px-6 py-4 font-semibold">{c.tpa_name}</td>
                    <td className="px-6 py-4 text-xs font-mono">
                      <span className="block text-slate-400">Billed: {INR.format(Number(c.billed_amount))}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Settled: {INR.format(Number(c.settled_amount))}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                      {INR.format(Number(c.outstanding_amount))}
                    </td>
                    <td className="px-6 py-4"><ClaimStatusBadge status={c.status} /></td>
                    <td className="px-6 py-4">
                      {c.status !== "settled" && c.status !== "rejected" && <SettleClaimRow claim={c} />}
                    </td>
                  </tr>
                ))}
                {tpaClaims.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No claims submitted yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* TAB 3: DIRECTORY */}
      {activeTab === "directory" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isTpaLoading ? (
            <LoadingState />
          ) : (
            tpas.map((tpa) => (
              <Card key={tpa.id} className="p-6 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tpa.code}</span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tpa.name}</h3>
                  </div>
                  <SuccessTag>{tpa.avg_tat_days} DAYS AVG TAT</SuccessTag>
                </div>

                <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
                  <p>Contact Officer: <span className="font-semibold text-slate-700 dark:text-slate-200">{tpa.contact_person || "desk"}</span></p>
                  <p>Desk Phone: <span className="font-mono text-slate-700 dark:text-slate-200">{tpa.phone}</span></p>
                  <p>Pre-Auth Email: <span className="font-mono text-emerald-600 dark:text-emerald-400">{tpa.claim_submission_email || tpa.email}</span></p>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
