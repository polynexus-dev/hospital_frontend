import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader } from "../../components/ui/Card"
import { StatTile } from "../../components/ui/StatTile"
import { Button } from "../../components/ui/Button"
import { NeutralTag, Pill, SuccessTag } from "../../components/ui/Pill"
import { ErrorState, EmptyState, LoadingState } from "../../components/ui/QueryStates"
import { listRoles, listUsers } from "../../api/accounts"
import { listAuditLogs } from "../../api/core"
import { listHospitals, createHospital, updateHospitalModules, toggleHospitalStatus, type Hospital } from "../../api/hospitals"
import { integrationHealth } from "../../api/integrations"
import { API_BASE_URL } from "../../api/client"
import { useAuthStore } from "../../store/auth"
import type { AuditLog } from "../../types/api"
import type { Tone } from "../../components/ui/tone"

type TabKey = "subscriptions" | "audit" | "integrations" | "users" | "roles" | "export"

const TABS: { key: TabKey; label: string }[] = [
  { key: "subscriptions", label: "🏢 Subscribed Hospital Tenants & Subscriptions" },
  { key: "audit", label: "🔒 Security Audit Trail" },
  { key: "integrations", label: "🔌 Integration Health" },
  { key: "users", label: "👥 Hospital Staff Users" },
  { key: "roles", label: "🛡️ Roles & RBAC" },
  { key: "export", label: "📦 Data Exporters" },
]

const ALL_MODULES = [
  { key: "crm", label: "CRM & OPD Lead Management", desc: "Enquiries, Patients, Appointments, Callbacks" },
  { key: "ipd", label: "IPD Inpatient Admissions", desc: "Ward, Room, Bed allocations & discharge summaries" },
  { key: "diagnostics", label: "Diagnostics (Lab & Radiology)", desc: "Lab orders, test results, radiology images" },
  { key: "pharmacy", label: "Pharmacy & Dispensing", desc: "Medicine catalog, prescriptions & inventory" },
  { key: "emergency", label: "Emergency & Triage", desc: "ED visits, triage categorization & IPD admissions" },
  { key: "ot", label: "Operation Theatre (OT)", desc: "Surgery requests, OT scheduling, operative notes & implants" },
  { key: "icu", label: "ICU Intensive Care", desc: "ICU admissions, ventilator logs & progress notes" },
  { key: "bloodbank", label: "Blood Bank", desc: "Donors, blood units, cross-matching & transfusions" },
  { key: "billing", label: "Billing & Claims", desc: "Patient invoices, itemized billing & TPA insurance claims" },
  { key: "inventory", label: "Inventory & Procurement", desc: "Item catalog, stock levels, POs & movements" },
  { key: "finance", label: "Finance", desc: "General ledger & operational expenses" },
  { key: "hr", label: "HR & Staff Roster", desc: "Employee directory, attendance & shift scheduling" },
]

const FHIR_EXPORTS = [
  { id: "patients", name: "FHIR Patient Bundle", desc: "HL7 FHIR R4 Patient JSON resources", label: "Download FHIR Patient JSON ↓" },
  { id: "appointments", name: "FHIR Appointment Bundle", desc: "HL7 FHIR R4 Appointment JSON resources", label: "Download FHIR Appointment JSON ↓" },
  { id: "all", name: "Complete FHIR Bundle", desc: "All hospital patient & visit resources", label: "Download Complete FHIR JSON ↓" },
]

const CSV_EXPORTS = [
  { id: "patients", name: "Patients Directory", desc: "All patient 360 demographics & insurance" },
  { id: "enquiries", name: "Enquiries & Leads", desc: "Pipeline leads with source attribution & SLA" },
  { id: "appointments", name: "OPD Appointments", desc: "Consultation bookings & status history" },
  { id: "calls", name: "Telephony Calls Log", desc: "Inbound/outbound call durations & outcomes" },
  { id: "messages", name: "Omnichannel Messages", desc: "Sent and received message logs" },
  { id: "feedback", name: "NPS & Complaints", desc: "NPS scores & service recovery resolutions" },
]

const ACTION_TONE: Record<AuditLog["action"], Tone> = {
  create: "ok",
  update: "info",
  delete: "bad",
  read: "neutral",
  request: "neutral",
}

