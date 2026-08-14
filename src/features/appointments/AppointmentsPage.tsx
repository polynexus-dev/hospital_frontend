import { Fragment, useMemo, useState, type FormEvent } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { NeutralTag, Pill } from "../../components/ui/Pill"
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/QueryStates"
import {
  blockDoctorLeave,
  bookAppointment,
  confirmWaitlist,
  fetchDoctorQueue,
  listAppointments,
  listDoctors,
  listSlots,
  listWaitlist,
  transitionAppointment,
} from "../../api/appointments"
import { reminderDelivery } from "../../api/analytics"
import { listPatients } from "../../api/patients"
import { useAuthStore } from "../../store/auth"
import { ConsultationPanel } from "./ConsultationPanel"
import type { Appointment, AppointmentStatus, Slot } from "../../types/api"
import type { Tone } from "../../components/ui/tone"

const CONSULTATION_VISIBLE_STATUSES: AppointmentStatus[] = ["checked_in", "in_consult", "diagnostics", "completed"]

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Booked",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  in_consult: "In consult",
  diagnostics: "Diagnostics",
  completed: "Completed",
  no_show: "No-show",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
}

const STATUS_TONE: Record<AppointmentStatus, Tone> = {
  booked: "info",
  confirmed: "info",
  checked_in: "ok",
  in_consult: "ok",
  diagnostics: "ok",
  completed: "ok",
  no_show: "bad",
  cancelled: "neutral",
  rescheduled: "neutral",
}

// Statuses that no longer occupy their slot (the slot is effectively free again).
const FREED_STATUSES: AppointmentStatus[] = ["cancelled", "rescheduled"]

type CellTone = "none" | "blocked" | "available" | "booked" | "active" | "risk"

const TONE_STYLES: Record<CellTone, string> = {
  none: "bg-page/60 border-border-faint text-ink-6 cursor-default",
  blocked: "bg-[#f0f2f5] border-[#dfe3e7] text-ink-5 cursor-not-allowed",
  available: "bg-surface border-border-soft text-ink-5 hover:border-brand hover:bg-brand-tint hover:text-brand cursor-pointer",
  booked: "bg-[#dde6f0] border-[#b8c9dd] text-ink-2 hover:brightness-[0.97] cursor-pointer",
  active: "bg-[#dff0e7] border-[#a9d4bf] text-ink-2 hover:brightness-[0.97] cursor-pointer",
  risk: "bg-[#f6efe0] border-[#dfcda3] text-ink-2 hover:brightness-[0.97] cursor-pointer",
}

const LEGEND: { label: string; className: string }[] = [
  { label: "Booked", className: "bg-[#dde6f0] border-[#b8c9dd]" },
  { label: "Checked in", className: "bg-[#dff0e7] border-[#a9d4bf]" },
  { label: "No-show risk", className: "bg-[#f6efe0] border-[#dfcda3]" },
  { label: "Blocked", className: "bg-[#f0f2f5] border-[#dfe3e7]" },
]

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

function formatDisplayDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" })
  const day = String(d.getDate()).padStart(2, "0")
  const month = d.toLocaleDateString("en-US", { month: "short" })
  return `${weekday} ${day} ${month} ${d.getFullYear()}`
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":")
  const h = Number(hStr)
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${(mStr ?? "00").padStart(2, "0")} ${period}`
}

function isNoShowRiskSlot(slot: Slot): boolean {
  return new Date(`${slot.date}T${slot.start_time}`).getTime() < Date.now()
}

function cellTone(slot: Slot | undefined, appt: Appointment | undefined): CellTone {
  if (!slot) return "none"
  if (slot.is_blocked) return "blocked"
  if (!appt) return "available"
  if (appt.status === "checked_in" || appt.status === "in_consult" || appt.status === "diagnostics" || appt.status === "completed") {
    return "active"
  }
  if (appt.status === "no_show") return "risk"
  if (appt.status === "booked" || appt.status === "confirmed") {
    return isNoShowRiskSlot(slot) ? "risk" : "booked"
  }
  return "available"
}

export function AppointmentsPage() {
  const queryClient = useQueryClient()
  const canSeeClinicalDetail = useAuthStore((s) => s.user?.permissions?.includes("patients.access_clinical_detail") ?? false)
  const [selectedDate, setSelectedDate] = useState<string>(todayIso())
  const [selectedApptId, setSelectedApptId] = useState<number | null>(null)

  // Booking modal state
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)
  const [bookPatientId, setBookPatientId] = useState<number>(0)
  const [bookDoctorId, setBookDoctorId] = useState<number>(0)
  const [bookSlotId, setBookSlotId] = useState<number>(0)
  const [bookReason, setBookReason] = useState("")

  // Block-leave modal state
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [blockDoctorId, setBlockDoctorId] = useState<number>(0)
  const [blockStart, setBlockStart] = useState(todayIso())
  const [blockEnd, setBlockEnd] = useState(todayIso())
  const [blockReason, setBlockReason] = useState("")

  // OPD queue panel doctor selection
  const [queueDoctorId, setQueueDoctorId] = useState<number>(0)

  const doctorsQuery = useQuery({ queryKey: ["doctors"], queryFn: () => listDoctors() })
  const patientsQuery = useQuery({ queryKey: ["patients-dropdown"], queryFn: () => listPatients() })
  const slotsQuery = useQuery({
    queryKey: ["slots", "day", selectedDate],
    queryFn: () => listSlots({ date: selectedDate }),
  })
  const apptsQuery = useQuery({
    queryKey: ["appointments", "day", selectedDate],
    queryFn: () => listAppointments({ slot__date: selectedDate }),
  })
  const waitlistQuery = useQuery({ queryKey: ["waitlist"], queryFn: () => listWaitlist() })
  const reminderQuery = useQuery({ queryKey: ["reports", "reminder-delivery"], queryFn: reminderDelivery })
  const queueQuery = useQuery({
    queryKey: ["doctor-queue", queueDoctorId, selectedDate],
    queryFn: () => fetchDoctorQueue(queueDoctorId, selectedDate),
    enabled: queueDoctorId > 0,
  })

  const doctors = useMemo(() => (doctorsQuery.data?.results ?? []).filter((d) => d.is_active), [doctorsQuery.data])
  const patients = patientsQuery.data?.results ?? []
  const slots = slotsQuery.data?.results ?? []
  const appointments = apptsQuery.data?.results ?? []

  const patientMap = useMemo(
    () => new Map(patients.map((p) => [p.id, p.full_name || `${p.first_name} ${p.last_name}`.trim()])),
    [patients],
  )
  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors])

  const apptsBySlot = useMemo(() => {
    const map = new Map<number, Appointment>()
    for (const appt of appointments) {
      if (FREED_STATUSES.includes(appt.status)) continue
      const existing = map.get(appt.slot)
      if (!existing || appt.id > existing.id) map.set(appt.slot, appt)
    }
    return map
  }, [appointments])

  const slotByDoctorTime = useMemo(() => {
    const map = new Map<string, Slot>()
    for (const slot of slots) map.set(`${slot.doctor}__${slot.start_time}`, slot)
    return map
  }, [slots])

  const times = useMemo(() => Array.from(new Set(slots.map((s) => s.start_time))).sort(), [slots])

  function patientName(id: number): string {
    return patientMap.get(id) ?? `Patient #${id}`
  }

  // "Today at a glance"
  const bookedCount = appointments.length
  const checkedInCount = appointments.filter(
    (a) => a.status === "checked_in" || a.status === "in_consult" || a.status === "completed",
  ).length
  const noShowCount = appointments.filter((a) => a.status === "no_show").length
  // Approximation: this app doesn't record a dedicated "walk-in" source — CRM-sourced bookings
  // (as opposed to whatsapp/website self-service) are the closest available signal.
  const walkInCount = appointments.filter((a) => a.source === "crm").length

  // Reminders sent
  const reminderRows = reminderQuery.data?.rows ?? []
  const wa24h = reminderRows
    .filter((r) => r.channel === "whatsapp" && r.purpose.includes("24h"))
    .reduce((sum, r) => sum + r.count, 0)
  const wa2h = reminderRows
    .filter((r) => r.channel === "whatsapp" && r.purpose.includes("2h") && !r.purpose.includes("24h"))
    .reduce((sum, r) => sum + r.count, 0)
  const smsFallback = reminderRows.filter((r) => r.channel === "sms").reduce((sum, r) => sum + r.count, 0)
  const recognizedKeys = new Set<string>()
  reminderRows.forEach((r) => {
    const isWa24 = r.channel === "whatsapp" && r.purpose.includes("24h")
    const isWa2 = r.channel === "whatsapp" && r.purpose.includes("2h") && !r.purpose.includes("24h")
    if (isWa24 || isWa2 || r.channel === "sms") recognizedKeys.add(`${r.purpose}__${r.channel}`)
  })
  const otherReminderRows = reminderRows.filter((r) => !recognizedKeys.has(`${r.purpose}__${r.channel}`))

  // Waitlist — show entries actionable right now (waiting on a slot, or already offered one).
  const waitlistEntries = (waitlistQuery.data?.results ?? [])
    .filter((w) => w.status === "waiting" || w.status === "offered")
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "offered" ? -1 : 1))

  // Mutations
  const bookMutation = useMutation({
    mutationFn: bookAppointment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      queryClient.invalidateQueries({ queryKey: ["slots"] })
      closeBooking()
    },
  })

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: AppointmentStatus }) => transitionAppointment(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  })

  const confirmWaitlistMutation = useMutation({
    mutationFn: (id: number) => confirmWaitlist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist"] })
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      queryClient.invalidateQueries({ queryKey: ["slots"] })
    },
  })

  const blockLeaveMutation = useMutation({
    mutationFn: () => blockDoctorLeave(blockDoctorId, { start_date: blockStart, end_date: blockEnd, reason: blockReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slots"] })
      closeBlockModal()
    },
  })

  function openBlockModal(doctorId = 0) {
    setBlockDoctorId(doctorId)
    setBlockStart(todayIso())
    setBlockEnd(todayIso())
    setBlockReason("")
    setIsBlockModalOpen(true)
  }

  function closeBlockModal() {
    setIsBlockModalOpen(false)
  }

  function openBooking(doctorId = 0, slotId = 0) {
    setBookDoctorId(doctorId)
    setBookSlotId(slotId)
    setBookPatientId(0)
    setBookReason("")
    setIsBookModalOpen(true)
  }

  function closeBooking() {
    setIsBookModalOpen(false)
    setBookPatientId(0)
    setBookDoctorId(0)
    setBookSlotId(0)
    setBookReason("")
  }

  const modalAvailableSlots = useMemo(
    () =>
      slots
        .filter((s) => s.doctor === bookDoctorId && !s.is_blocked && !apptsBySlot.has(s.id))
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [slots, bookDoctorId, apptsBySlot],
  )

  const handleBookSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!bookPatientId || !bookSlotId) return
    bookMutation.mutate({ patient: bookPatientId, slot: bookSlotId, source: "crm", reason: bookReason })
  }

  const selectedAppt = selectedApptId ? (appointments.find((a) => a.id === selectedApptId) ?? null) : null
  const selectedApptSlot = selectedAppt ? slots.find((s) => s.id === selectedAppt.slot) : undefined
  const selectedApptDoctor = selectedAppt ? doctorMap.get(selectedAppt.doctor) : undefined

  const gridLoading = doctorsQuery.isLoading || slotsQuery.isLoading || apptsQuery.isLoading
  const gridError = doctorsQuery.isError || slotsQuery.isError || apptsQuery.isError

  return (
    <div className="flex flex-col gap-3.5 min-w-[940px]">
      <div className="grid grid-cols-[minmax(600px,1fr)_288px] gap-3.5 items-start">
        <Card>
          <CardHeader className="flex-wrap">
            <div className="flex border border-border-strong rounded-control overflow-hidden">
              <button
                type="button"
                onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
                className="w-7 h-[30px] flex items-center justify-center text-ink-3 hover:bg-page border-r border-border-strong"
              >
                ‹
              </button>
              <div className="px-3 h-[30px] flex items-center text-[12.5px] font-semibold whitespace-nowrap">
                {formatDisplayDate(selectedDate)}
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
                className="w-7 h-[30px] flex items-center justify-center text-ink-3 hover:bg-page border-l border-border-strong"
              >
                ›
              </button>
            </div>
            {selectedDate !== todayIso() && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayIso())}
                className="text-[11.5px] text-brand font-semibold hover:underline"
              >
                Today
              </button>
            )}
            <div className="text-[12.5px] text-ink-4 whitespace-nowrap">
              OPD · {doctors.length} consultant{doctors.length === 1 ? "" : "s"} on floor
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-3 flex-wrap">
              {LEGEND.map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className={`w-[10px] h-[10px] rounded-[2px] border ${l.className}`} />
                  <span className="text-[11px] text-ink-4 whitespace-nowrap">{l.label}</span>
                </div>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={() => openBlockModal()}>
              Block doctor leave
            </Button>
            <Button variant="primary" size="sm" onClick={() => openBooking()}>
              Book slot
            </Button>
          </CardHeader>

          {gridLoading && <LoadingState />}
          {gridError && <ErrorState />}

          {!gridLoading && !gridError && doctors.length === 0 && (
            <EmptyState message="No active doctors configured." />
          )}

          {!gridLoading && !gridError && doctors.length > 0 && (
            <div className="overflow-x-auto">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `58px repeat(${doctors.length}, minmax(120px, 1fr))`,
                  minWidth: 58 + doctors.length * 120,
                }}
              >
                <div className="border-b border-border-soft bg-page/40" />
                {doctors.map((d) => {
                  const doctorSlots = slots.filter((s) => s.doctor === d.id)
                  const doctorBooked = doctorSlots.filter((s) => apptsBySlot.has(s.id)).length
                  return (
                    <div key={d.id} className="px-2 py-2 border-b border-l border-border-soft text-center bg-page/40">
                      <div className="text-[12.5px] font-semibold truncate" title={d.name}>
                        {d.name}
                      </div>
                      <div className="text-[10.5px] text-ink-4 truncate">{d.speciality || "General"}</div>
                      <div className="text-[10px] text-ink-5 mt-0.5 font-mono">
                        {doctorBooked}/{doctorSlots.length} booked
                      </div>
                    </div>
                  )
                })}

                {times.map((t) => (
                  <Fragment key={t}>
                    <div className="px-1.5 py-1.5 border-b border-r border-border-faint text-[10.5px] text-ink-4 flex items-center justify-end font-mono">
                      {formatTime(t)}
                    </div>
                    {doctors.map((d) => {
                      const slot = slotByDoctorTime.get(`${d.id}__${t}`)
                      const appt = slot ? apptsBySlot.get(slot.id) : undefined
                      const tone = cellTone(slot, appt)
                      const baseClass = `border-b border-l px-1.5 py-1.5 min-h-[42px] flex flex-col justify-center text-left w-full transition-colors ${TONE_STYLES[tone]}`

                      if (tone === "available" && slot) {
                        return (
                          <button key={d.id} type="button" className={baseClass} onClick={() => openBooking(d.id, slot.id)}>
                            <span className="text-[12px] leading-none">+</span>
                          </button>
                        )
                      }
                      if (appt && (tone === "booked" || tone === "active" || tone === "risk")) {
                        return (
                          <button key={d.id} type="button" className={baseClass} onClick={() => setSelectedApptId(appt.id)}>
                            <span className="text-[11.5px] font-semibold truncate">
                              {appt.queue_token != null && `#${appt.queue_token} `}
                              {patientName(appt.patient)}
                            </span>
                            <span className="text-[10px] truncate opacity-80">
                              {STATUS_LABELS[appt.status]}
                              {appt.reason ? ` · ${appt.reason}` : ""}
                            </span>
                          </button>
                        )
                      }
                      return (
                        <div key={d.id} className={baseClass}>
                          {tone === "blocked" && <span className="text-[10.5px] text-center">Blocked</span>}
                          {tone === "none" && <span className="text-[10.5px] text-center">—</span>}
                        </div>
                      )
                    })}
                  </Fragment>
                ))}

                {times.length === 0 && (
                  <div style={{ gridColumn: "1 / -1" }} className="px-4 py-6 text-center text-[13px] text-ink-4">
                    No slots configured for this date.
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card padded>
            <Eyebrow>Today at a glance</Eyebrow>
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
              <div>
                <div className="text-[21px] font-semibold tracking-[-.02em]">{bookedCount}</div>
                <div className="text-[11.5px] text-ink-4">Booked</div>
              </div>
              <div>
                <div className="text-[21px] font-semibold tracking-[-.02em] text-success">{checkedInCount}</div>
                <div className="text-[11.5px] text-ink-4">Checked in</div>
              </div>
              <div>
                <div className="text-[21px] font-semibold tracking-[-.02em] text-danger">{noShowCount}</div>
                <div className="text-[11.5px] text-ink-4">No-show so far</div>
              </div>
              <div>
                <div className="text-[21px] font-semibold tracking-[-.02em]">{walkInCount}</div>
                <div className="text-[11.5px] text-ink-4">Walk-ins added</div>
              </div>
            </div>
          </Card>

          <Card padded>
            <div className="flex items-center justify-between mb-2">
              <Eyebrow>OPD queue</Eyebrow>
              <select
                value={queueDoctorId}
                onChange={(e) => setQueueDoctorId(Number(e.target.value))}
                className="h-7 px-2 border border-border-strong rounded-control bg-surface text-[11.5px] text-ink-3"
              >
                <option value={0}>Select doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            {queueDoctorId === 0 && <div className="text-[12.5px] text-ink-4">Pick a doctor to see who's waiting.</div>}
            {queueDoctorId > 0 && queueQuery.isLoading && <div className="text-[12.5px] text-ink-4">Loading…</div>}
            {queueDoctorId > 0 && queueQuery.data && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-3">Now serving</span>
                  <span className="font-bold text-success">
                    {queueQuery.data.now_serving
                      ? `#${queueQuery.data.now_serving.queue_token} · ${patientName(queueQuery.data.now_serving.patient)}`
                      : "—"}
                  </span>
                </div>
                <div className="text-[11.5px] text-ink-4 mt-1">Waiting ({queueQuery.data.waiting.length})</div>
                {queueQuery.data.waiting.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex justify-between text-[12.5px]">
                    <span>#{a.queue_token} {patientName(a.patient)}</span>
                  </div>
                ))}
                {queueQuery.data.waiting.length === 0 && <div className="text-[12px] text-ink-5">No one waiting.</div>}
              </div>
            )}
          </Card>

          <Card padded>
            <Eyebrow>Reminders sent</Eyebrow>
            {reminderQuery.isLoading ? (
              <div className="text-[12.5px] text-ink-4">Loading…</div>
            ) : reminderRows.length === 0 ? (
              <div className="text-[12.5px] text-ink-4">No reminders sent yet.</div>
            ) : (
              <div className="flex flex-col gap-2 text-[13px]">
                {wa24h > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-3">24h WhatsApp</span>
                    <span className="font-semibold">{wa24h} sent</span>
                  </div>
                )}
                {wa2h > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-3">2h WhatsApp</span>
                    <span className="font-semibold">{wa2h} sent</span>
                  </div>
                )}
                {smsFallback > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-3">SMS fallback</span>
                    <span className="font-semibold">{smsFallback} sent</span>
                  </div>
                )}
                {otherReminderRows.map((r) => (
                  <div key={`${r.purpose}-${r.channel}`} className="flex justify-between">
                    <span className="text-ink-3 capitalize">
                      {r.purpose.replace(/_/g, " ")} · {r.channel}
                    </span>
                    <span className="font-semibold">{r.count} sent</span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[11px] text-ink-4 mt-2.5 leading-relaxed">
              WhatsApp is attempted first; SMS is sent only as a delivery fallback.
            </div>
          </Card>

          <Card>
            <div className="px-3.5 py-3 border-b border-border-soft flex items-center justify-between">
              <Eyebrow>Waitlist</Eyebrow>
              <span className="text-[10.5px] text-ink-4 whitespace-nowrap">auto-fill on cancel</span>
            </div>
            <div className="px-3.5">
              {waitlistQuery.isLoading && <LoadingState />}
              {!waitlistQuery.isLoading && waitlistEntries.length === 0 && (
                <EmptyState message="No one waiting right now." />
              )}
              {waitlistEntries.map((w) => (
                <div key={w.id} className="flex items-center gap-2 py-2.5 border-b border-border-faint last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold truncate">{patientName(w.patient)}</div>
                    <div className="text-[11px] text-ink-4 truncate">
                      {doctorMap.get(w.doctor)?.name ?? `Doctor #${w.doctor}`}
                      {w.preferred_date ? ` · wants ${w.preferred_date}` : ""}
                    </div>
                  </div>
                  {w.status === "offered" ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => confirmWaitlistMutation.mutate(w.id)}
                      disabled={confirmWaitlistMutation.isPending}
                    >
                      Confirm
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" disabled title="Offered automatically when a matching slot opens up">
                      Offer
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="h-2.5" />
          </Card>
        </div>
      </div>

      {/* Book appointment modal */}
      {isBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={closeBooking}>
          <div
            className="bg-surface rounded-card p-5 w-full max-w-[440px] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-semibold mb-3.5">Book OPD appointment</div>
            <form onSubmit={handleBookSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">
                  Patient *
                </label>
                <select
                  required
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px] bg-surface"
                  value={bookPatientId}
                  onChange={(e) => setBookPatientId(Number(e.target.value))}
                >
                  <option value={0}>Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || `${p.first_name} ${p.last_name}`} ({p.mobile})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">
                  Doctor *
                </label>
                <select
                  required
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px] bg-surface"
                  value={bookDoctorId}
                  onChange={(e) => {
                    setBookDoctorId(Number(e.target.value))
                    setBookSlotId(0)
                  }}
                >
                  <option value={0}>Select doctor…</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.speciality})
                    </option>
                  ))}
                </select>
              </div>

              {bookDoctorId > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">
                    Available slot on {formatDisplayDate(selectedDate)} *
                  </label>
                  {modalAvailableSlots.length === 0 ? (
                    <p className="text-[12px] text-warning-text">No open slots for this doctor on this date.</p>
                  ) : (
                    <select
                      required
                      className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px] bg-surface font-mono"
                      value={bookSlotId}
                      onChange={(e) => setBookSlotId(Number(e.target.value))}
                    >
                      <option value={0}>Select time slot…</option>
                      {modalAvailableSlots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">
                  Reason for visit
                </label>
                <input
                  type="text"
                  placeholder="e.g. Routine checkup, Fever & cough"
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]"
                  value={bookReason}
                  onChange={(e) => setBookReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closeBooking}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={bookMutation.isPending || !bookSlotId || !bookPatientId}>
                  {bookMutation.isPending ? "Booking…" : "Confirm booking"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Block doctor leave modal */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={closeBlockModal}>
          <div className="bg-surface rounded-card p-5 w-full max-w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-semibold mb-3.5">Block doctor leave</div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">Doctor *</label>
                <select
                  required
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px] bg-surface"
                  value={blockDoctorId}
                  onChange={(e) => setBlockDoctorId(Number(e.target.value))}
                >
                  <option value={0}>Select doctor…</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">From</label>
                  <input type="date" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">To</label>
                  <input type="date" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-[.04em] text-ink-4 mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="e.g. On leave, Conference"
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              </div>
              {blockLeaveMutation.isSuccess && (
                <div className="text-[12px] text-success">
                  Blocked {blockLeaveMutation.data?.blocked} slot(s)
                  {blockLeaveMutation.data && blockLeaveMutation.data.skipped_already_booked > 0
                    ? ` · ${blockLeaveMutation.data.skipped_already_booked} already-booked slot(s) need manual reschedule`
                    : ""}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={closeBlockModal}>Cancel</Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => blockLeaveMutation.mutate()}
                  disabled={!blockDoctorId || blockLeaveMutation.isPending}
                >
                  {blockLeaveMutation.isPending ? "Blocking…" : "Block slots"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected appointment actions */}
      {selectedAppt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setSelectedApptId(null)}
        >
          <div
            className={`bg-surface rounded-card p-5 w-full max-h-[85vh] overflow-y-auto ${
              canSeeClinicalDetail && CONSULTATION_VISIBLE_STATUSES.includes(selectedAppt.status) ? "max-w-[560px]" : "max-w-[380px]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="text-[15px] font-semibold">{patientName(selectedAppt.patient)}</div>
              <Pill tone={STATUS_TONE[selectedAppt.status]}>{STATUS_LABELS[selectedAppt.status]}</Pill>
            </div>
            <div className="text-[12.5px] text-ink-4 mb-3">
              {selectedApptDoctor?.name ?? `Doctor #${selectedAppt.doctor}`}
              {selectedApptSlot ? ` · ${formatTime(selectedApptSlot.start_time)}–${formatTime(selectedApptSlot.end_time)}` : ""}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              <NeutralTag>{selectedAppt.source}</NeutralTag>
              {selectedAppt.reason && <NeutralTag>{selectedAppt.reason}</NeutralTag>}
            </div>

            {canSeeClinicalDetail && CONSULTATION_VISIBLE_STATUSES.includes(selectedAppt.status) && (
              <ConsultationPanel appointmentId={selectedAppt.id} />
            )}

            <div className="flex flex-wrap gap-1.5 mt-4">
              {selectedAppt.status === "booked" && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => transitionMutation.mutate({ id: selectedAppt.id, status: "checked_in" })}
                  disabled={transitionMutation.isPending}
                >
                  Check in
                </Button>
              )}
              {selectedAppt.status === "checked_in" && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => transitionMutation.mutate({ id: selectedAppt.id, status: "in_consult" })}
                  disabled={transitionMutation.isPending}
                >
                  Start consult
                </Button>
              )}
              {selectedAppt.status === "in_consult" && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => transitionMutation.mutate({ id: selectedAppt.id, status: "completed" })}
                  disabled={transitionMutation.isPending}
                >
                  Complete
                </Button>
              )}
              {["booked", "confirmed", "checked_in"].includes(selectedAppt.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => transitionMutation.mutate({ id: selectedAppt.id, status: "no_show" })}
                  disabled={transitionMutation.isPending}
                >
                  No-show
                </Button>
              )}
              <div className="flex-1" />
              <Button size="sm" variant="secondary" onClick={() => setSelectedApptId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
