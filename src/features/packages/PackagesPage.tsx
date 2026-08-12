import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { NeutralTag, SuccessTag } from "../../components/ui/Pill"
import { LoadingState } from "../../components/ui/QueryStates"
import { listCampRegistrations, listCampaigns, listHealthPackages } from "../../api/packages"

export function PackagesPage() {
  const [activeTab, setActiveTab] = useState<"catalog" | "campaigns" | "funnel">("catalog")

  const { data: packagesData, isLoading: isPackagesLoading } = useQuery({
    queryKey: ["health-packages"],
    queryFn: listHealthPackages,
    enabled: activeTab === "catalog",
  })

  const { data: campaignsData, isLoading: isCampaignsLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: listCampaigns,
    enabled: activeTab === "campaigns",
  })

  const { data: registrationsData, isLoading: isRegistrationsLoading } = useQuery({
    queryKey: ["camp-registrations"],
    queryFn: listCampRegistrations,
    enabled: activeTab === "funnel",
  })

  const packages = packagesData?.results ?? []
  const campaigns = campaignsData?.results ?? []
  const registrations = registrationsData?.results ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Packages, Camps & Campaigns</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Health package catalogue, campaign ROI tracking, & camp conversion funnels
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        {[
          { key: "catalog", label: "Package Catalogue" },
          { key: "campaigns", label: "Campaign ROI Tracker" },
          { key: "funnel", label: "Camp Funnel" },
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

      {/* TAB 1: CATALOGUE */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          {isPackagesLoading ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map((pkg) => (
                <Card key={pkg.id} className="p-6 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{pkg.code}</span>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{pkg.name}</h3>
                    </div>
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{Number(pkg.price).toLocaleString("en-IN")}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400">{pkg.description}</p>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-400">Included Diagnostic Tests:</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(pkg.included_tests || []).map((t, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 rounded font-medium text-slate-700 dark:text-slate-300">
                          ✓ {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CAMPAIGN ROI TRACKER */}
      {activeTab === "campaigns" && (
        <Card className="overflow-hidden">
          {isCampaignsLoading ? (
            <LoadingState />
          ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 font-semibold">Campaign Name</th>
                  <th className="px-6 py-3 font-semibold">Type</th>
                  <th className="px-6 py-3 font-semibold">Budget vs Spend</th>
                  <th className="px-6 py-3 font-semibold">Registrations</th>
                  <th className="px-6 py-3 font-semibold">Revenue Generated</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{c.name}</td>
                    <td className="px-6 py-4 text-xs uppercase font-semibold">{c.campaign_type}</td>
                    <td className="px-6 py-4 text-xs font-mono">
                      ₹{Number(c.actual_spend).toLocaleString("en-IN")} / ₹{Number(c.budget).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4 font-semibold">{c.total_registrations || 0} Patients</td>
                    <td className="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{Number(c.total_revenue_generated || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-4">
                      {c.status === "active" ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>{c.status.toUpperCase()}</NeutralTag>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* TAB 3: CAMP FUNNEL */}
      {activeTab === "funnel" && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Camp Conversion Funnel (Registered ➔ Attended ➔ OPD ➔ IPD)</h2>
          {isRegistrationsLoading ? (
            <LoadingState />
          ) : (
            <div className="space-y-3">
              {registrations.map((r) => (
                <Card key={r.id} className="p-4 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100">{r.patient_name}</h3>
                    <span className="text-xs text-slate-500">Mobile: {r.mobile} • Campaign: {r.campaign_name}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200">
                      {r.stage.toUpperCase().replace("_", " ")}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      ₹{Number(r.revenue_generated).toLocaleString("en-IN")}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
