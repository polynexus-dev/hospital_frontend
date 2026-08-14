import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { NeutralTag, SuccessTag } from "../../components/ui/Pill"
import { LoadingState } from "../../components/ui/QueryStates"
import {
  listCampRegistrations,
  listCampaigns,
  listCorporateClients,
  listHealthPackages,
  createCorporateClient,
} from "../../api/packages"
import type { CorporateClient } from "../../api/packages"

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
const PCT = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`

function NewCorporateClientForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [employeeCount, setEmployeeCount] = useState("")
  const [contractStart, setContractStart] = useState(new Date().toISOString().slice(0, 10))

  const create = useMutation({
    mutationFn: () =>
      createCorporateClient({
        name,
        contact_person: contactPerson,
        contact_phone: contactPhone,
        employee_count: employeeCount ? Number(employeeCount) : 0,
        contract_start: contractStart,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corporate-clients"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-card p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold mb-3">New corporate client</div>
        <div className="flex flex-col gap-2.5">
          <input placeholder="Company name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px]" />
          <input placeholder="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px]" />
          <input placeholder="Contact phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px] font-mono" />
          <input placeholder="Employee count" type="number" value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px] font-mono" />
          <label className="text-[11px] text-slate-500">Contract start</label>
          <input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px]" />
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => create.mutate()} disabled={!name || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PackagesPage() {
  const [activeTab, setActiveTab] = useState<"catalog" | "campaigns" | "funnel" | "corporate">("catalog")
  const [showNewCorporate, setShowNewCorporate] = useState(false)

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

  const { data: corporateData, isLoading: isCorporateLoading } = useQuery({
    queryKey: ["corporate-clients"],
    queryFn: listCorporateClients,
    enabled: activeTab === "corporate",
  })

  const packages = packagesData?.results ?? []
  const campaigns = campaignsData?.results ?? []
  const registrations = registrationsData?.results ?? []
  const corporateClients = corporateData?.results ?? []

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
          { key: "corporate", label: "Corporate Clients" },
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
                  <th className="px-6 py-3 font-semibold">Registrations / Conversions</th>
                  <th className="px-6 py-3 font-semibold">CAC / Cost per Lead</th>
                  <th className="px-6 py-3 font-semibold">Revenue / ROI</th>
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
                    <td className="px-6 py-4 font-semibold">
                      {c.total_registrations || 0} leads
                      <span className="block text-xs font-normal text-slate-400">{c.total_conversions || 0} converted</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      {c.cost_per_lead != null ? (
                        <>
                          <span className="block">{INR.format(Number(c.cost_per_lead))}/lead</span>
                          <span className="block text-slate-400">{c.cost_per_acquisition != null ? `${INR.format(Number(c.cost_per_acquisition))}/acq.` : "—"}</span>
                        </>
                      ) : (
                        <span className="text-slate-400">No spend logged</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{Number(c.total_revenue_generated || 0).toLocaleString("en-IN")}
                      </span>
                      {c.roi_percent != null && (
                        <span className={`block text-xs font-semibold ${Number(c.roi_percent) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {PCT(Number(c.roi_percent))} ROI
                        </span>
                      )}
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

      {/* TAB 4: CORPORATE CLIENTS */}
      {activeTab === "corporate" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setShowNewCorporate(true)}>New corporate client</Button>
          </div>
          {isCorporateLoading ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {corporateClients.map((cc: CorporateClient) => (
                <Card key={cc.id} className="p-6 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{cc.name}</h3>
                      <span className="text-xs text-slate-500">{cc.employee_count} employees · {cc.billing_model.replace("_", " ")}</span>
                    </div>
                    {cc.is_active ? <SuccessTag>ACTIVE</SuccessTag> : <NeutralTag>INACTIVE</NeutralTag>}
                  </div>
                  <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400">
                    <p>Contact: <span className="font-semibold text-slate-700 dark:text-slate-200">{cc.contact_person || "—"}</span> <span className="font-mono">{cc.contact_phone}</span></p>
                    <p>Contract: <span className="font-mono text-slate-700 dark:text-slate-200">{cc.contract_start}{cc.contract_end ? ` → ${cc.contract_end}` : " (ongoing)"}</span></p>
                    {Number(cc.discount_percent) > 0 && <p>Discount: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{Number(cc.discount_percent)}%</span></p>}
                  </div>
                </Card>
              ))}
              {corporateClients.length === 0 && (
                <div className="col-span-2 text-center text-slate-400 py-8">No corporate wellness contracts yet.</div>
              )}
            </div>
          )}
          {showNewCorporate && <NewCorporateClientForm onClose={() => setShowNewCorporate(false)} />}
        </div>
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
