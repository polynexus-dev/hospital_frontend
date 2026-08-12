import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { NeutralTag, SuccessTag } from "../../components/ui/Pill"
import { LoadingState } from "../../components/ui/QueryStates"
import { listFieldVisits, listReferralLeagueTable, listReferringDoctors } from "../../api/referrals"

export function ReferralsPage() {
  const [activeTab, setActiveTab] = useState<"league" | "directory" | "visits">("league")

  const { data: leagueData, isLoading: isLeagueLoading } = useQuery({
    queryKey: ["referrals-league"],
    queryFn: listReferralLeagueTable,
    enabled: activeTab === "league",
  })

  const { data: doctorsData, isLoading: isDoctorsLoading } = useQuery({
    queryKey: ["referral-doctors"],
    queryFn: listReferringDoctors,
    enabled: activeTab === "directory",
  })

  const { data: visitsData, isLoading: isVisitsLoading } = useQuery({
    queryKey: ["field-visits"],
    queryFn: listFieldVisits,
    enabled: activeTab === "visits",
  })

  const topDoctors = leagueData ?? []
  const allDoctors = doctorsData?.results ?? []
  const visits = visitsData?.results ?? []

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "gold":
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">🥇 GOLD TIER</span>
      case "silver":
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">🥈 SILVER TIER</span>
      default:
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-800/20 text-amber-700">🥉 BRONZE TIER</span>
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Referral Doctor CRM</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Referring doctor directory, revenue attribution league table, & field visit touchpoints
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        {[
          { key: "league", label: "Referrer League Table" },
          { key: "directory", label: "Doctor Directory" },
          { key: "visits", label: "Field Visit Logs" },
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

      {/* TAB 1: REFERRER LEAGUE TABLE */}
      {activeTab === "league" && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Top Referring Doctors (Revenue Attributed)</h2>
              <p className="text-xs text-slate-500">Ranked by total patient referral revenue generated this year</p>
            </div>
          </div>

          {isLeagueLoading ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {topDoctors.map((doc, idx) => (
                <Card key={doc.id} className="p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold text-base flex items-center justify-center">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100">{doc.name}</h3>
                        {getTierBadge(doc.tier)}
                      </div>
                      <span className="text-xs text-slate-500">{doc.speciality} • {doc.clinic_name} ({doc.city})</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{Number(doc.total_attributed_revenue || 0).toLocaleString("en-IN")}
                    </div>
                    <span className="text-xs text-slate-400">{doc.total_referrals || 0} Patient Referrals</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: DOCTOR DIRECTORY */}
      {activeTab === "directory" && (
        <Card className="overflow-hidden">
          {isDoctorsLoading ? (
            <LoadingState />
          ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-semibold">Doctor Name</th>
                  <th className="px-6 py-3 font-semibold">Clinic & City</th>
                  <th className="px-6 py-3 font-semibold">Contact</th>
                  <th className="px-6 py-3 font-semibold">Tier</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {allDoctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">
                      {doc.name}
                      <span className="block text-xs font-normal text-slate-400">{doc.speciality}</span>
                    </td>
                    <td className="px-6 py-4">{doc.clinic_name} ({doc.city})</td>
                    <td className="px-6 py-4 text-xs font-mono">{doc.mobile}</td>
                    <td className="px-6 py-4">{getTierBadge(doc.tier)}</td>
                    <td className="px-6 py-4">
                      {doc.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* TAB 3: FIELD VISITS */}
      {activeTab === "visits" && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Representative Field Visit Logs</h2>
          {isVisitsLoading ? (
            <LoadingState />
          ) : (
            <div className="space-y-3">
              {visits.map((v) => (
                <Card key={v.id} className="p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{v.referring_doctor_name}</h3>
                    <span className="text-xs text-slate-400">Visit Date: {v.visit_date}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{v.notes}</p>
                  {v.outcome && <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Outcome: {v.outcome}</p>}
                </Card>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
