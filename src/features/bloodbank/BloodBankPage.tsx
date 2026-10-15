import React, { useEffect, useState } from "react"
import { createBloodUnit, createDonor, createTransfusion, listBloodUnits, listCrossMatchRequests, listDonors } from "../../api/bloodbank"
import type { BloodUnit, CrossMatchRequest, Donor } from "../../types/api"
import { viewRecord } from "../../store/recordViewer"
import { Pager } from "../../components/ui/Pager"

export function BloodBankPage() {
  const [activeTab, setActiveTab] = useState<"units" | "donors" | "crossmatches">("units")
  const [units, setUnits] = useState<BloodUnit[]>([])
  const [donors, setDonors] = useState<Donor[]>([])
  const [crossmatches, setCrossmatches] = useState<CrossMatchRequest[]>([])
  const [loading, setLoading] = useState(true)

  // Donor Modal
  const [showDonorModal, setShowDonorModal] = useState(false)
  const [donorName, setDonorName] = useState("")
  const [donorBloodGroup, setDonorBloodGroup] = useState("O+")
  const [donorPhone, setDonorPhone] = useState("")

  // Unit Modal
  const [showUnitModal, setShowUnitModal] = useState(false)
  const [unitDonorId, setUnitDonorId] = useState("")
  const [unitBloodGroup, setUnitBloodGroup] = useState("O+")
  const [unitComponent, setUnitComponent] = useState<BloodUnit["component"]>("prbc")

  // Transfusion Modal
  const [selectedUnit, setSelectedUnit] = useState<BloodUnit | null>(null)
  const [transPatientId, setTransPatientId] = useState("")
  const [transNotes, setTransNotes] = useState("")

  const [pages, setPages] = useState<Record<string, number>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const pageOf = (k: string) => ({ page: String(pages[k] ?? 1) })
  const goTo = (k: string) => (n: number) => setPages((s) => ({ ...s, [k]: n }))

  const loadData = async () => {
    try {
      setLoading(true)
      const [uRes, dRes, cmRes] = await Promise.all([listBloodUnits(pageOf("units")), listDonors(pageOf("donors")), listCrossMatchRequests(pageOf("crossmatches"))])
      setUnits(uRes.results)
      setDonors(dRes.results)
      setCrossmatches(cmRes.results)
      setCounts({ units: uRes.count, donors: dRes.count, crossmatches: cmRes.count })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages])

  const handleCreateDonor = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createDonor({ name: donorName, blood_group: donorBloodGroup, phone: donorPhone })
      setShowDonorModal(false)
      setDonorName("")
      setDonorPhone("")
      loadData()
    } catch (err: any) {
      alert("Failed to register donor: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const today = new Date()
      const expiry = new Date()
      expiry.setDate(today.getDate() + 35)

      await createBloodUnit({
        donor: unitDonorId ? Number(unitDonorId) : undefined,
        blood_group: unitBloodGroup,
        component: unitComponent,
        collection_date: today.toISOString().split("T")[0],
        expiry_date: expiry.toISOString().split("T")[0],
      })
      setShowUnitModal(false)
      loadData()
    } catch (err: any) {
      alert("Failed to add blood unit: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleTransfuse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUnit || !transPatientId) return
    try {
      await createTransfusion({
        blood_unit: selectedUnit.id,
        patient: Number(transPatientId),
        reaction_notes: transNotes,
      })
      setSelectedUnit(null)
      setTransPatientId("")
      setTransNotes("")
      loadData()
    } catch (err: any) {
      alert("Failed to issue transfusion: " + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-slate-100">
            Blood Bank & Transfusion Management
          </h1>
          <p className="text-sm text-ink-4 dark:text-slate-400">
            Track blood unit inventory, voluntary donors, cross-match requests, and patient transfusions.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDonorModal(true)}
            className="px-4 py-2 text-sm font-medium text-ink-2 dark:text-slate-200 bg-chip-bg dark:bg-slate-700 hover:bg-border-soft rounded-lg"
          >
            + Register Donor
          </button>
          <button
            onClick={() => setShowUnitModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-danger hover:bg-danger rounded-lg shadow-sm"
          >
            + Add Blood Unit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border dark:border-slate-700 flex gap-4">
        <button
          onClick={() => setActiveTab("units")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "units"
              ? "border-danger text-danger-text dark:text-rose-400"
              : "border-transparent text-ink-4 hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          Blood Inventory ({counts.units ?? units.length})
        </button>
        <button
          onClick={() => setActiveTab("donors")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "donors"
              ? "border-danger text-danger-text dark:text-rose-400"
              : "border-transparent text-ink-4 hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          Donors ({counts.donors ?? donors.length})
        </button>
        <button
          onClick={() => setActiveTab("crossmatches")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "crossmatches"
              ? "border-danger text-danger-text dark:text-rose-400"
              : "border-transparent text-ink-4 hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          Cross-Match Requests ({counts.crossmatches ?? crossmatches.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-ink-4">Loading Blood Bank records...</div>
      ) : activeTab === "units" ? (
        <div className="space-y-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-border dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border dark:border-slate-700 bg-page dark:bg-slate-900/50 text-xs font-semibold text-ink-4 uppercase">
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Collection Date</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-700">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-4">
                    No blood units in inventory.
                  </td>
                </tr>
              ) : (
                units.map((u) => (
                  <tr key={u.id} onClick={(ev) => viewRecord(ev, u, { subtitle: "Blood unit" })} title="Click to view details" className="hover:bg-page/50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <td className="px-4 py-3 font-bold text-danger-text dark:text-rose-400">{u.blood_group}</td>
                    <td className="px-4 py-3 uppercase text-xs font-semibold text-ink-2 dark:text-slate-300">
                      {u.component.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-ink-4">{u.collection_date}</td>
                    <td className="px-4 py-3 text-ink-4">{u.expiry_date}</td>
                    <td className="px-4 py-3 capitalize font-medium">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          u.status === "available"
                            ? "bg-success-bg text-success-text dark:bg-green-900/40 dark:text-green-300"
                            : u.status === "issued"
                            ? "bg-brand-tint text-brand-dark dark:bg-blue-900/40 dark:text-blue-300"
                            : "bg-chip-bg text-ink-2"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.status === "available" && (
                        <button
                          onClick={() => setSelectedUnit(u)}
                          className="px-3 py-1 text-xs font-semibold bg-danger-bg text-danger-text dark:bg-rose-900/40 dark:text-rose-300 rounded hover:bg-danger-border"
                        >
                          Transfuse
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager page={pages.units ?? 1} count={counts.units ?? 0} onPage={goTo("units")} />
        </div>
      ) : activeTab === "donors" ? (
        <div className="space-y-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-border dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border dark:border-slate-700 bg-page dark:bg-slate-900/50 text-xs font-semibold text-ink-4 uppercase">
                <th className="px-4 py-3">Donor Name</th>
                <th className="px-4 py-3">Blood Group</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Last Donation Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-700">
              {donors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ink-4">
                    No registered donors found.
                  </td>
                </tr>
              ) : (
                donors.map((d) => (
                  <tr key={d.id} onClick={(ev) => viewRecord(ev, d, { subtitle: "Blood donor" })} title="Click to view details" className="hover:bg-page/50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-ink dark:text-slate-100">{d.name}</td>
                    <td className="px-4 py-3 font-bold text-danger-text">{d.blood_group}</td>
                    <td className="px-4 py-3 text-ink-3 dark:text-slate-400">{d.phone || "N/A"}</td>
                    <td className="px-4 py-3 text-ink-4">{d.last_donation_date || "First time"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager page={pages.donors ?? 1} count={counts.donors ?? 0} onPage={goTo("donors")} />
        </div>
      ) : (
        <div className="space-y-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-border dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border dark:border-slate-700 bg-page dark:bg-slate-900/50 text-xs font-semibold text-ink-4 uppercase">
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Required Group</th>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-700">
              {crossmatches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-4">
                    No cross-match requests.
                  </td>
                </tr>
              ) : (
                crossmatches.map((cm) => (
                  <tr key={cm.id} onClick={(ev) => viewRecord(ev, cm, { subtitle: "Cross-match" })} title="Click to view details" className="hover:bg-page/50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-ink dark:text-slate-100">
                      {cm.patient_detail ? `${cm.patient_detail.first_name} ${cm.patient_detail.last_name}` : `Patient #${cm.patient}`}
                    </td>
                    <td className="px-4 py-3 font-bold text-danger-text">{cm.blood_group_required}</td>
                    <td className="px-4 py-3 uppercase text-xs font-semibold text-ink-3">{cm.component}</td>
                    <td className="px-4 py-3 capitalize font-semibold text-ink dark:text-slate-200">{cm.status}</td>
                    <td className="px-4 py-3 text-ink-4">{new Date(cm.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager page={pages.crossmatches ?? 1} count={counts.crossmatches ?? 0} onPage={goTo("crossmatches")} />
        </div>
      )}

      {/* Donor Modal */}
      {showDonorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Register Blood Donor</h2>
            <form onSubmit={handleCreateDonor} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Donor Name</label>
                <input
                  type="text"
                  required
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Blood Group</label>
                  <select
                    value={donorBloodGroup}
                    onChange={(e) => setDonorBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={donorPhone}
                    onChange={(e) => setDonorPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDonorModal(false)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-slate-800 dark:bg-slate-700 rounded-lg">
                  Save Donor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      {showUnitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Add Blood Unit to Inventory</h2>
            <form onSubmit={handleCreateUnit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Donor ID (Optional)</label>
                <input
                  type="number"
                  value={unitDonorId}
                  onChange={(e) => setUnitDonorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Blood Group</label>
                  <select
                    value={unitBloodGroup}
                    onChange={(e) => setUnitBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Component</label>
                  <select
                    value={unitComponent}
                    onChange={(e) => setUnitComponent(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  >
                    <option value="whole_blood">Whole Blood</option>
                    <option value="prbc">PRBC</option>
                    <option value="ffp">FFP</option>
                    <option value="platelets">Platelets</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowUnitModal(false)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-danger rounded-lg">
                  Save Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfusion Modal */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Issue Blood Transfusion</h2>
            <form onSubmit={handleTransfuse} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Target Patient ID</label>
                <input
                  type="number"
                  required
                  value={transPatientId}
                  onChange={(e) => setTransPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Reaction / Monitoring Notes</label>
                <textarea
                  rows={3}
                  value={transNotes}
                  onChange={(e) => setTransNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  placeholder="Record post-transfusion observations..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSelectedUnit(null)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-danger rounded-lg">
                  Confirm Transfusion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
