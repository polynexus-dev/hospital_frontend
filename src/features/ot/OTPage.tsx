import React, { useEffect, useState } from "react"
import { extractApiError } from "../../api/client"
import {
  cancelOTSchedule,
  createConsumableUsage,
  createImplantUsage,
  createOperativeNote,
  createOTSchedule,
  createPreOpChecklist,
  createSurgeryRequest,
  finalizeOperativeNote,
  listOTSchedules,
  listSurgeryRequests,
} from "../../api/ot"
import { FieldInput } from "../../components/resource/ResourceTable"
import type { OTSchedule, SurgeryRequest } from "../../types/api"
import { admissionField, doctorField, patientField, userField } from "../nabh/fields"
import { AnaesthesiaRecordModal } from "./AnaesthesiaRecordModal"
import { EncounterPill } from "./encounter"
import { OTBoard } from "./OTBoard"
import { OTChargesModal } from "./OTChargesModal"
import { PreOpInvestigationsModal } from "./PreOpInvestigationsModal"
import { viewRecord } from "../../store/recordViewer"
import { Pager } from "../../components/ui/Pager"
import { UpdatedBy } from "./UpdatedBy"

const gradeField = { key: "surgery_grade", label: "Surgery grade", type: "fk" as const, source: "/finance/surgery-grades/?is_active=true", sourceLabel: (r: any) => `${r.name} (${r.code})` }
const STATUS_LABEL: Record<string, string> = { scheduled: "Scheduled", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" }

export function OTPage() {
  const [activeTab, setActiveTab] = useState<"board" | "requests" | "schedules">("board")
  const [boardKey, setBoardKey] = useState(0)
  const [requests, setRequests] = useState<SurgeryRequest[]>([])
  const [schedules, setSchedules] = useState<OTSchedule[]>([])
  const [loading, setLoading] = useState(true)

  // New Request Modal
  const [showReqModal, setShowReqModal] = useState(false)
  const [reqPatientId, setReqPatientId] = useState("")
  const [proposedProc, setProposedProc] = useState("")
  const [reqAdmission, setReqAdmission] = useState("")
  const [reqGrade, setReqGrade] = useState("")
  const [reqPriority, setReqPriority] = useState("elective")
  const [reqEncounter, setReqEncounter] = useState("")

  // PreOp Checklist Modal
  const [preOpReq, setPreOpReq] = useState<SurgeryRequest | null>(null)
  const [workupReq, setWorkupReq] = useState<SurgeryRequest | null>(null)
  const [consentObtained, setConsentObtained] = useState(true)
  const [fastingConfirmed, setFastingConfirmed] = useState(true)
  const [siteMarked, setSiteMarked] = useState(true)

  // Schedule Modal
  const [selectedReq, setSelectedReq] = useState<SurgeryRequest | null>(null)
  const [otRoom, setOtRoom] = useState("OT-1")
  const [surgeonId, setSurgeonId] = useState("")
  const [assistantId, setAssistantId] = useState("")
  const [schedAnaesthetistId, setSchedAnaesthetistId] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")

  // Operative Note Modal
  const [selectedSchedForNote, setSelectedSchedForNote] = useState<OTSchedule | null>(null)
  const [procPerformed, setProcPerformed] = useState("")
  const [opFindings, setOpFindings] = useState("")

  // Anaesthesia record & OT charges
  const [selectedSchedForAnaes, setSelectedSchedForAnaes] = useState<OTSchedule | null>(null)
  const [selectedSchedForCharges, setSelectedSchedForCharges] = useState<OTSchedule | null>(null)

  // Consumable & Implant Modal
  const [selectedSchedForSupply, setSelectedSchedForSupply] = useState<OTSchedule | null>(null)
  const [itemName, setItemName] = useState("")
  const [itemQty, setItemQty] = useState("1")
  const [implantName, setImplantName] = useState("")
  const [implantSerial, setImplantSerial] = useState("")

  const [pages, setPages] = useState<Record<string, number>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const pageOf = (k: string) => ({ page: String(pages[k] ?? 1) })
  const goTo = (k: string) => (n: number) => setPages((s) => ({ ...s, [k]: n }))

  const loadData = async () => {
    try {
      setLoading(true)
      const [reqRes, schedRes] = await Promise.all([listSurgeryRequests(pageOf("requests")), listOTSchedules(pageOf("schedules"))])
      setRequests(reqRes.results)
      setSchedules(schedRes.results)
      setCounts({ requests: reqRes.count, schedules: schedRes.count })
      setBoardKey((k) => k + 1)
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

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createSurgeryRequest({
        patient: Number(reqPatientId),
        proposed_procedure: proposedProc,
        admission: reqAdmission ? Number(reqAdmission) : null,
        surgery_grade: reqGrade ? Number(reqGrade) : null,
        priority: reqPriority,
        encounter_type: reqEncounter,
      })
      setShowReqModal(false)
      setReqPatientId("")
      setProposedProc("")
      setReqAdmission("")
      setReqGrade("")
      setReqPriority("elective")
      setReqEncounter("")
      loadData()
    } catch (err: any) {
      const data = err.response?.data
      let detail = err.message
      if (data) {
        if (typeof data === "string") detail = data
        else if (data.detail) detail = data.detail
        else {
          detail = Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
            .join(" | ")
        }
      }
      alert("Failed to create surgery request: " + detail)
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
        assistant_surgeon: assistantId ? Number(assistantId) : null,
        anaesthetist: schedAnaesthetistId ? Number(schedAnaesthetistId) : null,
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

  const handleCancel = async (sched: OTSchedule) => {
    const reason = prompt("Why is the surgery cancelled?")
    if (!reason?.trim()) return
    try {
      await cancelOTSchedule(sched.id, reason.trim())
      loadData()
    } catch (err) {
      alert("Failed to cancel: " + extractApiError(err))
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
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-slate-100">
            Operation Theatre (OT) Management
          </h1>
          <p className="text-sm text-ink-4 dark:text-slate-400">
            Manage surgical workflow: OT board, Pre-Op Checklists, OT Rostering, Anaesthesia Charts, OT Charges, Operative Notes & Implants.
          </p>
        </div>
        <button
          onClick={() => setShowReqModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-dark rounded-lg shadow-sm"
        >
          + Request Surgery
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border dark:border-slate-700 flex gap-4">
        <button
          onClick={() => setActiveTab("board")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "board"
              ? "border-brand text-brand dark:text-indigo-400"
              : "border-transparent text-ink-4 hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          OT board
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "requests"
              ? "border-brand text-brand dark:text-indigo-400"
              : "border-transparent text-ink-4 hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          Surgery Requests ({counts.requests ?? requests.length})
        </button>
        <button
          onClick={() => setActiveTab("schedules")}
          className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "schedules"
              ? "border-brand text-brand dark:text-indigo-400"
              : "border-transparent text-ink-4 hover:text-ink-2 dark:hover:text-slate-300"
          }`}
        >
          OT Schedules & Notes ({counts.schedules ?? schedules.length})
        </button>
      </div>

      {activeTab === "board" ? (
        <OTBoard refreshKey={boardKey} />
      ) : loading ? (
        <div className="py-12 text-center text-ink-4">Loading OT records...</div>
      ) : activeTab === "requests" ? (
        <div className="space-y-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-border dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border dark:border-slate-700 bg-page dark:bg-slate-900/50 text-xs font-semibold text-ink-4 uppercase">
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Proposed Procedure</th>
                <th className="px-4 py-3">Encounter</th>
                <th className="px-4 py-3">PreOp Safety Checklist</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-700">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-4">
                    No active surgery requests found.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} onClick={(ev) => viewRecord(ev, r, { subtitle: "Surgery request" })} title="Click to view details" className="hover:bg-page/50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-ink dark:text-slate-100">
                      {r.patient_detail ? `${r.patient_detail.first_name} ${r.patient_detail.last_name}` : `Patient #${r.patient}`}
                    </td>
                    <td className="px-4 py-3 text-ink-2 dark:text-slate-200">
                      {r.proposed_procedure}
                      <div className="text-xs text-ink-4">{r.surgery_grade_name || "No grade"}{r.priority && r.priority !== "elective" ? ` · ${r.priority}` : ""}</div>
                    </td>
                    <td className="px-4 py-3"><EncounterPill value={r.encounter} /></td>
                    <td className="px-4 py-3">
                      {r.preop_checklist ? (
                        <span className="px-2 py-0.5 text-xs font-semibold bg-success-bg text-success-text dark:bg-green-900/40 dark:text-green-300 rounded-full">
                          Checklist Complete
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium bg-warning-bg text-warning-text dark:bg-amber-900/40 dark:text-amber-300 rounded-full">
                          Pending Checklist
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize font-semibold text-brand dark:text-indigo-400">{r.status}<UpdatedBy name={r.updated_by_name} at={r.updated_at} className="normal-case font-normal" /></td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {!r.preop_checklist && (
                        <button
                          onClick={() => setPreOpReq(r)}
                          className="px-2.5 py-1 text-xs font-semibold bg-warning-bg text-warning-text dark:bg-amber-900/40 dark:text-amber-300 rounded hover:bg-warning/30"
                        >
                          + PreOp Safety
                        </button>
                      )}
                      <button
                        onClick={() => setWorkupReq(r)}
                        className="px-2.5 py-1 text-xs font-semibold border border-border-strong rounded hover:bg-page"
                      >
                        Pre-op tests
                      </button>
                      {r.status === "requested" && (
                        <button
                          onClick={() => setSelectedReq(r)}
                          className="px-2.5 py-1 text-xs font-semibold bg-brand-tint text-brand-dark dark:bg-indigo-900/40 dark:text-indigo-300 rounded hover:bg-brand-border"
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
        <Pager page={pages.requests ?? 1} count={counts.requests ?? 0} onPage={goTo("requests")} />
        </div>
      ) : (
        <div className="space-y-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-border dark:border-slate-700 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border dark:border-slate-700 bg-page dark:bg-slate-900/50 text-xs font-semibold text-ink-4 uppercase">
                <th className="px-4 py-3">OT Room</th>
                <th className="px-4 py-3">Patient / procedure</th>
                <th className="px-4 py-3">Surgeon</th>
                <th className="px-4 py-3">Window</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Operative Note</th>
                <th className="px-4 py-3">Anaesthesia</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-slate-700">
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-ink-4">
                    No scheduled surgeries.
                  </td>
                </tr>
              ) : (
                schedules.map((s) => {
                  const req = requests.find((r) => r.id === s.surgery_request)
                  return (
                  <tr key={s.id} onClick={(ev) => viewRecord(ev, s, { subtitle: "OT schedule" })} title="Click to view details" className="hover:bg-page/50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <td className="px-4 py-3 font-semibold text-ink dark:text-slate-100">{s.operation_theatre_room}</td>
                    <td className="px-4 py-3 text-ink-2 dark:text-slate-300">
                      {req?.patient_detail ? `${req.patient_detail.first_name} ${req.patient_detail.last_name}` : `Request #${s.surgery_request}`}
                      <div className="text-xs text-ink-4">{req?.proposed_procedure}</div>
                      <div className="mt-1"><EncounterPill value={req?.encounter} /></div>
                    </td>
                    <td className="px-4 py-3 text-ink-2 dark:text-slate-300">
                      {s.surgeon_detail ? `Dr. ${s.surgeon_detail.name}` : `Doctor #${s.surgeon}`}
                      {s.assistant_surgeon_name ? <div className="text-xs text-ink-4">Asst: Dr. {s.assistant_surgeon_name}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-ink-4 text-xs">
                      {new Date(s.scheduled_start).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-semibold text-ink-2 dark:text-slate-200">{STATUS_LABEL[s.status ?? "scheduled"] ?? s.status}</span>
                      {s.status === "cancelled" && s.cancellation_reason ? <div className="text-ink-4">{s.cancellation_reason}</div> : null}
                      <UpdatedBy name={s.updated_by_name} at={s.updated_at} />
                      {s.charges_posted_at ? <div className="text-success-text">Charges posted</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      {s.operative_note ? (
                        <>
                          <span className="text-xs px-2 py-0.5 bg-success-bg text-success-text rounded-full">
                            {s.operative_note.finalized_at ? "Finalized" : "Draft"}
                          </span>
                          <UpdatedBy name={s.operative_note.updated_by_name} at={s.operative_note.updated_at} />
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.anaesthesia_record ? (
                        <span className="text-xs px-2 py-0.5 bg-accent-tint text-accent-hover rounded-full">
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
                        className="px-2 py-1 text-xs font-semibold bg-success-bg text-success-text rounded hover:bg-success/25"
                      >
                        + Op Note
                      </button>
                      <button
                        onClick={() => setSelectedSchedForAnaes(s)}
                        className="px-2 py-1 text-xs font-semibold bg-accent-tint text-accent-hover rounded hover:bg-accent/25"
                      >
                        {s.anaesthesia_record ? "Anaes chart" : "+ Anaes"}
                      </button>
                      <button
                        onClick={() => setSelectedSchedForCharges(s)}
                        className="px-2 py-1 text-xs font-semibold bg-brand-tint text-brand-dark rounded hover:bg-brand-border"
                      >
                        Charges
                      </button>
                      <button
                        onClick={() => setSelectedSchedForSupply(s)}
                        className="px-2 py-1 text-xs font-semibold bg-chip-bg text-ink rounded hover:bg-border-soft"
                      >
                        + Supplies
                      </button>
                      {s.status === "scheduled" && (
                        <button
                          onClick={() => handleCancel(s)}
                          className="px-2 py-1 text-xs font-semibold bg-danger-bg text-danger-text rounded hover:bg-danger/20"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <Pager page={pages.schedules ?? 1} count={counts.schedules ?? 0} onPage={goTo("schedules")} />
        </div>
      )}

      {/* New Request Modal */}
      {showReqModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Create Surgery Request</h2>
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Patient</label>
                <FieldInput field={patientField()} value={reqPatientId} onChange={(v) => setReqPatientId(v ? String(v) : "")} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Admission (blank for OPD / day care)</label>
                <FieldInput field={admissionField()} value={reqAdmission} onChange={(v) => setReqAdmission(v ? String(v) : "")} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Surgery grade (prices the surgery from the OT tariff)</label>
                <FieldInput field={gradeField} value={reqGrade} onChange={(v) => setReqGrade(v ? String(v) : "")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Priority</label>
                  <select value={reqPriority} onChange={(e) => setReqPriority(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700">
                    <option value="elective">Elective</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Encounter</label>
                  <select value={reqEncounter} onChange={(e) => setReqEncounter(e.target.value)} className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700">
                    <option value="">Automatic</option>
                    <option value="opd">OPD / day care</option>
                    <option value="ipd">IPD</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Proposed Procedure</label>
                <textarea
                  required
                  rows={3}
                  value={proposedProc}
                  onChange={(e) => setProposedProc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowReqModal(false)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" disabled={!reqPatientId} className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg disabled:opacity-50">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PreOp Modal */}
      {workupReq && <PreOpInvestigationsModal request={workupReq} onClose={() => setWorkupReq(null)} />}
      {preOpReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Pre-Op Safety Checklist</h2>
            <form onSubmit={handleSavePreOp} className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-ink-2 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={consentObtained}
                    onChange={(e) => setConsentObtained(e.target.checked)}
                    className="rounded text-brand"
                  />
                  Surgical Consent Obtained
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-2 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={fastingConfirmed}
                    onChange={(e) => setFastingConfirmed(e.target.checked)}
                    className="rounded text-brand"
                  />
                  NPO / Fasting Status Confirmed
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-2 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={siteMarked}
                    onChange={(e) => setSiteMarked(e.target.checked)}
                    className="rounded text-brand"
                  />
                  Surgical Site Marked
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setPreOpReq(null)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-warning rounded-lg">
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
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Schedule Operation Theatre</h2>
            <form onSubmit={handleScheduleOT} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">OT Room</label>
                <input
                  type="text"
                  required
                  value={otRoom}
                  onChange={(e) => setOtRoom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Surgeon</label>
                <FieldInput field={doctorField("surgeon", "Surgeon")} value={surgeonId} onChange={(v) => setSurgeonId(v ? String(v) : "")} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Assistant surgeon (optional)</label>
                <FieldInput field={doctorField("assistant_surgeon", "Assistant surgeon", false)} value={assistantId} onChange={(v) => setAssistantId(v ? String(v) : "")} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Anaesthetist (optional)</label>
                <FieldInput field={userField("anaesthetist", "Anaesthetist")} value={schedAnaesthetistId} onChange={(v) => setSchedAnaesthetistId(v ? String(v) : "")} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Scheduled Start</label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Scheduled End</label>
                <input
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedReq(null)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg">
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
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Record Operative Note</h2>
            <form onSubmit={handleCreateNote} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Procedure Performed</label>
                <input
                  type="text"
                  required
                  value={procPerformed}
                  onChange={(e) => setProcPerformed(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 dark:text-slate-300 mb-1">Intraoperative Findings</label>
                <textarea
                  rows={4}
                  value={opFindings}
                  onChange={(e) => setOpFindings(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedSchedForNote(null)} className="px-4 py-2 text-sm text-ink-4">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-success rounded-lg">
                  Save Operative Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedSchedForAnaes && (
        <AnaesthesiaRecordModal schedule={selectedSchedForAnaes} onClose={() => setSelectedSchedForAnaes(null)} onSaved={loadData} />
      )}

      {selectedSchedForCharges && (
        <OTChargesModal schedule={selectedSchedForCharges} onClose={() => setSelectedSchedForCharges(null)} onPosted={loadData} />
      )}

      {/* Supplies Modal */}
      {selectedSchedForSupply && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-ink dark:text-slate-100">Log Consumables & Implants</h2>
            <div className="space-y-4 border-b border-border dark:border-slate-700 pb-4">
              <h3 className="text-sm font-semibold text-ink-2 dark:text-slate-300">Add Consumable Item</h3>
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
              <h3 className="text-sm font-semibold text-ink-2 dark:text-slate-300">Add Implant Usage</h3>
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
                <button type="submit" className="w-full py-1.5 text-xs font-semibold text-white bg-brand rounded">
                  Record Implant
                </button>
              </form>
            </div>
            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setSelectedSchedForSupply(null)} className="px-4 py-2 text-sm text-ink-4">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
