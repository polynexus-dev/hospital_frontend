import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Avatar } from "../../components/ui/Avatar"
import { LoadingState } from "../../components/ui/QueryStates"
import { showToast } from "../../components/ui/Toast"
import {
  listDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  blockDoctorLeave,
  unblockDoctorLeave,
  getDoctorQueue,
  listDepartments,
  listSlotTemplates,
  createSlotTemplate,
  deleteSlotTemplate,
  generateSlotsFromTemplate,
  type DoctorInput,
} from "../../api/doctors"
import type { Doctor, Department, SlotTemplate } from "../../types/api"

const COMMON_SPECIALITIES = [
  "General Medicine",
  "Cardiology",
  "Orthopaedics",
  "Neurology",
  "Paediatrics",
  "Dermatology",
  "General Surgery",
  "Obstetrics & Gynaecology",
  "ENT",
  "Ophthalmology",
  "Oncology",
  "Psychiatry",
  "Pulmonology",
]

const WEEKDAYS = [
  { id: 0, label: "Monday" },
  { id: 1, label: "Tuesday" },
  { id: 2, label: "Wednesday" },
  { id: 3, label: "Thursday" },
  { id: 4, label: "Friday" },
  { id: 5, label: "Saturday" },
  { id: 6, label: "Sunday" },
]

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// -------------------------------------------------------------
// Doctor Add / Edit Modal
// -------------------------------------------------------------
interface DoctorModalProps {
  doctor?: Doctor | null
  departments: Department[]
  onClose: () => void
}

