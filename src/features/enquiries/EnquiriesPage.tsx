import React, { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { NeutralTag, Pill } from "../../components/ui/Pill"
import { Avatar } from "../../components/ui/Avatar"
import { LoadingState } from "../../components/ui/QueryStates"
import {
  createEnquiry,
  exportEnquiriesCsv,
  listEnquiries,
  loseEnquiry,
  mergeEnquiry,
  moveEnquiryStage,
  reassignEnquiry,
  updateEnquiry,
} from "../../api/enquiries"
import { listUsers } from "../../api/accounts"
import { bookAppointment, listDoctors, listSlots } from "../../api/appointments"
import { createPatient, lookupPatientByMobile } from "../../api/patients"
import type { Enquiry, EnquiryStage, EnquirySource } from "../../types/api"
import type { User } from "../../types/api"
import { CreateTreatmentEstimateModal } from "./CreateTreatmentEstimateModal"
import { InboundWebhookModal } from "./InboundWebhookModal"
import { Lead360Modal } from "./Lead360Modal"
import { SurgicalPipelineTab } from "./SurgicalPipelineTab"


const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const STAGES: { key: EnquiryStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "scheduled", label: "Scheduled" },
  { key: "visited", label: "Visited" },
  { key: "completed", label: "Completed" },
  { key: "follow_up", label: "Follow-up" },
]

const SOURCES: EnquirySource[] = ["ivr", "whatsapp", "website", "walk_in", "referral", "google", "meta", "other"]

function NewEnquiryForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState("")
  const [mobile, setMobile] = useState("")
  const [source, setSource] = useState<EnquirySource>("walk_in")
  const [serviceRequested, setServiceRequested] = useState("")
  const [estimatedValue, setEstimatedValue] = useState("")

  const create = useMutation({
    mutationFn: () =>
      createEnquiry({
        name,
        mobile,
        source,
        service_requested: serviceRequested,
        ...(estimatedValue ? { estimated_value: estimatedValue } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface rounded-card p-5 w-[380px]" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold mb-3">New enquiry</div>
        <div className="flex flex-col gap-2.5">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px]" />
          <input placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px] font-mono" />
          <input placeholder="Service requested" value={serviceRequested} onChange={(e) => setServiceRequested(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-[13px]" />
          <input
            placeholder="Estimated value (₹, optional)"
            type="number"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            className="h-9 px-3 border border-border-strong rounded-control text-[13px] font-mono"
          />
          <select value={source} onChange={(e) => setSource(e.target.value as EnquirySource)} className="h-9 px-3 border border-border-strong rounded-control text-[13px]">
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => create.mutate()} disabled={!name || !mobile || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Stage-specific action configs ──────────────────────────────────── */
type StageAction = {
  icon: string
  label: string
  color: string
  title: string
}

const STAGE_ACTIONS: Record<string, StageAction | null> = {
  new: { icon: "📞", label: "Quick Convert", color: "text-blue-600 dark:text-blue-400", title: "Create patient record & optionally schedule OPD" },
  contacted: { icon: "🗓️", label: "Schedule OPD", color: "text-emerald-600 dark:text-emerald-400", title: "Book an OPD appointment for this lead" },
  scheduled: { icon: "🏥", label: "Mark Visited", color: "text-violet-600 dark:text-violet-400", title: "Patient has arrived — mark as visited" },
  visited: { icon: "📋", label: "Create Estimate", color: "text-amber-600 dark:text-amber-400", title: "Create surgical/IPD estimate or convert to billing" },
  completed: null, // No action needed
  follow_up: { icon: "🔄", label: "Re-engage", color: "text-teal-600 dark:text-teal-400", title: "Re-schedule appointment for follow-up" },
}

/* ─── Modal wrapper (shared backdrop) ────────────────────────────────── */
function ModalShell({ onClose, title, subtitle, children }: { onClose: () => void; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-surface border border-border-strong rounded-xl p-6 w-full max-w-lg shadow-2xl my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-ink">{title}</h3>
            <p className="text-xs text-ink-4">{subtitle}</p>
          </div>
          <button onClick={onClose} className="text-ink-4 hover:text-ink text-sm p-1">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SuccessBanner({ message, details, onClose }: { message: string; details: { label: string; value: string; color?: string }[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border-strong rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl mx-auto">✓</div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-ink">{message}</h3>
        </div>
        <div className="bg-page/60 border border-border rounded-lg p-3 text-xs space-y-1.5 font-mono">
          {details.map((d, i) => (
            <div key={i} className="flex justify-between text-ink-3">
              <span>{d.label}:</span>
              <span className={d.color || "text-ink font-bold"}>{d.value}</span>
            </div>
          ))}
        </div>
        <Button variant="primary" className="w-full" onClick={onClose}>Done & Close</Button>
      </div>
    </div>
  )
}

/* ─── Stage: NEW → Quick Convert (Create Patient + optional OPD) ───── */
function NewStageModal({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const queryClient = useQueryClient()
  const nameParts = enquiry.name.trim().split(/\s+/)
  const [firstName, setFirstName] = useState(nameParts[0] || "")
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" ") || "")
  const [gender, setGender] = useState<"male" | "female" | "other">("other")
  const [isSuccess, setIsSuccess] = useState(false)
  const [createdUhid, setCreatedUhid] = useState("")

  const patientLookup = useQuery({
    queryKey: ["patients", "lookup", enquiry.mobile],
    queryFn: () => lookupPatientByMobile(enquiry.mobile),
  })
  const existingPatient = patientLookup.data?.[0]
  const [useExisting, setUseExisting] = useState(true)

  const convertMutation = useMutation({
    mutationFn: async () => {
      let patientId: number
      let uhid = ""
      if (existingPatient && useExisting) {
        patientId = existingPatient.id
        uhid = `MRN #${existingPatient.id}`
      } else {
        const created = await createPatient({
          first_name: firstName || enquiry.name,
          last_name: lastName,
          mobile: enquiry.mobile,
          gender: gender as any,
          preferred_language: "mr",
        })
        patientId = created.id
        uhid = created.uhid || `MRN #${created.id}`
      }
      await updateEnquiry(enquiry.id, { patient: patientId })
      await moveEnquiryStage(enquiry.id, "contacted")
      return uhid
    },
    onSuccess: (uhid) => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      queryClient.invalidateQueries({ queryKey: ["patients"] })
      setCreatedUhid(uhid)
      setIsSuccess(true)
    },
  })

  if (isSuccess) {
    return (
      <SuccessBanner
        message="Patient Created & Lead Contacted!"
        details={[
          { label: "Patient UHID", value: createdUhid },
          { label: "Pipeline Stage", value: "Contacted", color: "text-blue-600 dark:text-blue-400 font-bold" },
          { label: "Next Step", value: "Schedule an OPD appointment", color: "text-ink-3" },
        ]}
        onClose={onClose}
      />
    )
  }

  return (
    <ModalShell onClose={onClose} title="Quick Convert — Create Patient Record" subtitle={`Lead #${enquiry.id}: ${enquiry.name} (${enquiry.mobile})`}>
      <div className="flex flex-col gap-3.5 mt-4">
        <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
          💡 This will create a patient record and move the lead to <strong>Contacted</strong>. You can schedule an OPD appointment in the next step.
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink uppercase tracking-wider">Patient Profile</label>
          {existingPatient && useExisting ? (
            <div className="p-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-teal-800 dark:text-teal-200">Existing Patient Matched</div>
                <div className="text-teal-600 dark:text-teal-400 mt-0.5">
                  {existingPatient.full_name} (MRN #{existingPatient.id} • {existingPatient.mobile})
                </div>
              </div>
              <button type="button" onClick={() => setUseExisting(false)} className="text-xs font-semibold text-brand hover:underline">Create New Instead</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-xs bg-page" />
              <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-9 px-3 border border-border-strong rounded-control text-xs bg-page" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-4">Gender:</span>
                <select value={gender} onChange={(e) => setGender(e.target.value as any)} className="h-9 flex-1 px-2 border border-border-strong rounded-control text-xs bg-page">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <input value={enquiry.mobile} disabled className="h-9 px-3 border border-border rounded-control text-xs bg-page/50 text-ink-4 font-mono" title="Mobile from enquiry" />
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-5 pt-3 border-t border-border justify-end">
        <Button variant="secondary" onClick={onClose} disabled={convertMutation.isPending}>Cancel</Button>
        <Button variant="primary" onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
          {convertMutation.isPending ? "Creating…" : "Create Patient & Mark Contacted"}
        </Button>
      </div>
    </ModalShell>
  )
}

/* ─── Stage: CONTACTED → Schedule OPD Appointment ───────────────────── */
function ContactedStageModal({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | "">("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedSlotId, setSelectedSlotId] = useState<number | "">("")
  const [reason, setReason] = useState(enquiry.service_requested || "Consultation from CRM enquiry")
  const [isSuccess, setIsSuccess] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ appointmentTime: string } | null>(null)

  const doctors = useQuery({ queryKey: ["doctors"], queryFn: listDoctors })
  const slots = useQuery({
    queryKey: ["slots", selectedDoctorId, selectedDate],
    queryFn: () => listSlots({ doctor: String(selectedDoctorId), date: selectedDate }),
    enabled: Boolean(selectedDoctorId && selectedDate),
  })
  const availableSlots = (slots.data?.results ?? []).filter((s) => !s.is_booked && !s.is_blocked)

  // If no patient linked yet, we need to create one
  const patientLookup = useQuery({
    queryKey: ["patients", "lookup", enquiry.mobile],
    queryFn: () => lookupPatientByMobile(enquiry.mobile),
    enabled: !enquiry.patient,
  })

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      let patientId = enquiry.patient
      // Auto-create patient if not linked
      if (!patientId) {
        const existing = patientLookup.data?.[0]
        if (existing) {
          patientId = existing.id
        } else {
          const nameParts = enquiry.name.trim().split(/\s+/)
          const created = await createPatient({
            first_name: nameParts[0] || enquiry.name,
            last_name: nameParts.slice(1).join(" "),
            mobile: enquiry.mobile,
            gender: "other" as any,
            preferred_language: "mr",
          })
          patientId = created.id
        }
        await updateEnquiry(enquiry.id, { patient: patientId })
      }

      await bookAppointment({
        patient: patientId!,
        slot: Number(selectedSlotId),
        source: "crm",
        reason: reason || "Consultation from CRM enquiry",
      })
      // Save which doctor was selected for this lead
      if (selectedDoctorId) {
        await updateEnquiry(enquiry.id, { consulting_doctor: Number(selectedDoctorId) })
      }
      await moveEnquiryStage(enquiry.id, "scheduled")
      return { slot: availableSlots.find((s) => s.id === Number(selectedSlotId)) }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      queryClient.invalidateQueries({ queryKey: ["patients"] })
      setIsSuccess(true)
      setSuccessInfo({ appointmentTime: data.slot ? `${selectedDate} ${data.slot.start_time}` : selectedDate })
    },
  })

  if (isSuccess && successInfo) {
    return (
      <SuccessBanner
        message="OPD Appointment Scheduled!"
        details={[
          { label: "Enquiry", value: `#${enquiry.id} — ${enquiry.name}` },
          { label: "Appointment", value: successInfo.appointmentTime, color: "text-brand font-semibold" },
          { label: "Pipeline Stage", value: "Scheduled", color: "text-emerald-600 dark:text-emerald-400 font-bold" },
        ]}
        onClose={onClose}
      />
    )
  }

  return (
    <ModalShell onClose={onClose} title="Schedule OPD Appointment" subtitle={`Lead #${enquiry.id}: ${enquiry.name} (${enquiry.mobile})`}>
      <div className="flex flex-col gap-3.5 mt-4">
        {!enquiry.patient && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
            ⚠️ No patient record linked yet. One will be auto-created when you schedule.
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink uppercase tracking-wider">OPD Appointment</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Select Doctor</label>
              <select
                value={selectedDoctorId}
                onChange={(e) => { setSelectedDoctorId(e.target.value ? Number(e.target.value) : ""); setSelectedSlotId("") }}
                className="w-full h-9 px-2 border border-border-strong rounded-control text-xs bg-page"
              >
                <option value="">Choose a doctor…</option>
                {(doctors.data?.results ?? []).map((doc) => (
                  <option key={doc.id} value={doc.id}>Dr. {doc.name} ({doc.speciality})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Appointment Date</label>
              <input
                type="date" value={selectedDate} min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlotId("") }}
                className="w-full h-9 px-3 border border-border-strong rounded-control text-xs bg-page"
              />
            </div>
          </div>

          {selectedDoctorId && (
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Available Time Slots ({availableSlots.length} available)</label>
              {slots.isLoading ? (
                <div className="text-xs text-ink-4 py-2">Loading slots…</div>
              ) : availableSlots.length === 0 ? (
                <div className="text-xs text-warning py-2 bg-warning-tint/30 px-2 rounded">No free slots found for this date.</div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 border border-border rounded">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id} type="button" onClick={() => setSelectedSlotId(slot.id)}
                      className={`py-1 px-1.5 text-center font-mono text-[11px] rounded border transition-colors ${
                        selectedSlotId === slot.id
                          ? "bg-brand text-white border-brand font-bold"
                          : "bg-surface border-border-soft hover:border-brand text-ink"
                      }`}
                    >
                      {slot.start_time.slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Reason / Clinical Notes</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for visit or chief complaint..."
              className="w-full h-9 px-3 border border-border-strong rounded-control text-xs bg-page" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-5 pt-3 border-t border-border justify-end">
        <Button variant="secondary" onClick={onClose} disabled={scheduleMutation.isPending}>Cancel</Button>
        <Button variant="primary" onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending || !selectedSlotId}>
          {scheduleMutation.isPending ? "Scheduling…" : "Confirm OPD Booking"}
        </Button>
      </div>
    </ModalShell>
  )
}

/* ─── Stage: SCHEDULED → Mark Visited (Quick Confirmation) ──────────── */
function ScheduledStageModal({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)

  const visitMutation = useMutation({
    mutationFn: async () => {
      if (notes) await updateEnquiry(enquiry.id, { notes: `${enquiry.notes}\n[Visit] ${notes}`.trim() })
      await moveEnquiryStage(enquiry.id, "visited")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      setIsSuccess(true)
    },
  })

  if (isSuccess) {
    return (
      <SuccessBanner
        message="Patient Visit Confirmed!"
        details={[
          { label: "Lead", value: `#${enquiry.id} — ${enquiry.name}` },
          { label: "Stage", value: "Visited ✓", color: "text-violet-600 dark:text-violet-400 font-bold" },
          { label: "Next Step", value: "Create Surgical Estimate or complete", color: "text-ink-3" },
        ]}
        onClose={onClose}
      />
    )
  }

  return (
    <ModalShell onClose={onClose} title="Confirm Patient Visit" subtitle={`Lead #${enquiry.id}: ${enquiry.name} (${enquiry.mobile})`}>
      <div className="flex flex-col gap-3.5 mt-4">
        <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-xs text-violet-700 dark:text-violet-300">
          🏥 Patient <strong>{enquiry.name}</strong> has arrived at the hospital. Confirming visit moves lead to <strong>Visited</strong> stage.
        </div>
        <div>
          <label className="text-[11px] text-ink-4 block mb-1">Visit Notes (optional)</label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            placeholder="E.g., Arrived for OPD consultation with Dr. Sharma, chief complaint: knee pain..."
            className="w-full px-3 py-2 border border-border-strong rounded-control text-xs bg-page resize-none"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-5 pt-3 border-t border-border justify-end">
        <Button variant="secondary" onClick={onClose} disabled={visitMutation.isPending}>Cancel</Button>
        <Button variant="primary" onClick={() => visitMutation.mutate()} disabled={visitMutation.isPending}>
          {visitMutation.isPending ? "Confirming…" : "✓ Confirm Visit"}
        </Button>
      </div>
    </ModalShell>
  )
}

/* ─── Stage: VISITED → Create Surgical Estimate / IPD Conversion ──── */
function VisitedStageModal({ enquiry, onClose, onCreateEstimate }: { enquiry: Enquiry; onClose: () => void; onCreateEstimate: () => void }) {
  const queryClient = useQueryClient()
  const [isSuccess, setIsSuccess] = useState(false)

  const completeMutation = useMutation({
    mutationFn: () => moveEnquiryStage(enquiry.id, "completed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      setIsSuccess(true)
    },
  })

  if (isSuccess) {
    return (
      <SuccessBanner
        message="Enquiry Completed!"
        details={[
          { label: "Lead", value: `#${enquiry.id} — ${enquiry.name}` },
          { label: "Stage", value: "Completed ✓", color: "text-emerald-600 dark:text-emerald-400 font-bold" },
        ]}
        onClose={onClose}
      />
    )
  }

  return (
    <ModalShell onClose={onClose} title="Post-Visit Actions" subtitle={`Lead #${enquiry.id}: ${enquiry.name} — What happened after the visit?`}>
      <div className="flex flex-col gap-3 mt-4">
        <button
          onClick={() => { onClose(); onCreateEstimate() }}
          className="w-full p-4 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 hover:border-amber-400 dark:hover:border-amber-600 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏥</span>
            <div>
              <div className="text-sm font-bold text-amber-800 dark:text-amber-200 group-hover:text-amber-900 dark:group-hover:text-amber-100">Create Surgical / IPD Estimate</div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Doctor advised surgery or admission — create a treatment estimate with cost breakdown & insurance pre-auth</div>
            </div>
          </div>
        </button>
        <button
          onClick={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
          className="w-full p-4 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <div className="text-sm font-bold text-emerald-800 dark:text-emerald-200 group-hover:text-emerald-900 dark:group-hover:text-emerald-100">
                {completeMutation.isPending ? "Completing…" : "Mark OPD Completed"}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Consultation done, no further admission needed — close this lead as successfully completed</div>
            </div>
          </div>
        </button>
        <button
          onClick={() => { onClose(); /* move to follow_up */ moveEnquiryStage(enquiry.id, "follow_up").then(() => queryClient.invalidateQueries({ queryKey: ["enquiries"] })) }}
          className="w-full p-3 rounded-lg border border-border bg-page hover:border-border-strong transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📅</span>
            <div>
              <div className="text-xs font-bold text-ink group-hover:text-brand">Move to Follow-up</div>
              <div className="text-[11px] text-ink-4 mt-0.5">Patient needs a follow-up visit or lab results — track for re-engagement</div>
            </div>
          </div>
        </button>
      </div>
    </ModalShell>
  )
}

/* ─── Stage: FOLLOW_UP → Re-engage / Re-schedule ────────────────────── */
function FollowUpStageModal({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | "">("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedSlotId, setSelectedSlotId] = useState<number | "">("")
  const [callbackDate, setCallbackDate] = useState(enquiry.follow_up_date || new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState("Follow-up consultation")
  const [isSuccess, setIsSuccess] = useState(false)

  const doctors = useQuery({ queryKey: ["doctors"], queryFn: listDoctors })
  const slots = useQuery({
    queryKey: ["slots", selectedDoctorId, selectedDate],
    queryFn: () => listSlots({ doctor: String(selectedDoctorId), date: selectedDate }),
    enabled: Boolean(selectedDoctorId && selectedDate),
  })
  const availableSlots = (slots.data?.results ?? []).filter((s) => !s.is_booked && !s.is_blocked)

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      const patientId = enquiry.patient
      if (!patientId) throw new Error("No patient linked")
      await bookAppointment({
        patient: patientId,
        slot: Number(selectedSlotId),
        source: "crm",
        reason: reason || "Follow-up consultation",
      })
      // Update consulting doctor & clear callback date for follow-up
      if (selectedDoctorId) {
        await updateEnquiry(enquiry.id, { consulting_doctor: Number(selectedDoctorId), follow_up_date: null })
      }
      await moveEnquiryStage(enquiry.id, "scheduled")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      setIsSuccess(true)
    },
  })

  const saveCallbackMutation = useMutation({
    mutationFn: async () => {
      await updateEnquiry(enquiry.id, {
        follow_up_date: callbackDate || null,
        notes: reason ? (enquiry.notes ? `${enquiry.notes}\n[Callback Scheduled]: ${reason}` : `[Callback Scheduled]: ${reason}`) : enquiry.notes,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      onClose()
    },
  })

  if (isSuccess) {
    return (
      <SuccessBanner
        message="Follow-up Appointment Scheduled!"
        details={[
          { label: "Lead", value: `#${enquiry.id} — ${enquiry.name}` },
          { label: "Stage", value: "Re-scheduled → Scheduled", color: "text-teal-600 dark:text-teal-400 font-bold" },
        ]}
        onClose={onClose}
      />
    )
  }

  return (
    <ModalShell onClose={onClose} title="Re-engage — Schedule Follow-up" subtitle={`Lead #${enquiry.id}: ${enquiry.name} (${enquiry.mobile})`}>
      <div className="flex flex-col gap-3.5 mt-4">
        {/* Quick Callback Date Picker */}
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200 block">⏰ Set Tele-Caller Callback Date</span>
              <span className="text-[11px] text-amber-700 dark:text-amber-400">If patient isn't booking right now, set when to call them back</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
                className="h-8 px-2 border border-amber-300 dark:border-amber-700 rounded text-xs bg-surface"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={saveCallbackMutation.isPending}
                onClick={() => saveCallbackMutation.mutate()}
              >
                {saveCallbackMutation.isPending ? "Saving…" : "Save Callback Only"}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-xs text-teal-700 dark:text-teal-300">
          🔄 Or book a direct follow-up consultation below to move this lead back to <strong>Scheduled</strong>.
        </div>

        {!enquiry.patient && (
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            ❌ No patient record linked. Please convert the lead first before re-scheduling.
          </div>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Select Doctor</label>
              <select
                value={selectedDoctorId}
                onChange={(e) => { setSelectedDoctorId(e.target.value ? Number(e.target.value) : ""); setSelectedSlotId("") }}
                className="w-full h-9 px-2 border border-border-strong rounded-control text-xs bg-page"
              >
                <option value="">Choose a doctor…</option>
                {(doctors.data?.results ?? []).map((doc) => (
                  <option key={doc.id} value={doc.id}>Dr. {doc.name} ({doc.speciality})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Date</label>
              <input type="date" value={selectedDate} min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => { setSelectedDate(e.target.value); setSelectedSlotId("") }}
                className="w-full h-9 px-3 border border-border-strong rounded-control text-xs bg-page" />
            </div>
          </div>

          {selectedDoctorId && (
            <div>
              <label className="text-[11px] text-ink-4 block mb-1">Slots ({availableSlots.length})</label>
              {slots.isLoading ? (
                <div className="text-xs text-ink-4 py-2">Loading…</div>
              ) : availableSlots.length === 0 ? (
                <div className="text-xs text-warning py-2 bg-warning-tint/30 px-2 rounded">No free slots.</div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 border border-border rounded">
                  {availableSlots.map((slot) => (
                    <button key={slot.id} type="button" onClick={() => setSelectedSlotId(slot.id)}
                      className={`py-1 px-1.5 text-center font-mono text-[11px] rounded border transition-colors ${
                        selectedSlotId === slot.id
                          ? "bg-brand text-white border-brand font-bold"
                          : "bg-surface border-border-soft hover:border-brand text-ink"
                      }`}
                    >{slot.start_time.slice(0, 5)}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-[11px] text-ink-4 block mb-1">Reason / Notes</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-9 px-3 border border-border-strong rounded-control text-xs bg-page" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-5 pt-3 border-t border-border justify-end">
        <Button variant="secondary" onClick={onClose} disabled={rescheduleMutation.isPending}>Cancel</Button>
        <Button variant="primary" onClick={() => rescheduleMutation.mutate()} disabled={rescheduleMutation.isPending || !selectedSlotId || !enquiry.patient}>
          {rescheduleMutation.isPending ? "Scheduling…" : "Schedule Consultation"}
        </Button>
      </div>
    </ModalShell>
  )
}

/* ─── Stage-Aware Action Router ─────────────────────────────────────── */
function StageActionModal({ enquiry, onClose, onCreateEstimate }: { enquiry: Enquiry; onClose: () => void; onCreateEstimate: () => void }) {
  switch (enquiry.stage) {
    case "new": return <NewStageModal enquiry={enquiry} onClose={onClose} />
    case "contacted": return <ContactedStageModal enquiry={enquiry} onClose={onClose} />
    case "scheduled": return <ScheduledStageModal enquiry={enquiry} onClose={onClose} />
    case "visited": return <VisitedStageModal enquiry={enquiry} onClose={onClose} onCreateEstimate={onCreateEstimate} />
    case "follow_up": return <FollowUpStageModal enquiry={enquiry} onClose={onClose} />
    default: return null
  }
}

/* ─── Enquiry Card with stage-aware actions ──────────────────────────── */
function EnquiryCard({
  enquiry,
  ownerName,
  users,
  onCreateEstimate,
  onOpen360,
}: {
  enquiry: Enquiry
  ownerName: string | null
  users: User[]
  onCreateEstimate: () => void
  onOpen360: (enquiry: Enquiry) => void
}) {
  const queryClient = useQueryClient()
  const [isReassigning, setIsReassigning] = useState(false)
  const [isActioning, setIsActioning] = useState(false)
  const currentIndex = STAGES.findIndex((s) => s.key === enquiry.stage)
  const nextStage = STAGES[currentIndex + 1]
  const stageAction = STAGE_ACTIONS[enquiry.stage]

  const move = useMutation({
    mutationFn: (stage: EnquiryStage) => moveEnquiryStage(enquiry.id, stage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enquiries"] }),
  })
  const lose = useMutation({
    mutationFn: () => loseEnquiry(enquiry.id, "not_interested"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enquiries"] }),
  })
  const reassign = useMutation({
    mutationFn: (ownerId: number) => reassignEnquiry(enquiry.id, ownerId, "manual reassignment"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      setIsReassigning(false)
    },
  })
  const merge = useMutation({
    mutationFn: () => mergeEnquiry(enquiry.id, enquiry.duplicate_of!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["enquiries"] }),
  })

  const slaBreached = enquiry.sla_due_at && new Date(enquiry.sla_due_at).getTime() < Date.now()

  return (
    <div className="bg-surface border border-border rounded-[5px] p-2.5 hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div
          className="text-[13px] font-semibold leading-tight text-ink hover:text-brand cursor-pointer hover:underline"
          onClick={() => onOpen360(enquiry)}
          title="Click to view Lead 360° Profile & Audit History"
        >
          {enquiry.name}
        </div>
        <button onClick={() => setIsReassigning((v) => !v)} title="Reassign owner">
          {ownerName ? <Avatar name={ownerName} size={20} /> : <span className="text-[10px] text-ink-5 underline">assign</span>}
        </button>
      </div>
      {enquiry.service_requested && <div className="text-[12px] text-ink-3 mt-1">{enquiry.service_requested}</div>}
      <div className="text-[11.5px] text-ink-4 mt-0.5 font-mono">{enquiry.mobile}</div>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <NeutralTag>{enquiry.source}</NeutralTag>
        {enquiry.utm_source && <NeutralTag>{enquiry.utm_source}{enquiry.utm_medium ? `/${enquiry.utm_medium}` : ""}</NeutralTag>}
        {enquiry.score > 0 && <NeutralTag>score {enquiry.score}</NeutralTag>}
        {enquiry.duplicate_of && <NeutralTag>dup</NeutralTag>}
        {enquiry.urgency !== "normal" && <NeutralTag>{enquiry.urgency}</NeutralTag>}
        {enquiry.estimated_value && <NeutralTag>{INR.format(Number(enquiry.estimated_value))}</NeutralTag>}
        {enquiry.patient && <NeutralTag>✓ Patient #{enquiry.patient}</NeutralTag>}
        {enquiry.consulting_doctor_name && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            🩺 {enquiry.consulting_doctor_name.startsWith("Dr.") ? enquiry.consulting_doctor_name : `Dr. ${enquiry.consulting_doctor_name}`}
          </span>
        )}
        {enquiry.follow_up_date && (() => {
          const today = new Date().toISOString().slice(0, 10)
          const isDue = enquiry.follow_up_date <= today
          return (
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10.5px] font-semibold border ${
                isDue
                  ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 font-bold animate-pulse"
                  : "bg-surface text-ink-3 border-border"
              }`}
            >
              ⏰ {isDue ? "Callback Due" : enquiry.follow_up_date}
            </span>
          )
        })()}
        {slaBreached && <Pill tone="bad">SLA breached</Pill>}
      </div>
      {isReassigning && (
        <select
          autoFocus
          defaultValue=""
          onChange={(e) => e.target.value && reassign.mutate(Number(e.target.value))}
          onBlur={() => setIsReassigning(false)}
          disabled={reassign.isPending}
          className="w-full h-7 mt-2 px-1.5 border border-border-strong rounded-control bg-surface text-[11.5px]"
        >
          <option value="">Reassign to…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.first_name || u.email}</option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {nextStage && (
          <button
            onClick={() => move.mutate(nextStage.key)}
            disabled={move.isPending}
            className="text-[11px] font-semibold text-brand hover:underline"
          >
            → {nextStage.label}
          </button>
        )}
        {stageAction && (
          <button
            onClick={() => setIsActioning(true)}
            className={`text-[11px] font-semibold ${stageAction.color} hover:underline flex items-center gap-0.5`}
            title={stageAction.title}
          >
            <span>{stageAction.icon} {stageAction.label}</span>
          </button>
        )}
        <button
          onClick={() => onOpen360(enquiry)}
          className="text-[11px] font-semibold text-ink-4 hover:text-brand flex items-center gap-0.5"
          title="View full Lead 360° Profile, attribution, and notes"
        >
          <span>🔍 360°</span>
        </button>
        {enquiry.duplicate_of && (
          <button onClick={() => merge.mutate()} disabled={merge.isPending} className="text-[11px] font-semibold text-brand hover:underline">
            Merge into #{enquiry.duplicate_of}
          </button>
        )}
        <div className="flex-1" />
        <div className="text-[11px] text-ink-5">{relativeAge(enquiry.created_at)}</div>
        <button onClick={() => lose.mutate()} disabled={lose.isPending} className="text-[11px] text-ink-5 hover:text-danger-text">
          Mark lost
        </button>
      </div>

      {isActioning && (
        <StageActionModal enquiry={enquiry} onClose={() => setIsActioning(false)} onCreateEstimate={onCreateEstimate} />
      )}
    </div>
  )
}


export function EnquiriesPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<"leads" | "surgical">("leads")
  const [showNew, setShowNew] = useState(false)
  const [showWebhookModal, setShowWebhookModal] = useState(false)
  const [showEstimateModal, setShowEstimateModal] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [deptFilter, setDeptFilter] = useState<number | "all">("all")
  const [sourceFilter, setSourceFilter] = useState<EnquirySource | "all">("all")
  const [ownerFilter, setOwnerFilter] = useState<number | "all">("all")
  const [slaOnly, setSlaOnly] = useState(false)
  const [callbacksOnly, setCallbacksOnly] = useState(false)
  const [selected360Enquiry, setSelected360Enquiry] = useState<Enquiry | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const enquiries = useQuery({ queryKey: ["enquiries"], queryFn: () => listEnquiries({ page_size: "200" }) })
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers })

  const ownerName = (id: number | null) => {
    if (!id) return null
    const u = users.data?.results.find((u) => u.id === id)
    return u ? u.first_name || u.email : `#${id}`
  }

  const all = enquiries.data?.results ?? []
  const open = all.filter((e) => e.stage !== "lost")

  const todayStr = new Date().toISOString().slice(0, 10)
  const callbacksDueCount = open.filter((e) => e.follow_up_date && e.follow_up_date <= todayStr).length

  const departments = useMemo(
    () => Array.from(new Set(open.map((e) => e.department).filter((d): d is number => d != null))),
    [open],
  )
  const owners = useMemo(
    () => Array.from(new Set(open.map((e) => e.assigned_to).filter((o): o is number => o != null))),
    [open],
  )
  const slaBreachedCount = open.filter((e) => e.sla_due_at && new Date(e.sla_due_at).getTime() < Date.now()).length

  const filtered = open.filter((e) => {
    if (deptFilter !== "all" && e.department !== deptFilter) return false
    if (sourceFilter !== "all" && e.source !== sourceFilter) return false
    if (ownerFilter !== "all" && e.assigned_to !== ownerFilter) return false
    if (slaOnly && !(e.sla_due_at && new Date(e.sla_due_at).getTime() < Date.now())) return false
    if (callbacksOnly && !(e.follow_up_date && e.follow_up_date <= todayStr)) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchesName = e.name.toLowerCase().includes(q)
      const matchesMobile = e.mobile.includes(q) || (e.alternate_mobile && e.alternate_mobile.includes(q))
      const matchesService = (e.service_requested || "").toLowerCase().includes(q)
      const matchesDoc = (e.consulting_doctor_name || "").toLowerCase().includes(q)
      const matchesNotes = (e.notes || "").toLowerCase().includes(q)
      if (!matchesName && !matchesMobile && !matchesService && !matchesDoc && !matchesNotes) return false
    }
    return true
  })

  const pipelineValue = filtered.reduce((sum, e) => sum + (e.estimated_value ? Number(e.estimated_value) : 0), 0)

  if (enquiries.isLoading) return <LoadingState />

  return (
    <div className="flex flex-col gap-3.5">
      {/* Top Header & Tab Controls */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("leads")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "leads"
                ? "bg-teal-600 text-white shadow-sm dark:bg-teal-500"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            📋 OPD & Inbound Leads ({open.length})
          </button>
          <button
            onClick={() => setActiveTab("surgical")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "surgical"
                ? "bg-teal-600 text-white shadow-sm dark:bg-teal-500"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <span>🏥</span> Surgical & IPD Pipeline
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            disabled={isExporting}
            onClick={async () => {
              setIsExporting(true)
              try {
                await exportEnquiriesCsv({
                  ...(deptFilter !== "all" ? { department: String(deptFilter) } : {}),
                  ...(sourceFilter !== "all" ? { source: sourceFilter } : {}),
                  ...(ownerFilter !== "all" ? { assigned_to: String(ownerFilter) } : {}),
                })
              } finally {
                setIsExporting(false)
              }
            }}
            className="border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
          >
            {isExporting ? "Exporting…" : "📥 Export CSV"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowWebhookModal(true)}
            className="border border-slate-200 dark:border-slate-800 text-teal-700 dark:text-teal-400"
          >
            ⚡ Inbound Webhooks
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowEstimateModal(true)}
          >
            + New Surgical Estimate
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowNew(true)}
          >
            + New Lead
          </Button>
        </div>
      </div>

      {activeTab === "surgical" ? (
        <SurgicalPipelineTab onNewEstimate={() => setShowEstimateModal(true)} />
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[220px] max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search name, phone, procedure..."
                className="w-full h-[30px] pl-3 pr-7 border border-border-strong rounded-control bg-surface text-[12px] placeholder:text-ink-4 focus:outline-hidden focus:border-brand"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink text-xs p-0.5"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex gap-1.5 flex-wrap">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="h-[30px] px-2.5 border border-border-strong rounded-control bg-surface text-[12.5px] text-ink-3"
              >
                <option value="all">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>Dept #{d}</option>
                ))}
              </select>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as EnquirySource | "all")}
                className="h-[30px] px-2.5 border border-border-strong rounded-control bg-surface text-[12.5px] text-ink-3"
              >
                <option value="all">All sources</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="h-[30px] px-2.5 border border-border-strong rounded-control bg-surface text-[12.5px] text-ink-3"
              >
                <option value="all">Owner: anyone</option>
                {owners.map((o) => (
                  <option key={o} value={o}>{ownerName(o)}</option>
                ))}
              </select>
              <button
                onClick={() => setCallbacksOnly((v) => !v)}
                className={`h-[30px] px-2.5 rounded-control text-[12.5px] font-semibold border transition-colors ${
                  callbacksOnly
                    ? "bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold"
                    : "bg-surface border-border-strong text-ink-3 hover:border-amber-400"
                }`}
              >
                ⏰ Callbacks Due · {callbacksDueCount}
              </button>
              <button
                onClick={() => setSlaOnly((v) => !v)}
                className={`h-[30px] px-2.5 rounded-control text-[12.5px] font-semibold border ${
                  slaOnly ? "bg-danger-bg border-danger-border text-danger-text" : "bg-surface border-border-strong text-ink-3"
                }`}
              >
                SLA breached · {slaBreachedCount}
              </button>
            </div>
            <div className="flex-1" />
            <div className="text-[12.5px] text-ink-4">{filtered.length} open · {INR.format(pipelineValue)} pipeline value</div>
          </div>

          <div className="grid grid-cols-6 gap-3 items-start min-w-[1020px]">
            {STAGES.map((stage) => {
              const cards = filtered.filter((e) => e.stage === stage.key)
              return (
                <div key={stage.key} className="bg-page border border-border rounded-card p-2.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="text-[12px] font-bold">{stage.label}</div>
                    <div className="text-[11.5px] text-ink-4 font-semibold">{cards.length}</div>
                  </div>
                  {cards.map((e) => (
                    <EnquiryCard
                      key={e.id}
                      enquiry={e}
                      ownerName={ownerName(e.assigned_to)}
                      users={users.data?.results ?? []}
                      onCreateEstimate={() => setShowEstimateModal(true)}
                      onOpen360={(enquiry) => setSelected360Enquiry(enquiry)}
                    />
                  ))}
                  {cards.length === 0 && <div className="text-[11.5px] text-ink-5 px-1">—</div>}
                </div>
              )
            })}
          </div>
        </>
      )}

      {showNew && <NewEnquiryForm onClose={() => setShowNew(false)} />}
      <InboundWebhookModal
        open={showWebhookModal}
        onClose={() => setShowWebhookModal(false)}
        onLeadCaptured={() => enquiries.refetch()}
      />
      <CreateTreatmentEstimateModal
        open={showEstimateModal}
        onClose={() => setShowEstimateModal(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["treatment-estimates"] })}
      />
      {selected360Enquiry && (
        <Lead360Modal
          enquiry={selected360Enquiry}
          ownerName={ownerName(selected360Enquiry.assigned_to)}
          onClose={() => setSelected360Enquiry(null)}
        />
      )}
    </div>
  )
}

