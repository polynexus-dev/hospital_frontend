import React, { useEffect, useState } from "react"
import { createICUAdmission, createICUProgressNote, createVentilatorLog, finalizeICUProgressNote, listICUAdmissions } from "../../api/icu"
import type { ICUAdmission } from "../../types/api"

export function ICUPage() {
  const [admissions, setAdmissions] = useState<ICUAdmission[]>([])
  const [loading, setLoading] = useState(true)

  // New ICU Admission Modal
  const [showAdmitModal, setShowAdmitModal] = useState(false)
  const [ipdAdmissionId, setIpdAdmissionId] = useState("")
  const [bedId, setBedId] = useState("")
  const [ventilatorReq, setVentilatorReq] = useState(false)

  // Selected ICU Admission for Logs / Notes
  const [selectedICU, setSelectedICU] = useState<ICUAdmission | null>(null)
  const [actionType, setActionType] = useState<"vent" | "note" | null>(null)

  // Vent log form
  const [ventMode, setVentMode] = useState("SIMV")
  const [peep, setPeep] = useState("5")
  const [fio2, setFio2] = useState("40")

  // Progress note form
  const [doctorId, setDoctorId] = useState("")
  const [noteText, setNoteText] = useState("")

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await listICUAdmissions()
      setAdmissions(res.results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateICUAdmission = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createICUAdmission({
        admission: Number(ipdAdmissionId),
        bed: Number(bedId),
        ventilator_required: ventilatorReq,
      })
      setShowAdmitModal(false)
      setIpdAdmissionId("")
      setBedId("")
      loadData()
    } catch (err: any) {
      alert("Failed to admit to ICU: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleAddVentLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedICU) return
    try {
      await createVentilatorLog({
        icu_admission: selectedICU.id,
        mode: ventMode,
        ventilator_settings: { PEEP: Number(peep), FiO2: Number(fio2) },
      })
      setSelectedICU(null)
      setActionType(null)
      loadData()
    } catch (err: any) {
      alert("Failed to record ventilator log: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleAddProgressNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedICU || !doctorId) return
    try {
      const note = await createICUProgressNote({
        icu_admission: selectedICU.id,
        doctor: Number(doctorId),
        note: noteText,
      })
      if (confirm("Finalize ICU daily progress note now?")) {
        await finalizeICUProgressNote(note.id)
      }
      setSelectedICU(null)
      setActionType(null)
      setNoteText("")
      loadData()
    } catch (err: any) {
      alert("Failed to save progress note: " + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Intensive Care Unit (ICU) Monitoring
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitor ICU patients, ventilator parameters, and daily intensivist progress notes.
          </p>
        </div>
        <button
          onClick={() => setShowAdmitModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
        >
          + Transfer Patient to ICU
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading ICU records...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {admissions.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              No patients currently admitted in ICU.
            </div>
          ) : (
            admissions.map((icu) => (
              <div
                key={icu.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400">ICU Bed #{icu.bed}</span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {icu.admission_detail?.patient ? `Admission #${icu.admission}` : `Admission #${icu.admission}`}
                    </h3>
                  </div>
                  {icu.ventilator_required ? (
                    <span className="px-2.5 py-1 text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 rounded-full animate-pulse">
                      Ventilator On
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-full">
                      Stable
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <p>Admitted: {new Date(icu.admitted_at).toLocaleString()}</p>
                  <p>Ventilator logs: {icu.ventilator_logs?.length || 0}</p>
                  <p>Progress notes: {icu.progress_notes?.length || 0}</p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedICU(icu)
                      setActionType("vent")
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded hover:bg-purple-100"
                  >
                    + Vent Log
                  </button>
                  <button
                    onClick={() => {
                      setSelectedICU(icu)
                      setActionType("note")
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded hover:bg-blue-100"
                  >
                    + Progress Note
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Admit Modal */}
      {showAdmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Admit to ICU Bed</h2>
            <form onSubmit={handleCreateICUAdmission} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">IPD Admission ID</label>
                <input
                  type="number"
                  required
                  value={ipdAdmissionId}
                  onChange={(e) => setIpdAdmissionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">ICU Bed ID</label>
                <input
                  type="number"
                  required
                  value={bedId}
                  onChange={(e) => setBedId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ventReq"
                  checked={ventilatorReq}
                  onChange={(e) => setVentilatorReq(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="ventReq" className="text-sm text-slate-700 dark:text-slate-300">
                  Ventilator Support Required
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAdmitModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg">
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vent Log Modal */}
      {selectedICU && actionType === "vent" && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Log Ventilator Settings</h2>
            <form onSubmit={handleAddVentLog} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Ventilator Mode</label>
                <input
                  type="text"
                  required
                  value={ventMode}
                  onChange={(e) => setVentMode(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">PEEP (cmH2O)</label>
                  <input
                    type="number"
                    value={peep}
                    onChange={(e) => setPeep(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">FiO2 (%)</label>
                  <input
                    type="number"
                    value={fio2}
                    onChange={(e) => setFio2(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSelectedICU(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg">
                  Save Vent Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Progress Note Modal */}
      {selectedICU && actionType === "note" && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">ICU Daily Progress Note</h2>
            <form onSubmit={handleAddProgressNote} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Intensivist Doctor ID</label>
                <input
                  type="number"
                  required
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Progress & Clinical Notes</label>
                <textarea
                  required
                  rows={4}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                  placeholder="Record hemodynamics, ABG values, and daily plan..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSelectedICU(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg">
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
