import React, { useEffect, useState } from "react"
import {
  createAnaesthesiaRecord,
  createConsumableUsage,
  createImplantUsage,
  createOperativeNote,
  createOTSchedule,
  createPreOpChecklist,
  createSurgeryRequest,
  finalizeAnaesthesiaRecord,
  finalizeOperativeNote,
  listOTSchedules,
  listSurgeryRequests,
} from "../../api/ot"
import type { OTSchedule, SurgeryRequest } from "../../types/api"

export function OTPage() {
  const [activeTab, setActiveTab] = useState<"requests" | "schedules">("requests")
  const [requests, setRequests] = useState<SurgeryRequest[]>([])
  const [schedules, setSchedules] = useState<OTSchedule[]>([])
  const [loading, setLoading] = useState(true)

  // New Request Modal
  const [showReqModal, setShowReqModal] = useState(false)
  const [reqPatientId, setReqPatientId] = useState("")
  const [proposedProc, setProposedProc] = useState("")

  // PreOp Checklist Modal
  const [preOpReq, setPreOpReq] = useState<SurgeryRequest | null>(null)
  const [consentObtained, setConsentObtained] = useState(true)
  const [fastingConfirmed, setFastingConfirmed] = useState(true)
  const [siteMarked, setSiteMarked] = useState(true)

  // Schedule Modal
  const [selectedReq, setSelectedReq] = useState<SurgeryRequest | null>(null)
  const [otRoom, setOtRoom] = useState("OT-1")
  const [surgeonId, setSurgeonId] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")

  // Operative Note Modal
  const [selectedSchedForNote, setSelectedSchedForNote] = useState<OTSchedule | null>(null)
  const [procPerformed, setProcPerformed] = useState("")
  const [opFindings, setOpFindings] = useState("")

  // Anaesthesia Record Modal
  const [selectedSchedForAnaes, setSelectedSchedForAnaes] = useState<OTSchedule | null>(null)
  const [anaesType, setAnaesType] = useState("General Anaesthesia")
  const [anaesNotes, setAnaesNotes] = useState("")
  const [anaesthetistId, setAnaesthetistId] = useState("")

  // Consumable & Implant Modal
  const [selectedSchedForSupply, setSelectedSchedForSupply] = useState<OTSchedule | null>(null)
  const [itemName, setItemName] = useState("")
  const [itemQty, setItemQty] = useState("1")
  const [implantName, setImplantName] = useState("")
  const [implantSerial, setImplantSerial] = useState("")

  const loadData = async () => {
    try {
      setLoading(true)
      const [reqRes, schedRes] = await Promise.all([listSurgeryRequests(), listOTSchedules()])
      setRequests(reqRes.results)
      setSchedules(schedRes.results)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createSurgeryRequest({ patient: Number(reqPatientId), proposed_procedure: proposedProc })
      setShowReqModal(false)
      setReqPatientId("")
      setProposedProc("")
      loadData()
    } catch (err: any) {
      alert("Failed to create surgery request: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleSavePreOp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!preOpReq) return
    try {
      await createPreOpChecklist({
        surgery_request: preOpReq.id,
        consent_obtained: consentObtained,
        fasting_confirmed: fastingConfirmed,
        site_marked: siteMarked,
      })
      setPreOpReq(null)
      loadData()
    } catch (err: any) {
      alert("Failed to save PreOp checklist: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleScheduleOT = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedReq || !surgeonId || !startTime || !endTime) return
    try {
      await createOTSchedule({
        surgery_request: selectedReq.id,
        operation_theatre_room: otRoom,
        surgeon: Number(surgeonId),
        scheduled_start: new Date(startTime).toISOString(),
        scheduled_end: new Date(endTime).toISOString(),
      })
      setSelectedReq(null)
      loadData()
    } catch (err: any) {
      alert("Failed to schedule OT: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSchedForNote || !surgeonId) return
    try {
      const now = new Date().toISOString()
      const note = await createOperativeNote({
        ot_schedule: selectedSchedForNote.id,
        procedure_performed: procPerformed,
        findings: opFindings,
        surgeon: Number(surgeonId),
        started_at: selectedSchedForNote.scheduled_start,
        ended_at: now,
      })
      if (confirm("Finalize operative note now? (Finalized notes lock edits)")) {
        await finalizeOperativeNote(note.id)
      }
      setSelectedSchedForNote(null)
      setProcPerformed("")
      setOpFindings("")
      loadData()
    } catch (err: any) {
      alert("Failed to save operative note: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleCreateAnaesthesia = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSchedForAnaes || !anaesthetistId) return
    try {
      const rec = await createAnaesthesiaRecord({
        ot_schedule: selectedSchedForAnaes.id,
        anaesthesia_type: anaesType,
        intra_op_notes: anaesNotes,
        anaesthetist: Number(anaesthetistId),
      })
      if (confirm("Finalize anaesthesia record now?")) {
        await finalizeAnaesthesiaRecord(rec.id)
      }
      setSelectedSchedForAnaes(null)
      setAnaesNotes("")
      loadData()
    } catch (err: any) {
      alert("Failed to save anaesthesia record: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleAddConsumable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSchedForSupply || !itemName) return
    try {
      await createConsumableUsage({
        ot_schedule: selectedSchedForSupply.id,
        item_name: itemName,
        quantity: Number(itemQty),
      })
      setItemName("")
      loadData()
    } catch (err: any) {
      alert("Failed to log consumable: " + (err.response?.data?.detail || err.message))
    }
  }

  const handleAddImplant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSchedForSupply || !implantName) return
    try {
      await createImplantUsage({
        ot_schedule: selectedSchedForSupply.id,
        implant_name: implantName,
        serial_number: implantSerial,
        quantity: 1,
      })
      setImplantName("")
      setImplantSerial("")
      loadData()
    } catch (err: any) {
      alert("Failed to log implant: " + (err.response?.data?.detail || err.message))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Operation Theatre (OT) Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage surgical workflow: Pre-Op Checklists, OT Rostering, Anaesthesia Logs, Operative Notes & Implants.
          </p>
        </div>
        <button
          onClick={() => setShowReqModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
        >
          + Request Surgery
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-4">
        <button
          onClick={() => setActiveTab("requests")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "requests"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Surgery Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab("schedules")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "schedules"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          OT Schedules & Notes ({schedules.length})
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading OT records...</div>
      ) : activeTab === "requests" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Proposed Procedure</th>
                <th className="px-4 py-3">PreOp Safety Checklist</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No active surgery requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {r.patient_detail ? `${r.patient_detail.first_name} ${r.patient_detail.last_name}` : `Patient #${r.patient}`}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{r.proposed_procedure}</td>
                    <td className="px-4 py-3">
                      {r.preop_checklist ? (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 rounded-full">
                          Checklist Complete
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-full">
                          Pending Checklist
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize font-semibold text-indigo-600 dark:text-indigo-400">{r.status}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {!r.preop_checklist && (
                        <button
                          onClick={() => setPreOpReq(r)}
                          className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded hover:bg-amber-200"
                        >
                          + PreOp Safety
                        </button>
                      )}
                      {r.status === "requested" && (
                        <button
                          onClick={() => setSelectedReq(r)}
                          className="px-2.5 py-1 text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 rounded hover:bg-indigo-200"
                        >
                          Schedule OT
                        </button>
                      )}
                    </td>
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
                <th className="px-4 py-3">OT Room</th>
                <th className="px-4 py-3">Surgeon</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Operative Note</th>
                <th className="px-4 py-3">Anaesthesia</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No scheduled surgeries.
                  </td>
                </tr>
              ) : (
                schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{s.operation_theatre_room}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">Doctor #{s.surgeon}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {new Date(s.scheduled_start).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {s.operative_note ? (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                          {s.operative_note.finalized_at ? "Finalized" : "Draft"}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.anaesthesia_record ? (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded-full">
                          {s.anaesthesia_record.finalized_at ? "Finalized" : "Draft"}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => {
                          setSelectedSchedForNote(s)
                          setSurgeonId(String(s.surgeon))
                        }}
                        className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200"
                      >
                        + Op Note
                      </button>
                      <button
                        onClick={() => setSelectedSchedForAnaes(s)}
                        className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-800 rounded hover:bg-purple-200"
                      >
                        + Anaes
                      </button>
                      <button
                        onClick={() => setSelectedSchedForSupply(s)}
                        className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-800 rounded hover:bg-slate-200"
                      >
                        + Supplies
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Request Modal */}
      {showReqModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create Surgery Request</h2>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Patient ID</label>
                <input
                  type="number"
                  required
                  value={reqPatientId}
                  onChange={(e) => setReqPatientId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Proposed Procedure</label>
                <textarea
                  required
                  rows={3}
                  value={proposedProc}
                  onChange={(e) => setProposedProc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowReqModal(false)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PreOp Modal */}
      {preOpReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Pre-Op Safety Checklist</h2>
            <form onSubmit={handleSavePreOp} className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={consentObtained}
                    onChange={(e) => setConsentObtained(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Surgical Consent Obtained
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={fastingConfirmed}
                    onChange={(e) => setFastingConfirmed(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  NPO / Fasting Status Confirmed
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={siteMarked}
                    onChange={(e) => setSiteMarked(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  Surgical Site Marked
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setPreOpReq(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg">
                  Save Safety Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Schedule Operation Theatre</h2>
            <form onSubmit={handleScheduleOT} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">OT Room</label>
                <input
                  type="text"
                  required
                  value={otRoom}
                  onChange={(e) => setOtRoom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Surgeon ID</label>
                <input
                  type="number"
                  required
                  value={surgeonId}
                  onChange={(e) => setSurgeonId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Scheduled Start</label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Scheduled End</label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedReq(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg">
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Operative Note Modal */}
      {selectedSchedForNote && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-lg w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Record Operative Note</h2>
            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Procedure Performed</label>
                <input
                  type="text"
                  required
                  value={procPerformed}
                  onChange={(e) => setProcPerformed(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Intraoperative Findings</label>
                <textarea
                  rows={4}
                  value={opFindings}
                  onChange={(e) => setOpFindings(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedSchedForNote(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg">
                  Save Operative Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Anaesthesia Modal */}
      {selectedSchedForAnaes && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Record Anaesthesia Log</h2>
            <form onSubmit={handleCreateAnaesthesia} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Anaesthetist User ID</label>
                <input
                  type="number"
                  required
                  value={anaesthetistId}
                  onChange={(e) => setAnaesthetistId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Anaesthesia Type</label>
                <input
                  type="text"
                  required
                  value={anaesType}
                  onChange={(e) => setAnaesType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Intraoperative Notes</label>
                <textarea
                  rows={3}
                  value={anaesNotes}
                  onChange={(e) => setAnaesNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedSchedForAnaes(null)} className="px-4 py-2 text-sm text-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg">
                  Save Anaesthesia Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplies Modal */}
      {selectedSchedForSupply && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Log Consumables & Implants</h2>
            <div className="space-y-4 border-b border-slate-200 dark:border-slate-700 pb-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Add Consumable Item</h3>
              <form onSubmit={handleAddConsumable} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Item Name (e.g. Sutures)"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border rounded dark:bg-slate-900 dark:border-slate-700"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  className="w-16 px-2 py-1.5 text-sm border rounded dark:bg-slate-900 dark:border-slate-700"
                />
                <button type="submit" className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded">
                  Add
                </button>
              </form>
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Add Implant Usage</h3>
              <form onSubmit={handleAddImplant} className="space-y-2">
                <input
                  type="text"
                  placeholder="Implant Name (e.g. Titanium Mesh)"
                  value={implantName}
                  onChange={(e) => setImplantName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border rounded dark:bg-slate-900 dark:border-slate-700"
                />
                <input
                  type="text"
                  placeholder="Serial / Lot Number"
                  value={implantSerial}
                  onChange={(e) => setImplantSerial(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border rounded dark:bg-slate-900 dark:border-slate-700"
                />
                <button type="submit" className="w-full py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded">
                  Record Implant
                </button>
              </form>
            </div>
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setSelectedSchedForSupply(null)} className="px-4 py-2 text-sm text-slate-500">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
