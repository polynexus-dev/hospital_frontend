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
  createHealthPackage,
  createCampaign,
  createCampRegistration,
  type CorporateClient,
  type Campaign,
} from "../../api/packages"

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border-strong rounded-xl p-5 w-[380px] shadow-2xl space-y-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-sm font-bold text-ink">New Corporate Client</h3>
          <button onClick={onClose} className="text-ink-4 hover:text-ink text-xs p-1">✕</button>
        </div>
        <div className="flex flex-col gap-2.5 text-xs">
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Company Name *</label>
            <input placeholder="e.g. Infosys Technologies" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Contact Person</label>
            <input placeholder="e.g. HR Manager / Wellness Lead" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand" />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Contact Phone</label>
            <input placeholder="Phone / Mobile" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono" />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Roster Size (Employees)</label>
            <input placeholder="Employee count" type="number" value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono" />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Contract Start Date</label>
            <input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand" />
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={() => create.mutate()} disabled={!name || create.isPending}>
            {create.isPending ? "Creating…" : "Save Client"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function NewHealthPackageModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [category, setCategory] = useState<"cardiac" | "full_body" | "ortho" | "maternity">("full_body")
  const [price, setPrice] = useState("")
  const [description, setDescription] = useState("")
  const [testsRaw, setTestsRaw] = useState("CBC, Lipid Profile, Blood Sugar Fasting, ECG, Chest X-Ray")

  const create = useMutation({
    mutationFn: () => {
      const tests = testsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      return createHealthPackage({
        name,
        code: code || `PKG-${Date.now().toString().slice(-4)}`,
        category,
        price: Number(price) || 0,
        description,
        included_tests: tests,
        is_active: true,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["health-packages"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border-strong rounded-xl p-5 w-[440px] shadow-2xl space-y-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-sm font-bold text-ink">Add Health Package</h3>
          <button onClick={onClose} className="text-ink-4 hover:text-ink text-xs p-1">✕</button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Package Name *</label>
            <input
              placeholder="e.g. Executive Cardiac Wellness"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Package Code</label>
              <input
                placeholder="e.g. CARD-EXEC-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
              >
                <option value="full_body">Comprehensive Full Body</option>
                <option value="cardiac">Cardiac Health</option>
                <option value="ortho">Bone & Joint</option>
                <option value="maternity">Maternity & Women Care</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Price (₹ INR) *</label>
            <input
              type="number"
              placeholder="e.g. 2499"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Included Diagnostic Tests (comma-separated)</label>
            <textarea
              rows={2}
              placeholder="CBC, Lipid Profile, Blood Sugar, ECG, etc."
              value={testsRaw}
              onChange={(e) => setTestsRaw(e.target.value)}
              className="w-full p-2 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Short Description</label>
            <textarea
              rows={2}
              placeholder="Recommended for ages 35+ looking for preventative cardiovascular assessment."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border justify-end">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => create.mutate()}
            disabled={!name.trim() || !price || create.isPending}
          >
            {create.isPending ? "Creating…" : "Save Package"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function NewCampaignModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [type, setType] = useState<"health_camp" | "digital_ad" | "corporate_tieup">("health_camp")
  const [budget, setBudget] = useState("")
  const [actualSpend, setActualSpend] = useState("")
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0])
  const [endDate, setEndDate] = useState("")

  const create = useMutation({
    mutationFn: () =>
      createCampaign({
        name,
        campaign_type: type,
        budget: Number(budget) || 0,
        actual_spend: Number(actualSpend) || 0,
        status: "active",
        start_date: startDate,
        end_date: endDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border-strong rounded-xl p-5 w-[420px] shadow-2xl space-y-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-sm font-bold text-ink">Create Marketing Campaign</h3>
          <button onClick={onClose} className="text-ink-4 hover:text-ink text-xs p-1">✕</button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Campaign Name *</label>
            <input
              placeholder="e.g. Free Knee Camp Koregaon Park"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Campaign Channel / Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            >
              <option value="health_camp">On-site Health Camp</option>
              <option value="digital_ad">Digital Ad (Meta / Google Search)</option>
              <option value="corporate_tieup">Corporate Health Tie-Up</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Allocated Budget (₹)</label>
              <input
                type="number"
                placeholder="e.g. 50000"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Initial Spend (₹)</label>
              <input
                type="number"
                placeholder="e.g. 15000"
                value={actualSpend}
                onChange={(e) => setActualSpend(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border justify-end">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => create.mutate()}
            disabled={!name.trim() || !startDate || create.isPending}
          >
            {create.isPending ? "Creating…" : "Launch Campaign"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function NewCampRegistrationModal({
  campaigns,
  onClose,
}: {
  campaigns: Campaign[]
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [campaignId, setCampaignId] = useState<number | "">(campaigns[0]?.id ?? "")
  const [patientName, setPatientName] = useState("")
  const [mobile, setMobile] = useState("")
  const [stage, setStage] = useState<"registered" | "attended" | "opd_converted" | "ipd_converted">("registered")
  const [revenue, setRevenue] = useState("")

  const create = useMutation({
    mutationFn: () =>
      createCampRegistration({
        campaign: Number(campaignId),
        patient_name: patientName,
        mobile,
        stage,
        revenue_generated: Number(revenue) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["camp-registrations"] })
      queryClient.invalidateQueries({ queryKey: ["campaigns"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border-strong rounded-xl p-5 w-[420px] shadow-2xl space-y-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-sm font-bold text-ink">Register Camp Attendee / Lead</h3>
          <button onClick={onClose} className="text-ink-4 hover:text-ink text-xs p-1">✕</button>
        </div>
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Select Campaign / Camp *</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(Number(e.target.value))}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.campaign_type})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Attendee / Patient Name *</label>
            <input
              placeholder="e.g. Sunita Patil"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Mobile Number *</label>
            <input
              placeholder="10-digit mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Funnel Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as any)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand"
              >
                <option value="registered">Registered</option>
                <option value="attended">Attended Camp</option>
                <option value="opd_converted">OPD Converted</option>
                <option value="ipd_converted">IPD Converted</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Revenue Generated (₹)</label>
              <input
                type="number"
                placeholder="e.g. 1500"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                className="w-full h-8 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-2 border-t border-border justify-end">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => create.mutate()}
            disabled={!campaignId || !patientName.trim() || !mobile.trim() || create.isPending}
          >
            {create.isPending ? "Registering…" : "Register Attendee"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function PackagesPage() {
  const [activeTab, setActiveTab] = useState<"catalog" | "campaigns" | "funnel" | "corporate">("catalog")
  const [showNewPackage, setShowNewPackage] = useState(false)
  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [showNewRegistration, setShowNewRegistration] = useState(false)
  const [showNewCorporate, setShowNewCorporate] = useState(false)

  const { data: packagesData, isLoading: isPackagesLoading } = useQuery({
    queryKey: ["health-packages"],
    queryFn: listHealthPackages,
    enabled: activeTab === "catalog",
  })

  const { data: campaignsData, isLoading: isCampaignsLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: listCampaigns,
    enabled: activeTab === "campaigns" || showNewRegistration,
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Packages, Camps & Campaigns</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Health package catalogue, campaign ROI tracking, & camp conversion funnels
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "catalog" && (
            <Button variant="primary" onClick={() => setShowNewPackage(true)}>
              + Add Health Package
            </Button>
          )}
          {activeTab === "campaigns" && (
            <Button variant="primary" onClick={() => setShowNewCampaign(true)}>
              + Create Campaign
            </Button>
          )}
          {activeTab === "funnel" && (
            <Button variant="primary" onClick={() => setShowNewRegistration(true)}>
              + Register Camp Lead
            </Button>
          )}
          {activeTab === "corporate" && (
            <Button variant="primary" onClick={() => setShowNewCorporate(true)}>
              + New Corporate Client
            </Button>
          )}
        </div>
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
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Health Check Packages</h2>
            <Button size="sm" variant="primary" onClick={() => setShowNewPackage(true)}>
              + Add Package
            </Button>
          </div>
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
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Campaign ROI & Lead Performance</h2>
            <Button size="sm" variant="primary" onClick={() => setShowNewCampaign(true)}>
              + Create Campaign
            </Button>
          </div>
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
                    <td className="px-6 py-4 text-xs uppercase font-semibold">{c.campaign_type.replace("_", " ")}</td>
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
            <Button variant="primary" onClick={() => setShowNewCorporate(true)}>+ New Corporate Client</Button>
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
        </div>
      )}

      {/* TAB 3: CAMP FUNNEL */}
      {activeTab === "funnel" && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Camp Conversion Funnel (Registered ➔ Attended ➔ OPD ➔ IPD)</h2>
            <Button size="sm" variant="primary" onClick={() => setShowNewRegistration(true)}>
              + Register Camp Lead
            </Button>
          </div>
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
              {registrations.length === 0 && (
                <div className="text-center text-slate-400 py-8">No camp registrations logged yet.</div>
              )}
            </div>
          )}
        </Card>
      )}

      {showNewPackage && (
        <NewHealthPackageModal onClose={() => setShowNewPackage(false)} />
      )}

      {showNewCampaign && (
        <NewCampaignModal onClose={() => setShowNewCampaign(false)} />
      )}

      {showNewRegistration && (
        <NewCampRegistrationModal
          campaigns={campaigns}
          onClose={() => setShowNewRegistration(false)}
        />
      )}

      {showNewCorporate && (
        <NewCorporateClientForm onClose={() => setShowNewCorporate(false)} />
      )}
    </div>
  )
}