function DoctorFormModal({ doctor, departments, onClose }: DoctorModalProps) {
  const queryClient = useQueryClient()
  const isEditing = Boolean(doctor)

  const [name, setName] = useState(doctor?.name ?? "")
  const [speciality, setSpeciality] = useState(doctor?.speciality ?? "General Medicine")
  const [department, setDepartment] = useState<string>(doctor?.department ? String(doctor.department) : "")
  const [phone, setPhone] = useState(doctor?.phone ?? "")
  const [email, setEmail] = useState(doctor?.email ?? "")
  const [degree, setDegree] = useState(doctor?.degree ?? "")
  const [smcReg, setSmcReg] = useState(doctor?.smc_registration_number ?? "")
  const [consultMinutes, setConsultMinutes] = useState(doctor?.default_consultation_minutes ?? 15)
  const [isActive, setIsActive] = useState(doctor ? doctor.is_active : true)

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: DoctorInput = {
        name: name.trim(),
        speciality: speciality.trim(),
        department: department ? Number(department) : null,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        degree: degree.trim() || undefined,
        smc_registration_number: smcReg.trim() || undefined,
        default_consultation_minutes: Number(consultMinutes) || 15,
        is_active: isActive,
      }

      if (doctor?.id) {
        return updateDoctor(doctor.id, payload)
      }
      return createDoctor(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] })
      showToast(isEditing ? "Doctor updated successfully!" : "Doctor registered successfully!", "success")
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.message || err?.body?.detail || "Failed to save doctor details."
      showToast(msg, "error")
    },
  })

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border-strong rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-page/50">
          <div>
            <h3 className="text-sm font-bold text-ink">
              {isEditing ? `Edit Physician: ${doctor?.name}` : "Register New Doctor"}
            </h3>
            <p className="text-[11px] text-ink-4 mt-0.5">
              Enter doctor profile, clinical credentials, and default OPD timing
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-ink-4 hover:text-ink hover:bg-page transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto text-xs">
          {/* Full Name */}
          <div>
            <label className="text-[11px] font-semibold text-ink-3 block mb-1">
              Full Name (with Dr. prefix) <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Rajesh K. Deshmukh"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-8.5 px-3 border border-border-strong rounded bg-page outline-none focus:border-brand font-medium text-ink"
            />
          </div>

          {/* Speciality with suggestions */}
          <div>
            <label className="text-[11px] font-semibold text-ink-3 block mb-1">
              Clinical Speciality <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cardiology, Orthopaedics"
              value={speciality}
              onChange={(e) => setSpeciality(e.target.value)}
              className="w-full h-8.5 px-3 border border-border-strong rounded bg-page outline-none focus:border-brand font-medium text-ink"
            />
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {COMMON_SPECIALITIES.slice(0, 6).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setSpeciality(sp)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    speciality === sp
                      ? "bg-brand text-white border-brand"
                      : "bg-surface text-ink-3 border-border hover:border-brand-border"
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          {/* Department & Default Consult Minutes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-ink-3 block mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full h-8.5 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand text-ink"
              >
                <option value="">Select Department (Optional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.code ? `(${d.code})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-ink-3 block mb-1">
                Consultation Slot Duration
              </label>
              <select
                value={consultMinutes}
                onChange={(e) => setConsultMinutes(Number(e.target.value))}
                className="w-full h-8.5 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand text-ink font-mono"
              >
                <option value={10}>10 Minutes / patient</option>
                <option value={15}>15 Minutes / patient</option>
                <option value={20}>20 Minutes / patient</option>
                <option value={30}>30 Minutes / patient</option>
                <option value={45}>45 Minutes / patient</option>
                <option value={60}>60 Minutes / patient</option>
              </select>
            </div>
          </div>

          {/* Qualifications & SMC Reg */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-ink-3 block mb-1">
                Degree / Qualification
              </label>
              <input
                type="text"
                placeholder="e.g. MBBS, MD, DM"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                className="w-full h-8.5 px-3 border border-border-strong rounded bg-page outline-none focus:border-brand text-ink"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-ink-3 block mb-1">
                SMC / MCI Registration No.
              </label>
              <input
                type="text"
                placeholder="e.g. MMC-2015-08-1234"
                value={smcReg}
                onChange={(e) => setSmcReg(e.target.value)}
                className="w-full h-8.5 px-3 border border-border-strong rounded bg-page outline-none focus:border-brand text-ink font-mono"
              />
            </div>
          </div>

          {/* Contact: Phone & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-ink-3 block mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-8.5 px-3 border border-border-strong rounded bg-page outline-none focus:border-brand text-ink font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-ink-3 block mb-1">Email Address</label>
              <input
                type="email"
                placeholder="doctor@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-8.5 px-3 border border-border-strong rounded bg-page outline-none focus:border-brand text-ink"
              />
            </div>
          </div>

          {/* Active Status */}
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <div>
              <span className="text-[12px] font-semibold text-ink">Active Physician</span>
              <p className="text-[10.5px] text-ink-4">
                Active doctors appear on booking portals, OPD calendars, and appointment forms.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-border-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-success"></div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-page/50">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || !speciality.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : isEditing ? "Save Changes" : "Register Doctor"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Live OPD Queue Modal
// -------------------------------------------------------------
function DoctorQueueModal({ doctor, onClose }: { doctor: Doctor; onClose: () => void }) {
  const [selectedDate, setSelectedDate] = useState(todayIso())

  const queueQuery = useQuery({
    queryKey: ["doctor-queue", doctor.id, selectedDate],
    queryFn: () => getDoctorQueue(doctor.id, selectedDate),
  })

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border-strong rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-page/50">
          <div className="flex items-center gap-2.5">
            <Avatar name={doctor.name} size={32} />
            <div>
              <h3 className="text-sm font-bold text-ink">Live OPD Queue: {doctor.name}</h3>
              <p className="text-[11px] text-ink-4">{doctor.speciality} · {doctor.department_name || "OPD"}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-ink-4 hover:text-ink hover:bg-page transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-ink-3">Select Queue Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-7.5 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono text-xs"
            />
          </div>

          {queueQuery.isLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingState />
            </div>
          ) : queueQuery.isError ? (
            <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-center">
              Failed to load queue. Please verify appointments server.
            </div>
          ) : (
            <>
              {/* Now Serving Card */}
              <div className="p-3.5 rounded-lg border border-brand-border bg-brand-tint space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-brand">
                    CURRENTLY IN CONSULTATION
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/20 text-success-text text-[10.5px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-success animate-ping" />
                    Now Serving
                  </span>
                </div>
                {queueQuery.data?.now_serving ? (
                  <div className="pt-1">
                    <div className="font-bold text-sm text-brand-dark">
                      Appointment #{queueQuery.data.now_serving.id}
                    </div>
                    <div className="text-[11px] text-ink-3">
                      Patient ID: {queueQuery.data.now_serving.patient} · Status: {queueQuery.data.now_serving.status}
                    </div>
                  </div>
                ) : (
                  <p className="text-ink-4 italic text-[11px] pt-1">
                    No patient currently marked in consultation.
                  </p>
                )}
              </div>

              {/* Waiting Queue List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-ink-3 font-semibold">
                  <span>Waiting Patients ({queueQuery.data?.waiting?.length ?? 0})</span>
                </div>

                {!queueQuery.data?.waiting || queueQuery.data.waiting.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-border rounded-lg text-ink-4">
                    <span className="text-2xl block mb-1">🎉</span>
                    No patients currently waiting in queue for {selectedDate}.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {queueQuery.data.waiting.map((appt, idx) => (
                      <div
                        key={appt.id}
                        className="flex items-center justify-between p-2.5 rounded border border-border hover:bg-page transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5.5 h-5.5 rounded-full bg-chip-bg text-chip-text font-bold text-[11px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-ink">Appointment #{appt.id}</div>
                            <div className="text-[10.5px] text-ink-4">
                              Patient #{appt.patient} · Slot #{appt.slot}
                            </div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {appt.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end bg-page/50">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Doctor Leave / Block Modal
// -------------------------------------------------------------
function DoctorLeaveModal({ doctor, onClose }: { doctor: Doctor; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<"block" | "unblock">("block")
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState(todayIso())
  const [reason, setReason] = useState("Academic conference / personal leave")

  const leaveMutation = useMutation({
    mutationFn: () => {
      if (mode === "block") {
        return blockDoctorLeave(doctor.id, {
          date: startDate,
          start_date: startDate,
          end_date: endDate,
          reason,
        })
      }
      return unblockDoctorLeave(doctor.id, {
        date: startDate,
        start_date: startDate,
        end_date: endDate,
      })
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] })
      queryClient.invalidateQueries({ queryKey: ["slots"] })
      const text =
        mode === "block"
          ? `Leave blocked successfully (${res.blocked ?? 1} slot(s) locked)!`
          : `Leave unblocked successfully (${res.unblocked ?? 1} slot(s) restored)!`
      showToast(text, "success")
      onClose()
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to update doctor leave.", "error")
    },
  })

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border-strong rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-page/50">
          <div>
            <h3 className="text-sm font-bold text-ink">Manage Leave: {doctor.name}</h3>
            <p className="text-[11px] text-ink-4">Block or unblock OPD consultation availability</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-ink-4 hover:text-ink hover:bg-page transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Mode Switch */}
          <div className="grid grid-cols-2 p-1 bg-page border border-border rounded-lg">
            <button
              type="button"
              onClick={() => setMode("block")}
              className={`py-1.5 rounded-md font-semibold text-center transition-all ${
                mode === "block" ? "bg-surface text-danger shadow-xs border border-border" : "text-ink-3 hover:text-ink"
              }`}
            >
              🔒 Block Leave
            </button>
            <button
              type="button"
              onClick={() => setMode("unblock")}
              className={`py-1.5 rounded-md font-semibold text-center transition-all ${
                mode === "unblock" ? "bg-surface text-success shadow-xs border border-border" : "text-ink-3 hover:text-ink"
              }`}
            >
              🔓 Unblock Leave
            </button>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-ink-3 block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (e.target.value > endDate) setEndDate(e.target.value)
                }}
                className="w-full h-8.5 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-ink-3 block mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-8.5 px-2.5 border border-border-strong rounded bg-page outline-none focus:border-brand font-mono text-xs"
              />
            </div>
          </div>

          {mode === "block" && (
            <div>
              <label className="text-[11px] font-semibold text-ink-3 block mb-1">Reason for Leave</label>
              <input
                type="text"
                placeholder="e.g. Annual Medical Conference, Sick Leave, Family Event"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-8.5 px-3 border border-border-strong rounded bg-page outline-none focus:border-brand text-xs text-ink"
              />
            </div>
          )}

          <div className="p-3 rounded-lg bg-page border border-border text-[11px] text-ink-3">
            {mode === "block" ? (
              <span>
                Blocking leave will automatically mark all existing unbooked slots during this period as blocked.
                Patients will not be able to book appointments with Dr. {doctor.name}.
              </span>
            ) : (
              <span>
                Unblocking leave will restore the doctor's consultation slots for the chosen dates.
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2 bg-page/50">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={leaveMutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={mode === "block" ? "danger" : "primary"}
            onClick={() => leaveMutation.mutate()}
            disabled={leaveMutation.isPending}
          >
            {leaveMutation.isPending ? "Processing..." : mode === "block" ? "Confirm Block Leave" : "Confirm Unblock"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Doctor OPD Slots & Weekly Templates Modal
// -------------------------------------------------------------
function DoctorScheduleModal({ doctor, onClose }: { doctor: Doctor; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"templates" | "generate">("templates")

  // New Template form state
  const [weekday, setWeekday] = useState(0)
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("13:00")
  const [duration, setDuration] = useState(doctor.default_consultation_minutes || 15)

  // Generate slots state
  const [genStart, setGenStart] = useState(todayIso())
  const [genEnd, setGenEnd] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0, 10)
  })
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)

  const templatesQuery = useQuery({
    queryKey: ["slot-templates", doctor.id],
    queryFn: () => listSlotTemplates({ doctor: doctor.id }),
  })

  const createTplMutation = useMutation({
    mutationFn: () =>
      createSlotTemplate({
        doctor: doctor.id,
        weekday,
        start_time: startTime.includes(":") && startTime.split(":").length === 2 ? `${startTime}:00` : startTime,
        end_time: endTime.includes(":") && endTime.split(":").length === 2 ? `${endTime}:00` : endTime,
        slot_duration_minutes: duration,
        is_active: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slot-templates", doctor.id] })
      showToast("Weekly OPD slot template created!", "success")
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to create slot template.", "error")
    },
  })

  const deleteTplMutation = useMutation({
    mutationFn: (id: number) => deleteSlotTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slot-templates", doctor.id] })
      showToast("Slot template deleted.", "info")
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to delete slot template.", "error")
    },
  })

  const genMutation = useMutation({
    mutationFn: () => {
      if (!selectedTemplateId) throw new Error("Select a slot template to generate from.")
      return generateSlotsFromTemplate(selectedTemplateId, {
        start_date: genStart,
        end_date: genEnd,
      })
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["slots"] })
      showToast(res?.detail || `Slots generated successfully!`, "success")
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to generate slots.", "error")
    },
  })

  const templates = templatesQuery.data ?? []

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border-strong rounded-xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-page/50">
          <div>
            <h3 className="text-sm font-bold text-ink">OPD Roster & Slot Templates: {doctor.name}</h3>
            <p className="text-[11px] text-ink-4">Configure recurring weekly clinics and generate bookable appointment slots</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-ink-4 hover:text-ink hover:bg-page transition-colors text-xs"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5 pt-2 gap-4 text-xs">
          <button
            onClick={() => setActiveTab("templates")}
            className={`pb-2.5 font-semibold transition-all border-b-2 ${
              activeTab === "templates"
                ? "border-brand text-brand"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            Weekly Clinic Templates ({templates.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("generate")
              if (templates.length > 0 && !selectedTemplateId) {
                setSelectedTemplateId(templates[0].id)
              }
            }}
            className={`pb-2.5 font-semibold transition-all border-b-2 ${
              activeTab === "generate"
                ? "border-brand text-brand"
                : "border-transparent text-ink-3 hover:text-ink"
            }`}
          >
            Generate Live Slots
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto text-xs space-y-4">
          {activeTab === "templates" ? (
            <>
              {/* Existing Templates list */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider block">
                  Active Weekly Schedules
                </span>

                {templatesQuery.isLoading ? (
                  <div className="py-6 flex justify-center">
                    <LoadingState />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-border rounded-lg text-ink-4">
                    No weekly clinic schedules defined yet. Add one below.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {templates.map((tpl: SlotTemplate) => (
                      <div
                        key={tpl.id}
                        className="flex items-center justify-between p-2.5 rounded border border-border bg-page hover:bg-surface transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-brand bg-brand-tint px-2 py-0.5 rounded text-[11px]">
                            {WEEKDAYS.find((w) => w.id === tpl.weekday)?.label ?? `Day ${tpl.weekday}`}
                          </span>
                          <span className="font-mono text-ink font-medium">
                            {tpl.start_time.slice(0, 5)} - {tpl.end_time.slice(0, 5)}
                          </span>
                          <span className="text-ink-4 text-[10.5px]">
                            ({tpl.slot_duration_minutes}m per slot)
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-danger hover:bg-danger/10 hover:border-danger text-xs h-6 px-2"
                          onClick={() => deleteTplMutation.mutate(tpl.id)}
                          disabled={deleteTplMutation.isPending}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Template Box */}
              <div className="pt-3 border-t border-border space-y-3">
                <span className="text-[11px] font-semibold text-ink block">Add Weekly Clinic Session</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10.5px] text-ink-4 block mb-1">Weekday</label>
                    <select
                      value={weekday}
                      onChange={(e) => setWeekday(Number(e.target.value))}
                      className="w-full h-8 px-2 border border-border-strong rounded bg-page text-xs"
                    >
                      {WEEKDAYS.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10.5px] text-ink-4 block mb-1">Start Time</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full h-8 px-2 border border-border-strong rounded bg-page text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] text-ink-4 block mb-1">End Time</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full h-8 px-2 border border-border-strong rounded bg-page text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] text-ink-4 block mb-1">Slot Duration</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      className="w-full h-8 px-2 border border-border-strong rounded bg-page text-xs"
                    >
                      <option value={10}>10 min</option>
                      <option value={15}>15 min</option>
                      <option value={20}>20 min</option>
                      <option value={30}>30 min</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => createTplMutation.mutate()}
                    disabled={createTplMutation.isPending}
                  >
                    {createTplMutation.isPending ? "Adding..." : "+ Add Clinic Template"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Generate Live Slots Tab */
            <div className="space-y-3.5">
              <p className="text-ink-3">
                Generate appointment calendar slots from an existing weekly template for upcoming patient bookings.
              </p>

              {templates.length === 0 ? (
                <div className="p-4 border border-warning/30 bg-warning/10 text-warning-text rounded-lg">
                  Please add at least one weekly clinic template first before generating slots.
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-semibold text-ink-3 block mb-1">Select Template</label>
                    <select
                      value={selectedTemplateId ?? ""}
                      onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                      className="w-full h-8.5 px-3 border border-border-strong rounded bg-page text-xs"
                    >
                      {templates.map((tpl: SlotTemplate) => (
                        <option key={tpl.id} value={tpl.id}>
                          {WEEKDAYS.find((w) => w.id === tpl.weekday)?.label} ({tpl.start_time.slice(0, 5)} - {tpl.end_time.slice(0, 5)}, {tpl.slot_duration_minutes}m)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-ink-3 block mb-1">From Date</label>
                      <input
                        type="date"
                        value={genStart}
                        onChange={(e) => setGenStart(e.target.value)}
                        className="w-full h-8.5 px-2.5 border border-border-strong rounded bg-page font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-ink-3 block mb-1">To Date</label>
                      <input
                        type="date"
                        value={genEnd}
                        min={genStart}
                        onChange={(e) => setGenEnd(e.target.value)}
                        className="w-full h-8.5 px-2.5 border border-border-strong rounded bg-page font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-page border border-border rounded text-[11px] text-ink-4">
                    The backend will calculate dates matching the template's weekday and generate bookable slots for patients.
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    className="w-full"
                    onClick={() => genMutation.mutate()}
                    disabled={genMutation.isPending || !selectedTemplateId}
                  >
                    {genMutation.isPending ? "Generating Slots..." : "⚡ Generate Bookable Slots"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end bg-page/50">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Delete Doctor Confirmation Modal
// -------------------------------------------------------------
function DeleteDoctorModal({ doctor, onClose }: { doctor: Doctor; onClose: () => void }) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => deleteDoctor(doctor.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] })
      showToast(`Dr. ${doctor.name} has been removed.`, "info")
      onClose()
    },
    onError: (err: any) => {
      showToast(err?.message || "Failed to delete doctor.", "error")
    },
  })

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border-strong rounded-xl w-full max-w-sm shadow-2xl p-5 space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 text-danger">
          <span className="text-xl">⚠️</span>
          <h3 className="text-sm font-bold text-ink">Delete Physician Record</h3>
        </div>
        <p className="text-xs text-ink-3 leading-relaxed">
          Are you sure you want to delete <strong className="text-ink">{doctor.name}</strong> ({doctor.speciality})?
          This action will permanently delete this doctor's profile and unassign their upcoming slots.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Doctor"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Main DoctorsPage Component
// -------------------------------------------------------------
export function DoctorsPage() {
  const queryClient = useQueryClient()

  // Filters & State
  const [search, setSearch] = useState("")
  const [selectedDept, setSelectedDept] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "inactive">("all")
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")

  // Modals state
  const [modalDoctor, setModalDoctor] = useState<Doctor | null | undefined>(undefined) // undefined = closed, null = new, Doctor = edit
  const [queueDoctor, setQueueDoctor] = useState<Doctor | null>(null)
  const [leaveDoctor, setLeaveDoctor] = useState<Doctor | null>(null)
  const [scheduleDoctor, setScheduleDoctor] = useState<Doctor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null)

  // Queries
  const doctorsQuery = useQuery({
    queryKey: ["doctors"],
    queryFn: () => listDoctors({ page_size: 100 }),
  })

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  })

  const doctorsList: Doctor[] = useMemo(() => {
    if (!doctorsQuery.data) return []
    if (Array.isArray(doctorsQuery.data)) return doctorsQuery.data
    return doctorsQuery.data.results ?? []
  }, [doctorsQuery.data])

  const departments: Department[] = departmentsQuery.data ?? []

  // Filtered doctors
  const filteredDoctors = useMemo(() => {
    return doctorsList.filter((doc) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchesName = doc.name.toLowerCase().includes(q)
        const matchesSpec = doc.speciality?.toLowerCase().includes(q)
        const matchesPhone = doc.phone?.toLowerCase().includes(q)
        const matchesEmail = doc.email?.toLowerCase().includes(q)
        const matchesReg = doc.smc_registration_number?.toLowerCase().includes(q)
        if (!matchesName && !matchesSpec && !matchesPhone && !matchesEmail && !matchesReg) {
          return false
        }
      }

      // Department
      if (selectedDept !== "all") {
        if (String(doc.department) !== selectedDept) return false
      }

      // Status
      if (selectedStatus === "active" && !doc.is_active) return false
      if (selectedStatus === "inactive" && doc.is_active) return false

      return true
    })
  }, [doctorsList, search, selectedDept, selectedStatus])

  // Summary Metrics
  const totalDoctors = doctorsList.length
  const activeCount = doctorsList.filter((d) => d.is_active).length
  const inactiveCount = totalDoctors - activeCount
  const specialitiesCount = new Set(doctorsList.map((d) => d.speciality).filter(Boolean)).size

  // Quick inline toggle active status
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateDoctor(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] })
      showToast("Doctor status updated", "success")
    },
    onError: () => {
      showToast("Failed to change status", "error")
    },
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-brand bg-brand-tint px-2 py-0.5 rounded">
              Clinical Team & Staff
            </span>
            <span className="text-ink-5 text-xs">·</span>
            <span className="text-[11px] text-ink-4">OPD & Consultation Roster</span>
          </div>
          <h1 className="text-2xl font-bold text-ink mt-1">Doctors Directory</h1>
          <p className="text-xs text-ink-3 mt-0.5">
            Manage hospital doctors, clinical specialities, appointment slots, live queues, and leave.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => doctorsQuery.refetch()}
            disabled={doctorsQuery.isFetching}
            className="text-xs"
          >
            {doctorsQuery.isFetching ? "Refreshing..." : "↻ Refresh"}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setModalDoctor(null)}
            className="text-xs shadow-xs"
          >
            + Add Doctor
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card padded className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-ink-4 uppercase tracking-wider block">
              Total Doctors
            </span>
            <span className="text-2xl font-bold text-ink mt-1 block">{totalDoctors}</span>
            <span className="text-[10.5px] text-ink-4">Registered physicians</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-brand-tint text-brand flex items-center justify-center font-bold text-lg">
            🩺
          </div>
        </Card>

        <Card padded className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-ink-4 uppercase tracking-wider block">
              Active on Roster
            </span>
            <span className="text-2xl font-bold text-success-text mt-1 block flex items-center gap-2">
              {activeCount}
              <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse inline-block" />
            </span>
            <span className="text-[10.5px] text-ink-4">Available for bookings</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-success-bg text-success-text flex items-center justify-center font-bold text-lg">
            ✓
          </div>
        </Card>

        <Card padded className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-ink-4 uppercase tracking-wider block">
              Inactive / Off-Duty
            </span>
            <span className="text-2xl font-bold text-ink-3 mt-1 block">{inactiveCount}</span>
            <span className="text-[10.5px] text-ink-4">Suspended or off duty</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-page text-ink-4 flex items-center justify-center font-bold text-lg">
            ⏸
          </div>
        </Card>

        <Card padded className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-ink-4 uppercase tracking-wider block">
              Specialities
            </span>
            <span className="text-2xl font-bold text-brand-dark mt-1 block">{specialitiesCount}</span>
            <span className="text-[10.5px] text-ink-4">Distinct departments</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-brand-tint text-brand flex items-center justify-center font-bold text-lg">
            🏥
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card padded className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <span className="absolute left-3 top-2.5 text-ink-4 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search by doctor name, speciality, mobile, SMC Reg #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8.5 pl-8 pr-3 border border-border-strong rounded-control bg-page outline-none focus:border-brand text-xs text-ink"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2 text-ink-4 hover:text-ink text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Department Select */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-4 font-semibold whitespace-nowrap">Dept:</span>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="h-8.5 px-2.5 border border-border-strong rounded-control bg-page text-xs text-ink outline-none focus:border-brand"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Pills */}
          <div className="flex items-center bg-page border border-border rounded-control p-0.5 text-xs">
            <button
              onClick={() => setSelectedStatus("all")}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                selectedStatus === "all" ? "bg-surface text-ink shadow-xs" : "text-ink-4 hover:text-ink"
              }`}
            >
              All ({totalDoctors})
            </button>
            <button
              onClick={() => setSelectedStatus("active")}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                selectedStatus === "active" ? "bg-surface text-success-text shadow-xs" : "text-ink-4 hover:text-ink"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setSelectedStatus("inactive")}
              className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                selectedStatus === "inactive" ? "bg-surface text-ink-3 shadow-xs" : "text-ink-4 hover:text-ink"
              }`}
            >
              Inactive ({inactiveCount})
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-control overflow-hidden">
            <button
              title="Card Grid View"
              onClick={() => setViewMode("grid")}
              className={`w-8 h-8 flex items-center justify-center text-xs transition-colors ${
                viewMode === "grid" ? "bg-brand text-white" : "bg-surface text-ink-4 hover:text-ink"
              }`}
            >
              ⊞
            </button>
            <button
              title="Table View"
              onClick={() => setViewMode("table")}
              className={`w-8 h-8 flex items-center justify-center text-xs transition-colors ${
                viewMode === "table" ? "bg-brand text-white" : "bg-surface text-ink-4 hover:text-ink"
              }`}
            >
              ☰
            </button>
          </div>
        </div>
      </Card>

      {/* Main Content: Doctors Listing */}
      {doctorsQuery.isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingState />
        </div>
      ) : doctorsQuery.isError ? (
        <Card padded className="py-12 text-center text-danger">
          <span className="text-3xl block mb-2">⚠️</span>
          <p className="font-semibold text-sm">Failed to load doctors directory</p>
          <p className="text-xs text-ink-4 mt-1">Please ensure the backend API server is accessible.</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => doctorsQuery.refetch()}
            className="mt-4"
          >
            Retry
          </Button>
        </Card>
      ) : filteredDoctors.length === 0 ? (
        <Card padded className="py-16 text-center text-ink-4 space-y-3">
          <div className="w-12 h-12 rounded-full bg-brand-tint text-brand mx-auto flex items-center justify-center text-xl">
            🩺
          </div>
          <h3 className="text-sm font-bold text-ink">No Doctors Found</h3>
          <p className="text-xs text-ink-3 max-w-sm mx-auto">
            {search || selectedDept !== "all" || selectedStatus !== "all"
              ? "No physicians matched your filter criteria. Try resetting filters."
              : "No doctors have been registered in the system yet. Add your first physician to get started!"}
          </p>
          <div className="pt-2">
            <Button size="sm" variant="primary" onClick={() => setModalDoctor(null)}>
              + Add Doctor
            </Button>
          </div>
        </Card>
      ) : viewMode === "grid" ? (
        /* Grid / Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDoctors.map((doc) => (
            <Card
              key={doc.id}
              className="p-4 flex flex-col justify-between hover:border-brand-border transition-all duration-150 hover:shadow-sm"
            >
              <div className="space-y-3">
                {/* Card Top: Avatar, Name, Status */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={doc.name} size={42} />
                    <div>
                      <h4 className="font-bold text-ink text-sm leading-tight hover:text-brand transition-colors">
                        {doc.name}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-semibold text-brand">{doc.speciality}</span>
                        {doc.degree && (
                          <span className="text-[10px] text-ink-4">({doc.degree})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      doc.is_active
                        ? "bg-success-bg text-success-text border border-success/20"
                        : "bg-chip-bg text-chip-text border border-border"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        doc.is_active ? "bg-success" : "bg-ink-4"
                      }`}
                    />
                    {doc.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {/* Details Badges */}
                <div className="p-2.5 rounded-lg bg-page border border-border space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-4">Department:</span>
                    <span className="font-medium text-ink truncate max-w-[170px]">
                      {doc.department_name ||
                        departments.find((d) => d.id === doc.department)?.name ||
                        "General OPD"}
                    </span>
                  </div>

                  {doc.smc_registration_number && (
                    <div className="flex items-center justify-between">
                      <span className="text-ink-4">SMC Reg #:</span>
                      <span className="font-mono text-ink-2 font-medium">
                        {doc.smc_registration_number}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-ink-4">Consult Slot:</span>
                    <span className="font-medium text-ink">
                      {doc.default_consultation_minutes} mins / patient
                    </span>
                  </div>

                  {(doc.phone || doc.email) && (
                    <div className="pt-1 border-t border-border flex flex-col gap-0.5 text-ink-3">
                      {doc.phone && (
                        <div className="flex items-center gap-1.5 truncate">
                          <span>📞</span>
                          <span className="font-mono">{doc.phone}</span>
                        </div>
                      )}
                      {doc.email && (
                        <div className="flex items-center gap-1.5 truncate">
                          <span>✉️</span>
                          <span className="truncate">{doc.email}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Actions Footer */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-[11px] gap-1"
                    title="View Live OPD Queue"
                    onClick={() => setQueueDoctor(doc)}
                  >
                    🩺 Queue
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-[11px] gap-1"
                    title="Manage Clinic Slots & Templates"
                    onClick={() => setScheduleDoctor(doc)}
                  >
                    📅 Slots
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-[11px] gap-1"
                    title="Block or Unblock Leave"
                    onClick={() => setLeaveDoctor(doc)}
                  >
                    🏖️ Leave
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-ink-3 hover:text-brand"
                    title="Edit Doctor Profile"
                    onClick={() => setModalDoctor(doc)}
                  >
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-danger hover:bg-danger/10"
                    title="Delete Doctor"
                    onClick={() => setDeleteTarget(doc)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Table View */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-page/75 border-b border-border text-ink-4 uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Physician</th>
                  <th className="px-3 py-3">Speciality & Dept</th>
                  <th className="px-3 py-3">Registration & Qualifications</th>
                  <th className="px-3 py-3">Contact</th>
                  <th className="px-3 py-3">Slot Duration</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDoctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-page/50 transition-colors">
                    {/* Physician */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={doc.name} size={32} />
                        <div>
                          <div className="font-bold text-ink hover:text-brand transition-colors">
                            {doc.name}
                          </div>
                          <div className="text-[10px] text-ink-4">ID #{doc.id}</div>
                        </div>
                      </div>
                    </td>

                    {/* Speciality & Dept */}
                    <td className="px-3 py-3">
                      <div className="font-semibold text-brand">{doc.speciality}</div>
                      <div className="text-[10.5px] text-ink-4">
                        {doc.department_name ||
                          departments.find((d) => d.id === doc.department)?.name ||
                          "—"}
                      </div>
                    </td>

                    {/* Registration & Degree */}
                    <td className="px-3 py-3">
                      <div className="font-medium text-ink">{doc.degree || "—"}</div>
                      <div className="font-mono text-[10.5px] text-ink-4">
                        {doc.smc_registration_number || "No SMC Reg"}
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-3 py-3">
                      <div className="font-mono text-ink-2">{doc.phone || "—"}</div>
                      <div className="text-[10.5px] text-ink-4 truncate max-w-[160px]">
                        {doc.email || "—"}
                      </div>
                    </td>

                    {/* Slot Duration */}
                    <td className="px-3 py-3 font-medium text-ink-2">
                      {doc.default_consultation_minutes} mins
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      <button
                        onClick={() =>
                          toggleStatusMutation.mutate({ id: doc.id, is_active: !doc.is_active })
                        }
                        title="Click to toggle status"
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold transition-transform active:scale-95 ${
                          doc.is_active
                            ? "bg-success-bg text-success-text hover:bg-success/20"
                            : "bg-chip-bg text-chip-text hover:bg-border"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            doc.is_active ? "bg-success" : "bg-ink-4"
                          }`}
                        />
                        {doc.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-2 text-[10.5px]"
                          onClick={() => setQueueDoctor(doc)}
                        >
                          Queue
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-2 text-[10.5px]"
                          onClick={() => setScheduleDoctor(doc)}
                        >
                          Slots
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-6 px-2 text-[10.5px]"
                          onClick={() => setLeaveDoctor(doc)}
                        >
                          Leave
                        </Button>
                        <button
                          className="p-1 text-ink-3 hover:text-brand"
                          title="Edit"
                          onClick={() => setModalDoctor(doc)}
                        >
                          ✏️
                        </button>
                        <button
                          className="p-1 text-danger hover:opacity-80"
                          title="Delete"
                          onClick={() => setDeleteTarget(doc)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Render Modals */}
      {modalDoctor !== undefined && (
        <DoctorFormModal
          doctor={modalDoctor}
          departments={departments}
          onClose={() => setModalDoctor(undefined)}
        />
      )}

      {queueDoctor && (
        <DoctorQueueModal
          doctor={queueDoctor}
          onClose={() => setQueueDoctor(null)}
        />
      )}

      {leaveDoctor && (
        <DoctorLeaveModal
          doctor={leaveDoctor}
          onClose={() => setLeaveDoctor(null)}
        />
      )}

      {scheduleDoctor && (
        <DoctorScheduleModal
          doctor={scheduleDoctor}
          onClose={() => setScheduleDoctor(null)}
        />
      )}

      {deleteTarget && (
        <DeleteDoctorModal
          doctor={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
