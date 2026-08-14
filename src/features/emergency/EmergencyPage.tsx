import React, { useEffect, useState } from "react"
import { admitEDVisitToIPD, createEDVisit, createTriage, listEDVisits } from "../../api/emergency"
import type { EDVisit } from "../../types/api"

export function EmergencyPage() {
  const [visits, setVisits] = useState<EDVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // New visit modal state
  const [showNewVisitModal, setShowNewVisitModal] = useState(false)
  const [patientId, setPatientId] = useState("")
  const [chiefComplaint, setChiefComplaint] = useState("")

  // Triage modal state
  const [selectedVisit, setSelectedVisit] = useState<EDVisit | null>(null)
  const [triageCategory, setTriageCategory] = useState<"1_resuscitation" | "2_emergent" | "3_urgent" | "4_less_urgent" | "5_non_urgent">("2_emergent")
  const [vitalsSummary, setVitalsSummary] = useState("")

  // Admit modal state
  const [admitDoctorId, setAdmitDoctorId] = useState("")
  const [admitBedId, setAdmitBedId] = useState("")
  const [showAdmitModal, setShowAdmitModal] = useState(false)

  const loadVisits = async () => {
    try {
      setLoading(true)
      const res = await listEDVisits()
      setVisits(res.results)
      setError(null)
    } catch (err: any) {
      setError(err?.message || "Failed to load ED visits")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVisits()
  }, [])

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientId || !chiefComplaint) return
    try {
      await createEDVisit({ patient: Number(patientId), chief_complaint: chiefComplaint })
      setShowNewVisitModal(false)
      setPatientId("")
      setChiefComplaint("")
      loadVisits()
    } catch (err: any) {
      alert("Error creating ED Visit: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateTriage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVisit) return
    try {
      await createTriage({
        ed_visit: selectedVisit.id,
        triage_category: triageCategory,
        vitals_summary: vitalsSummary,
      })
      setSelectedVisit(null)
      setVitalsSummary("")
      loadVisits()
    } catch (err: any) {
      alert("Error adding Triage: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleAdmitToIPD = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVisit || !admitDoctorId || !admitBedId) return
    try {
      await admitEDVisitToIPD(selectedVisit.id, {
        admitting_doctor: Number(admitDoctorId),
        bed: Number(admitBedId),
      })
      setShowAdmitModal(false)
      setSelectedVisit(null)
      setAdmitDoctorId("")
      setAdmitBedId("")
      loadVisits()
    } catch (err: any) {
      alert("Error admitting to IPD: " + (err.response?.data?.error || err.message))
    }
  }

  const getTriageBadge = (cat?: string) => {
    switch (cat) {
      case "1_resuscitation":
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-600 text-white animate-pulse">Cat 1 - Resuscitation</span>
      case "2_emergent":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-500 text-white">Cat 2 - Emergent</span>
      case "3_urgent":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-500 text-slate-900">Cat 3 - Urgent</span>
      case "4_less_urgent":
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500 text-white">Cat 4 - Less Urgent</span>
      default:
        return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-600 text-white">Cat 5 - Non-Urgent</span>
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Emergency Department (ED) & Triage
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage incoming emergency patient triage, vital assessments, and IPD transfers.
          </p>
        </div>
        <button
          onClick={() => setShowNewVisitModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors"
        >
          + Register ED Walk-in
        </button>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading ED visits...</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Arrived At</th>
                  <th className="px-4 py-3">Chief Complaint</th>
                  <th className="px-4 py-3">Triage Category</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                {visits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No active emergency visits recorded.
                    </td>
                  </tr>
                ) : (
                  visits.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {v.patient_detail ? `${v.patient_detail.first_name} ${v.patient_detail.last_name}` : `Patient #${v.patient}`}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {new Date(v.arrived_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200 max-w-xs truncate">
                        {v.chief_complaint}
                      </td>
                      <td className="px-4 py-3">
                        {v.triage ? getTriageBadge(v.triage.triage_category) : <span className="text-xs text-amber-600 font-medium">Pending Triage</span>}
                      </td>
                      <td className="px-4 py-3 capitalize font-medium text-slate-800 dark:text-slate-200">
                        {v.status.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {!v.triage && (
                          <button
                            onClick={() => setSelectedVisit(v)}
                            className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded hover:bg-amber-200"
                          >
                            + Triage
                          </button>
                        )}
                        {v.status !== "admitted" && (
                          <button
                            onClick={() => {
                              setSelectedVisit(v)
                              setShowAdmitModal(true)
                            }}
                            className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 rounded hover:bg-indigo-200"
                          >
                            Admit to IPD
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Visit Modal */}
      {showNewVisitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Register ED Patient</h2>
            <form onSubmit={handleCreateVisit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Patient ID</label>
                <input
                  type="number"
                  required
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="Enter patient numeric ID"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Chief Complaint</label>
                <textarea
                  required
                  rows={3}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="Describe patient emergency symptoms..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewVisitModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  Create ED Visit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Triage Modal */}
      {selectedVisit && !showAdmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Perform Emergency Triage</h2>
            <form onSubmit={handleCreateTriage} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Triage Category</label>
                <select
                  value={triageCategory}
                  onChange={(e) => setTriageCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="1_resuscitation">Category 1 - Resuscitation (Immediate)</option>
                  <option value="2_emergent">Category 2 - Emergent (Within 10 mins)</option>
                  <option value="3_urgent">Category 3 - Urgent (Within 30 mins)</option>
                  <option value="4_less_urgent">Category 4 - Less Urgent (Within 60 mins)</option>
                  <option value="5_non_urgent">Category 5 - Non-Urgent (Within 120 mins)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Vitals Summary</label>
                <input
                  type="text"
                  value={vitalsSummary}
                  onChange={(e) => setVitalsSummary(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="BP, Pulse, SpO2, Temp"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVisit(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
                >
                  Save Triage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admit Modal */}
      {selectedVisit && showAdmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Admit ED Patient to IPD Bed</h2>
            <form onSubmit={handleAdmitToIPD} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Admitting Doctor ID</label>
                <input
                  type="number"
                  required
                  value={admitDoctorId}
                  onChange={(e) => setAdmitDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="Doctor ID"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Target Bed ID</label>
                <input
                  type="number"
                  required
                  value={admitBedId}
                  onChange={(e) => setAdmitBedId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="Bed ID"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdmitModal(false)
                    setSelectedVisit(null)
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Confirm IPD Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