function auditDetail(log: AuditLog): string {
  if (log.object_repr) return log.object_repr
  return log.object_id ? `${log.model_name} #${log.object_id}` : log.model_name
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("subscriptions")
  const [selectedHosp, setSelectedHosp] = useState<Hospital | null>(null)
  const [filterHospitalId, setFilterHospitalId] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [newHospName, setNewHospName] = useState("")
  const [newHospCity, setNewHospCity] = useState("")
  const [newHospState, setNewHospState] = useState("")
  
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: usersData, isLoading: isUsersLoading, isError: isUsersError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
    enabled: activeTab === "users",
  })

  const { data: rolesData, isLoading: isRolesLoading } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => listRoles(),
    enabled: activeTab === "roles",
  })

  const { data: hospitalsData, isLoading: isHospitalsLoading } = useQuery({
    queryKey: ["admin-hospitals"],
    queryFn: () => listHospitals(),
    enabled: activeTab === "subscriptions",
  })

  const { data: auditData, isLoading: isAuditLoading, isError: isAuditError } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () => listAuditLogs(),
    enabled: activeTab === "audit",
  })

  const { data: healthData, isLoading: isHealthLoading, isError: isHealthError } = useQuery({
    queryKey: ["admin-integration-health"],
    queryFn: () => integrationHealth(),
    enabled: activeTab === "integrations",
  })

  const updateModulesMutation = useMutation({
    mutationFn: ({ hospId, modules }: { hospId: string; modules: string[] }) => updateHospitalModules(hospId, modules),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-hospitals"] })
      setSelectedHosp(data)
      alert("Hospital module subscriptions updated successfully!")
    },
    onError: (err: any) => {
      alert("Failed to update modules: " + (err.response?.data?.error || err.message))
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: (hospId: string) => toggleHospitalStatus(hospId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-hospitals"] })
      setSelectedHosp(data)
      alert(`Hospital status changed to ${data.is_active ? 'Active' : 'Suspended'}`)
    },
    onError: (err: any) => {
      alert("Failed to toggle hospital status: " + (err.response?.data?.error || err.message))
    },
  })

  const createHospitalMutation = useMutation({
    mutationFn: (data: Partial<Hospital>) => createHospital(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hospitals"] })
      setIsAddModalOpen(false)
      setNewHospName("")
      setNewHospCity("")
      setNewHospState("")
      alert("New Hospital Tenant Onboarded Successfully!")
    },
    onError: (err: any) => {
      alert("Failed to onboard hospital: " + (err.response?.data?.error || err.message))
    },
  })

  const handleCsvExport = (modelName: string) => {
    window.open(`${API_BASE_URL}/export/${modelName}/`, "_blank")
  }

  const handleFhirExport = (resourceType: string) => {
    window.open(`${API_BASE_URL}/export/fhir/${resourceType}/`, "_blank")
  }

  const handleAddHospitalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHospName.trim()) return
    createHospitalMutation.mutate({
      name: newHospName.trim(),
      city: newHospCity.trim() || "Pune",
      state: newHospState.trim() || "Maharashtra",
      is_active: true,
      enabled_modules: ALL_MODULES.map((m) => m.key),
    })
  }

  const users = usersData?.results ?? []
  const roles = rolesData?.results ?? []
  const hospitals = Array.isArray(hospitalsData) ? hospitalsData : (hospitalsData as any)?.results ?? []
  const auditLogs = auditData?.results ?? []

  const isStubConnector = healthData?.his_connector === "stub"
  const connectorLabel = healthData ? (isStubConnector ? "Stub (not connected)" : healthData.his_connector) : "—"

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px px-3.5 py-2.5 text-[13px] font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
                : "border-transparent text-ink-4 hover:text-ink-2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="w-full flex items-center justify-between">
                <div>
                  <div className="font-bold text-[15px] text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>🏢</span> Subscribed Hospital Tenants & Module Packages
                  </div>
                  <div className="text-[12px] text-ink-4">SaaS Platform Vendor Control — View all subscribed hospital tenants, toggle module entitlements, or suspend/activate SaaS access.</div>
                </div>
                {user?.email === "saas_owner@hospital-crm.com" && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  >
                    ➕ Onboard New Hospital Branch
                  </Button>
                )}
              </div>
            </CardHeader>
            {isHospitalsLoading ? (
              <LoadingState />
            ) : (
              <div className="p-4 space-y-6">
                {/* 1. Global Platform Network Telemetry (Default View Across All Hospitals) */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4 border border-indigo-500/20">
                  <div>
                    <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">SaaS Network Telemetry (All Subscribed Branches Combined)</div>
                    <div className="text-base font-extrabold flex items-center gap-2 mt-0.5">
                      <span>⚡ Platform Aggregate Snapshot</span>
                      <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30 font-semibold">Live Real-Time</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm flex-wrap">
                    <div className="text-center">
                      <div className="text-[11px] text-indigo-300">Subscribed Tenants</div>
                      <div className="text-base font-extrabold text-white">🏢 {hospitals.length} Branches</div>
                    </div>
                    <div className="hidden sm:block border-r border-indigo-700/50 h-8"></div>
                    <div className="text-center">
                      <div className="text-[11px] text-indigo-300">Registered Patients</div>
                      <div className="text-base font-extrabold text-emerald-400">👥 {hospitals.reduce((acc: number, h: Hospital) => acc + (h.patient_count || 0), 0)}</div>
                    </div>
                    <div className="hidden sm:block border-r border-indigo-700/50 h-8"></div>
                    <div className="text-center">
                      <div className="text-[11px] text-indigo-300">OPD Appointments</div>
                      <div className="text-base font-extrabold text-cyan-300">📅 {hospitals.reduce((acc: number, h: Hospital) => acc + (h.appointment_count || 0), 0)}</div>
                    </div>
                    <div className="hidden sm:block border-r border-indigo-700/50 h-8"></div>
                    <div className="text-center">
                      <div className="text-[11px] text-indigo-300">Combined Revenue</div>
                      <div className="text-base font-extrabold text-amber-300">₹{hospitals.reduce((acc: number, h: Hospital) => acc + (h.total_revenue || 0), 0).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>

                {/* 2. Hospital Branch Filter & Live Search Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap flex-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">🔍 Search & Filter Hospitals:</span>
                    <div className="relative flex items-center flex-1 min-w-[200px] max-w-xs">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search hospital name, city, state..."
                        className="w-full text-xs px-3 py-1.5 pr-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <select
                      value={filterHospitalId}
                      onChange={(e) => {
                        const val = e.target.value
                        setFilterHospitalId(val)
                        if (val !== "all") {
                          const found = hospitals.find((h: Hospital) => h.id === val)
                          if (found) setSelectedHosp(found)
                        }
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    >
                      <option value="all">🌐 All Subscribed Hospitals ({hospitals.length} Branches)</option>
                      {hospitals.map((h: Hospital) => (
                        <option key={h.id} value={h.id}>🏢 {h.name} ({h.city})</option>
                      ))}
                    </select>
                  </div>
                  {(filterHospitalId !== "all" || searchQuery) && (
                    <button
                      onClick={() => {
                        setFilterHospitalId("all")
                        setSearchQuery("")
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/40"
                    >
                      Reset Filters & Search
                    </button>
                  )}
                </div>

                {/* 3. Hospital Cards Grid */}
                {(() => {
                  const filteredHospitals = hospitals.filter((h: Hospital) => {
                    const matchesBranch = filterHospitalId === "all" || h.id === filterHospitalId
                    const q = searchQuery.toLowerCase().trim()
                    const matchesQuery = !q || h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q) || h.state.toLowerCase().includes(q) || h.slug.toLowerCase().includes(q)
                    return matchesBranch && matchesQuery
                  })

                  if (filteredHospitals.length === 0) {
                    return (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <div className="text-2xl mb-2">🔍</div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">No Hospitals Found</div>
                        <div className="text-xs text-slate-500 mt-1">No hospital matching &quot;{searchQuery}&quot; was found. Try clearing your search query.</div>
                        <button
                          onClick={() => {
                            setFilterHospitalId("all")
                            setSearchQuery("")
                          }}
                          className="mt-3 px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          Clear Search & Show All
                        </button>
                      </div>
                    )
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {filteredHospitals.map((h: Hospital) => {
                        const isSelected = selectedHosp?.id === h.id || (!selectedHosp && h.id === user?.hospital)
                        return (
                          <div
                            key={h.id}
                            onClick={() => {
                              setSelectedHosp(h)
                              setFilterHospitalId(h.id)
                            }}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm ring-2 ring-indigo-500/20"
                                : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                            }`}
                          >
                            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center justify-between">
                              <span>{h.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleStatusMutation.mutate(h.id)
                                }}
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] transition-colors ${
                                  h.is_active ? "bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-800" : "bg-red-100 text-red-800 hover:bg-green-100 hover:text-green-800"
                                }`}
                                title="Click to toggle active/suspended status"
                              >
                                {h.is_active ? "Active ✓" : "Suspended ✗"}
                              </button>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{h.city}, {h.state}</div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                              <div>
                                <span className="text-slate-400 block text-[10px]">Registered Patients</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">👥 {h.patient_count ?? 0}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">OPD Appointments</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">📅 {h.appointment_count ?? 0}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">Billing Revenue</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{(h.total_revenue ?? 0).toLocaleString('en-IN')}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 block text-[10px]">SaaS Modules</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">📦 {(h.enabled_modules || []).length}/12</span>
                              </div>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedHosp(h)
                                setFilterHospitalId(h.id)
                              }}
                              className="w-full mt-3 py-2 px-3 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <span>⚙️</span> Manage Modules & Subscriptions
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* 4. Module Toggles Panel */}
                {(() => {
                  const targetHosp = selectedHosp || hospitals.find((h: Hospital) => h.id === user?.hospital) || hospitals[0]
                  if (!targetHosp) return null
                  const activeModules = targetHosp.enabled_modules || ALL_MODULES.map((m) => m.key)

                  const toggleModule = (modKey: string) => {
                    let next: string[]
                    if (activeModules.includes(modKey)) {
                      next = activeModules.filter((k: string) => k !== modKey)
                    } else {
                      next = [...activeModules, modKey]
                    }
                    updateModulesMutation.mutate({ hospId: targetHosp.id, modules: next })
                  }

                  return (
                    <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-3 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>📦 Module Subscriptions Package Manager:</span>
                            <span className="text-indigo-600 dark:text-indigo-400">{targetHosp.name}</span>
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">Toggle individual modules or click preset packages below to instantly update SaaS feature entitlements.</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => toggleStatusMutation.mutate(targetHosp.id)}
                            className={targetHosp.is_active ? "text-red-600 border-red-200 font-bold" : "text-green-600 border-green-200 font-bold"}
                          >
                            {targetHosp.is_active ? "Suspend Hospital SaaS" : "Activate Hospital SaaS"}
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              const allKeys = ALL_MODULES.map((m) => m.key)
                              updateModulesMutation.mutate({ hospId: targetHosp.id, modules: allKeys })
                            }}
                            className="bg-indigo-600 text-white font-bold"
                          >
                            🚀 Enable Enterprise Suite (All 12)
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {ALL_MODULES.map((mod) => {
                          const isEnabled = activeModules.includes(mod.key)
                          return (
                            <div
                              key={mod.key}
                              className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                                isEnabled
                                  ? "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10"
                                  : "border-slate-200 bg-slate-50/50 opacity-60 dark:border-slate-800"
                              }`}
                            >
                              <div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{mod.label}</div>
                                <div className="text-xs text-slate-500">{mod.desc}</div>
                              </div>
                              <button
                                onClick={() => toggleModule(mod.key)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shrink-0 ${
                                  isEnabled
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
                                }`}
                              >
                                {isEnabled ? "Enabled ✓" : "Disabled ✗"}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </Card>

          {/* Onboard New Hospital Modal */}
          {isAddModalOpen && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
              <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>🏢</span> Onboard New Hospital Branch
                  </h3>
                  <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddHospitalSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hospital Branch Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Polynexus Specialty Hospital, Wakad"
                      value={newHospName}
                      onChange={(e) => setNewHospName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-surface"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Pune"
                        value={newHospCity}
                        onChange={(e) => setNewHospCity(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-surface"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Maharashtra"
                        value={newHospState}
                        onChange={(e) => setNewHospState(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-surface"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={createHospitalMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                      {createHospitalMutation.isPending ? "Provisioning..." : "Provision Tenant"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "users" && (
        <Card>
          <CardHeader>
            <div>
              <div className="font-bold text-[14px]">Platform Users</div>
              <div className="text-[12px] text-ink-4">All registered staff, doctors, and operators in this hospital</div>
            </div>
          </CardHeader>
          {isUsersLoading ? (
            <LoadingState />
          ) : isUsersError ? (
            <ErrorState message="Failed to load users" />
          ) : users.length === 0 ? (
            <EmptyState message="No users found" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-border-soft text-ink-5 text-[11px] font-semibold uppercase">
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-page/50">
                      <td className="py-2.5 px-3 font-semibold">{u.first_name} {u.last_name}</td>
                      <td className="py-2.5 px-3 text-ink-4 font-mono text-[12px]">{u.email}</td>
                      <td className="py-2.5 px-3">{u.role_name ?? "Unassigned"}</td>
                      <td className="py-2.5 px-3">
                        {u.is_active ? <SuccessTag>Active</SuccessTag> : <NeutralTag>Inactive</NeutralTag>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === "roles" && (
        <Card>
          <CardHeader>
            <div>
              <div className="font-bold text-[14px]">Roles & RBAC Map</div>
              <div className="text-[12px] text-ink-4">Defined roles and permissions for your hospital tenant</div>
            </div>
          </CardHeader>
          {isRolesLoading ? (
            <LoadingState />
          ) : roles.length === 0 ? (
            <EmptyState message="No roles configured" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-border-soft text-ink-5 text-[11px] font-semibold uppercase">
                    <th className="py-2 px-3">Role Name</th>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {roles.map((r) => (
                    <tr key={r.id} className="hover:bg-page/50">
                      <td className="py-2.5 px-3 font-semibold">{r.name}</td>
                      <td className="py-2.5 px-3 text-ink-4">{r.description || "Default template role"}</td>
                      <td className="py-2.5 px-3 text-ink-5 text-[12px]">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === "export" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div>
                <div className="font-bold text-[14px]">HL7 FHIR R4 Interoperability Exporter</div>
                <div className="text-[12px] text-ink-4">Export patient records and clinical visits in standard FHIR JSON format</div>
              </div>
            </CardHeader>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FHIR_EXPORTS.map((item) => (
                <div key={item.id} className="p-3 border border-border rounded-lg flex flex-col justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[13px]">{item.name}</div>
                    <div className="text-[11px] text-ink-4">{item.desc}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleFhirExport(item.id)}
                  >
                    {item.label}
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <div className="font-bold text-[14px]">Bulk CSV Data Exporter</div>
                <div className="text-[12px] text-ink-4">Download complete tabular CSV datasets for custom reporting</div>
              </div>
            </CardHeader>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {CSV_EXPORTS.map((item) => (
                <div key={item.id} className="p-3 border border-border rounded-lg flex flex-col justify-between gap-2">
                  <div>
                    <div className="font-semibold text-[13px]">{item.name}</div>
                    <div className="text-[11px] text-ink-4">{item.desc}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCsvExport(item.id)}
                  >
                    Export CSV ↓
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === "audit" && (
        <Card>
          <CardHeader>
            <div>
              <div className="font-bold text-[14px]">Audit Trail</div>
              <div className="text-[12px] text-ink-4">Immutable action audit log across your hospital tenant</div>
            </div>
          </CardHeader>
          {isAuditLoading ? (
            <LoadingState />
          ) : isAuditError ? (
            <ErrorState message="Failed to load audit logs" />
          ) : auditLogs.length === 0 ? (
            <EmptyState message="No audit log entries recorded" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-border-soft text-ink-5 text-[11px] font-semibold uppercase">
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Actor</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Target Object</th>
                    <th className="py-2 px-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-page/50">
                      <td className="py-2.5 px-3 text-ink-5 text-[12px] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-medium">{log.actor_email ?? "System"}</td>
                      <td className="py-2.5 px-3">
                        <Pill tone={ACTION_TONE[log.action] ?? "neutral"}>{log.action}</Pill>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[12px]">{auditDetail(log)}</td>
                      <td className="py-2.5 px-3 text-ink-5 text-[12px] font-mono">{log.ip_address ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === "integrations" && (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="HIS Connector" value={connectorLabel} sub="HIS / EMR sync driver" />
            <StatTile label="Telephony Gateway" value="Exotel API" sub="Click-to-call & webhook receiver" />
            <StatTile label="WhatsApp Business" value="Meta Cloud API" sub="Template messages & automated replies" />
            <StatTile label="SMS Gateway" value="DLT DND Verified" sub="Transactional SMS alerts" />
          </div>

          <Card>
            <CardHeader>
              <div>
                <div className="font-bold text-[14px]">Integration Health Status</div>
                <div className="text-[12px] text-ink-4">Background workers and sync channels</div>
              </div>
            </CardHeader>
            {isHealthLoading ? (
              <LoadingState />
            ) : isHealthError ? (
              <ErrorState message="Failed to check integration status" />
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 border border-border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[14px]">HIS Sync Engine</span>
                    <Pill tone={healthData?.his_connector === "stub" ? "warn" : "ok"}>
                      {healthData?.his_connector === "stub" ? "Mock Connector" : "Active Driver"}
                    </Pill>
                  </div>
                  <div className="text-[12px] text-ink-4 space-y-1">
                    <div>Status: <span className="font-semibold text-ink-2">Online</span></div>
                  </div>
                </div>

                <div className="p-3.5 border border-border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[14px]">Automation & SLA Cron</span>
                    <Pill tone="ok">Operational</Pill>
                  </div>
                  <div className="text-[12px] text-ink-4 space-y-1">
                    <div>Waitlist Expiry Cron: <span className="font-semibold text-ink-2">Every 15 min</span></div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
