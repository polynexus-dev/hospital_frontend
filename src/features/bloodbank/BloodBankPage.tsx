import React, { useEffect, useState } from "react"
import { createBloodUnit, createDonor, createTransfusion, listBloodUnits, listCrossMatchRequests, listDonors } from "../../api/bloodbank"
import type { BloodUnit, CrossMatchRequest, Donor } from "../../types/api"

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

  const loadData = async () => {
    try {
      setLoading(true)
      const [uRes, dRes, cmRes] = await Promise.all([listBloodUnits(), listDonors(), listCrossMatchRequests()])
      setUnits(uRes.results)
      setDonors(dRes.results)
      setCrossmatches(cmRes.results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Blood Bank & Transfusion Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track blood unit inventory, voluntary donors, cross-match requests, and patient transfusions.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDonorModal(true)}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-lg"
          >
            + Register Donor
          </button>
          <button
            onClick={() => setShowUnitModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
          >
            + Add Blood Unit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-4">
        <button
          onClick={() => setActiveTab("units")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "units"
              ? "border-rose-600 text-rose-600 dark:text-rose-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Blood Inventory ({units.length})
        </button>
        <button
          onClick={() => setActiveTab("donors")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "donors"
              ? "border-rose-600 text-rose-600 dark:text-rose-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Donors ({donors.length})
        </button>
        <button
          onClick={() => setActiveTab("crossmatches")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "crossmatches"
              ? "border-rose-600 text-rose-600 dark:text-rose-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Cross-Match Requests ({crossmatches.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading Blood Bank records...</div>
      ) : activeTab === "units" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Collection Date</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {units.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No blood units in inventory.
                  </td>
                </tr>
              ) : (
                units.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400">{u.blood_group}</td>
                    <td className="px-4 py-3 uppercase text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {u.component.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.collection_date}</td>
                    <td className="px-4 py-3 text-slate-500">{u.expiry_date}</td>
                    <td className="px-4 py-3 capitalize font-medium">
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          u.status === "available"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            : u.status === "issued"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.status === "available" && (
                        <button
                          onClick={() => setSelectedUnit(u)}
                          className="px-3 py-1 text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 rounded hover:bg-rose-200"
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
      ) : activeTab === "donors" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Donor Name</th>
                <th className="px-4 py-3">Blood Group</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Last Donation Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {donors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    No registered donors found.
                  </td>
                </tr>
              ) : (
                donors.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{d.name}</td>
                    <td className="px-4 py-3 font-bold text-rose-600">{d.blood_group}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{d.phone || "N/A"}</td>
                    <td className="px-4 py-3 text-slate-500">{d.last_donation_date || "First time"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Required Group</th>
                <th className="px-4 py-3">Component</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {crossmatches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No cross-match requests.
                  </td>
                </tr>
              ) : (
                crossmatches.map((cm) => (
                  <tr key={cm.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {cm.patient_detail ? `${cm.patient_detail.first_name} ${cm.patient_detail.last_name}` : `Patient #${cm.patient}`}
                    </td>
                    <td className="px-4 py-3 font-bold text-rose-600">{cm.blood_group_required}</td>
                    <td className="px-4 py-3 uppercase text-xs font-semibold text-slate-600">{cm.component}</td>
                    <td className="px-4 py-3 capitalize font-semibold text-slate-800 dark:text-slate-200">{cm.status}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(cm.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Donor Modal */}
      {showDonorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Register Blood Donor</h2>
            <form onSubmit={handleCreateDonor} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Donor Name</label>
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
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
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
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={donorPhone}
                    onChange={(e) => setDonorPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowDonorModal(false)} className="px-4 py-2 text-sm text-slate-500">
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add Blood Unit to Inventory</h2>
            <form onSubmit={handleCreateUnit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Donor ID (Optional)</label>
                <input
                  type="number"
                  value={unitDonorId}
                  onChange={(e) => setUnitDonorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Blood Group</label>
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
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Component</label>
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
                <button type="button" onClick={() => setShowUnitModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg">
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Issue Blood Transfusion</h2>
            <form onSubmit={handleTransfuse} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Target Patient ID</label>
                <input
                  type="number"
                  required
                  value={transPatientId}
                  onChange={(e) => setTransPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Reaction / Monitoring Notes</label>
                <textarea
                  rows={3}
                  value={transNotes}
                  onChange={(e) => setTransNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  placeholder="Record post-transfusion observations..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSelectedUnit(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg">
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
