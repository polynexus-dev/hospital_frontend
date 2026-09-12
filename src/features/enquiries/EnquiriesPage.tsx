import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "../../components/ui/Button"
import { NeutralTag, Pill } from "../../components/ui/Pill"
import { Avatar } from "../../components/ui/Avatar"
import { LoadingState } from "../../components/ui/QueryStates"
import {
  createEnquiry,
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

function ConvertEnquiryModal({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const queryClient = useQueryClient()
  const nameParts = enquiry.name.trim().split(/\s+/)
  const defaultFirstName = nameParts[0] || ""
  const defaultLastName = nameParts.slice(1).join(" ") || ""

  const [firstName, setFirstName] = useState(defaultFirstName)
  const [lastName, setLastName] = useState(defaultLastName)
  const [gender, setGender] = useState<"male" | "female" | "other">("other")
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | "">("")
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedSlotId, setSelectedSlotId] = useState<number | "">("")
  const [reason, setReason] = useState(enquiry.service_requested || "Consultation from CRM enquiry")
  const [isSuccess, setIsSuccess] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ uhid: string; appointmentTime: string } | null>(null)

  // Check if patient already exists for this mobile
  const patientLookup = useQuery({
    queryKey: ["patients", "lookup", enquiry.mobile],
    queryFn: () => lookupPatientByMobile(enquiry.mobile),
  })

  const existingPatient = patientLookup.data?.[0]
  const [useExisting, setUseExisting] = useState(true)

  const doctors = useQuery({
    queryKey: ["doctors"],
    queryFn: listDoctors,
  })

  const slots = useQuery({
    queryKey: ["slots", selectedDoctorId, selectedDate],
    queryFn: () => listSlots({ doctor: String(selectedDoctorId), date: selectedDate }),
    enabled: Boolean(selectedDoctorId && selectedDate),
  })

  const availableSlots = (slots.data?.results ?? []).filter((s) => !s.is_booked && !s.is_blocked)

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

      if (selectedSlotId) {
        await bookAppointment({
          patient: patientId,
          slot: Number(selectedSlotId),
          source: "crm",
          reason: reason || "Consultation from CRM enquiry",
        })
      }

      await updateEnquiry(enquiry.id, { patient: patientId })
      await moveEnquiryStage(enquiry.id, "scheduled")

      return { uhid, slot: availableSlots.find((s) => s.id === Number(selectedSlotId)) }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["enquiries"] })
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      queryClient.invalidateQueries({ queryKey: ["patients"] })
      setIsSuccess(true)
      setSuccessInfo({
        uhid: data.uhid,
        appointmentTime: data.slot ? `${selectedDate} ${data.slot.start_time}` : selectedDate,
      })
    },
  })

  if (isSuccess && successInfo) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-surface border border-border-strong rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl mx-auto">
            ✓
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-ink">Lead Converted Successfully!</h3>
            <p className="text-xs text-ink-3 mt-1">
              Enquiry <strong className="text-ink">#{enquiry.id}</strong> has been converted to an active patient record & booked into OPD schedule.
            </p>
          </div>
          <div className="bg-page/60 border border-border rounded-lg p-3 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between text-ink-3">
              <span>Patient UHID:</span>
              <strong className="text-ink font-bold">{successInfo.uhid}</strong>
            </div>
            <div className="flex justify-between text-ink-3">
              <span>Appointment:</span>
              <span className="text-brand font-semibold">{successInfo.appointmentTime}</span>
            </div>
            <div className="flex justify-between text-ink-3">
              <span>Pipeline Stage:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Scheduled</span>
            </div>
          </div>
          <Button variant="primary" className="w-full" onClick={onClose}>
            Done & Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-surface border border-border-strong rounded-xl p-6 w-full max-w-lg shadow-2xl my-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-ink">Convert Enquiry to Patient & Appointment</h3>
            <p className="text-xs text-ink-4">Lead #{enquiry.id}: {enquiry.name} ({enquiry.mobile})</p>
          </div>
          <button onClick={onClose} className="text-ink-4 hover:text-ink text-sm p-1">✕</button>
        </div>

        <div className="flex flex-col gap-3.5 mt-4">
          {/* Patient Details Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-ink uppercase tracking-wider">1. Patient Profile</label>
            {existingPatient && useExisting ? (
              <div className="p-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-teal-800 dark:text-teal-200">Existing Patient Matched</div>
                  <div className="text-teal-600 dark:text-teal-400 mt-0.5">
                    {existingPatient.full_name} (MRN #{existingPatient.id} • {existingPatient.mobile})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUseExisting(false)}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Create New Instead
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-9 px-3 border border-border-strong rounded-control text-xs bg-page"
                />
                <input
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-9 px-3 border border-border-strong rounded-control text-xs bg-page"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-4">Gender:</span>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="h-9 flex-1 px-2 border border-border-strong rounded-control text-xs bg-page"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <input
                  value={enquiry.mobile}
                  disabled
                  className="h-9 px-3 border border-border rounded-control text-xs bg-page/50 text-ink-4 font-mono"
                  title="Mobile from enquiry"
                />
              </div>
            )}
          </div>

          {/* Appointment Scheduling Section */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-xs font-semibold text-ink uppercase tracking-wider">2. OPD Appointment Schedule</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-ink-4 block mb-1">Select Doctor</label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => {
                    setSelectedDoctorId(e.target.value ? Number(e.target.value) : "")
                    setSelectedSlotId("")
                  }}
                  className="w-full h-9 px-2 border border-border-strong rounded-control text-xs bg-page"
                >
                  <option value="">Choose a doctor…</option>
                  {(doctors.data?.results ?? []).map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      Dr. {doc.name} ({doc.speciality})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-ink-4 block mb-1">Appointment Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    setSelectedSlotId("")
                  }}
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-xs bg-page"
                />
              </div>
            </div>

            {selectedDoctorId && (
              <div>
                <label className="text-[11px] text-ink-4 block mb-1">
                  Available Time Slots ({availableSlots.length} available)
                </label>
                {slots.isLoading ? (
                  <div className="text-xs text-ink-4 py-2">Loading slots…</div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-xs text-warning py-2 bg-warning-tint/30 px-2 rounded">
                    No free slots found for this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1 border border-border rounded">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id)}
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
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for visit or chief complaint..."
                className="w-full h-9 px-3 border border-border-strong rounded-control text-xs bg-page"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5 pt-3 border-t border-border justify-end">
          <Button variant="secondary" onClick={onClose} disabled={convertMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending || (selectedDoctorId !== "" && selectedSlotId === "")}
          >
            {convertMutation.isPending ? "Converting & Scheduling…" : "Confirm Conversion & Booking"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function EnquiryCard({ enquiry, ownerName, users }: { enquiry: Enquiry; ownerName: string | null; users: User[] }) {
  const queryClient = useQueryClient()
  const [isReassigning, setIsReassigning] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const currentIndex = STAGES.findIndex((s) => s.key === enquiry.stage)
  const nextStage = STAGES[currentIndex + 1]

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
    <div className="bg-surface border border-border rounded-[5px] p-2.5 hover:border-border-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold leading-tight">{enquiry.name}</div>
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
        <button
          onClick={() => setIsConverting(true)}
          className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
          title="Convert lead to patient and schedule an OPD appointment"
        >
          <span>🗓️ Convert</span>
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

      {isConverting && (
        <ConvertEnquiryModal enquiry={enquiry} onClose={() => setIsConverting(false)} />
      )}
    </div>
  )
}

export function EnquiriesPage() {
  const [showNew, setShowNew] = useState(false)
  const [deptFilter, setDeptFilter] = useState<number | "all">("all")
  const [sourceFilter, setSourceFilter] = useState<EnquirySource | "all">("all")
  const [ownerFilter, setOwnerFilter] = useState<number | "all">("all")
  const [slaOnly, setSlaOnly] = useState(false)

  const enquiries = useQuery({ queryKey: ["enquiries"], queryFn: () => listEnquiries({ page_size: "200" }) })
  const users = useQuery({ queryKey: ["users"], queryFn: listUsers })

  const ownerName = (id: number | null) => {
    if (!id) return null
    const u = users.data?.results.find((u) => u.id === id)
    return u ? u.first_name || u.email : `#${id}`
  }

  const all = enquiries.data?.results ?? []
  const open = all.filter((e) => e.stage !== "lost")

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
    return true
  })

  const pipelineValue = filtered.reduce((sum, e) => sum + (e.estimated_value ? Number(e.estimated_value) : 0), 0)

  if (enquiries.isLoading) return <LoadingState />

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2 flex-wrap">
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
        <Button variant="primary" onClick={() => setShowNew(true)}>New enquiry</Button>
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
                <EnquiryCard key={e.id} enquiry={e} ownerName={ownerName(e.assigned_to)} users={users.data?.results ?? []} />
              ))}
              {cards.length === 0 && <div className="text-[11.5px] text-ink-5 px-1">—</div>}
            </div>
          )
        })}
      </div>

      {showNew && <NewEnquiryForm onClose={() => setShowNew(false)} />}
    </div>
  )
}
