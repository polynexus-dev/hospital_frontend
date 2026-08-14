import { Fragment, useState, useEffect } from "react"

import { useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { NeutralTag, Pill, SuccessTag } from "../../components/ui/Pill"
import { Avatar } from "../../components/ui/Avatar"
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/QueryStates"
import { getPatient, getPatientTimeline, listPatientDocuments, updatePatient, uploadPatientDocument } from "../../api/patients"
import { listAppointments, listDoctors } from "../../api/appointments"
import { createConsent, listConsent, listMessages, setConsent } from "../../api/communications"
import { listHisBilling } from "../../api/integrations"
import { listPrescriptions, createPrescription } from "../../api/prescriptions"
import type { Prescription, Medication } from "../../api/prescriptions"
import type { AppointmentStatus, Channel, ConsentOptOut, Patient } from "../../types/api"
import { useAuthStore } from "../../store/auth"

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })

type TabKey = "timeline" | "prescriptions" | "documents" | "appointments" | "messages" | "consents"

const TABS: { key: TabKey; label: string }[] = [
  { key: "timeline", label: "Timeline" },
  { key: "prescriptions", label: "e-Prescriptions (e-Rx)" },
  { key: "documents", label: "Documents" },
  { key: "appointments", label: "Appointments" },
  { key: "messages", label: "Messages" },
  { key: "consents", label: "Consents" },
]


const TREATING_STATUSES: AppointmentStatus[] = ["checked_in", "in_consult", "completed"]

const CHANNELS: Channel[] = ["whatsapp", "sms", "email", "call_note"]
const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  call_note: "Call note",
}

const PURPOSES: ConsentOptOut["purpose"][] = ["transactional", "marketing", "all"]
const PURPOSE_LABELS: Record<ConsentOptOut["purpose"], string> = {
  transactional: "Transactional",
  marketing: "Marketing",
  all: "All",
}

function ConsentToggle({
  patientId,
  channel,
  purpose,
  existing,
}: {
  patientId: number
  channel: Channel
  purpose: ConsentOptOut["purpose"]
  existing?: ConsentOptOut
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () =>
      existing
        ? setConsent(existing.id, !existing.is_opted_out)
        : createConsent({ patient: patientId, channel, purpose, is_opted_out: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patient-consent", patientId] }),
  })

  if (!existing) {
    return (
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="text-[11px] font-semibold text-brand hover:underline text-left disabled:opacity-50"
      >
        {mutation.isPending ? "Setting…" : "Set consent"}
      </button>
    )
  }

  return (
    <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-fit disabled:opacity-50">
      {existing.is_opted_out ? <Pill tone="bad">Opted out</Pill> : <SuccessTag>Opted in</SuccessTag>}
    </button>
  )
}

function AccountCard({
  patient,
  outstandingDues,
  lifetimeBilled,
}: {
  patient: Patient
  outstandingDues: number
  lifetimeBilled: number
}) {
  return (
    <Card padded>
      <Eyebrow>Account</Eyebrow>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-[13px]">
        <div>
          <div className="text-[11.5px] text-ink-4">Insurer / TPA</div>
          <div className="text-ink-2 font-semibold mt-0.5">{patient.insurance_provider || "Self-pay"}</div>
          {patient.insurance_policy_number && (
            <div className="text-[11.5px] text-ink-4 font-mono mt-0.5">{patient.insurance_policy_number}</div>
          )}
        </div>
        <div>
          <div className="text-[11.5px] text-ink-4">Employer</div>
          <div className="text-ink-2 font-semibold mt-0.5">{patient.employer || "—"}</div>
        </div>
        <div>
          <div className="text-[11.5px] text-ink-4">Outstanding dues</div>
          <div className={`text-[18px] font-semibold font-mono mt-0.5 ${outstandingDues > 0 ? "text-danger-text" : "text-ink"}`}>
            {INR.format(outstandingDues)}
          </div>
        </div>
        <div>
          <div className="text-[11.5px] text-ink-4">Lifetime billed</div>
          <div className="text-[18px] font-semibold font-mono mt-0.5">{INR.format(lifetimeBilled)}</div>
        </div>
      </div>
      <div className="text-[11.5px] text-ink-5 mt-3 pt-3 border-t border-border-faint">
        Pre-authorisation — ships with the TPA module
      </div>
    </Card>
  )
}

function LinkedPeopleCard({ patient, treatingDoctorLabel }: { patient: Patient; treatingDoctorLabel: string }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [attendantName, setAttendantName] = useState(patient.attendant_name)
  const [attendantPhone, setAttendantPhone] = useState(patient.attendant_phone)
  const [attendantRelation, setAttendantRelation] = useState(patient.attendant_relation)
  const [referringDoctor, setReferringDoctor] = useState(patient.referring_doctor_name)
  const [guardianId, setGuardianId] = useState(patient.guardian ? String(patient.guardian) : "")
  const [relationshipToGuardian, setRelationshipToGuardian] = useState(patient.relationship_to_guardian)

  const openEdit = () => {
    setAttendantName(patient.attendant_name)
    setAttendantPhone(patient.attendant_phone)
    setAttendantRelation(patient.attendant_relation)
    setReferringDoctor(patient.referring_doctor_name)
    setGuardianId(patient.guardian ? String(patient.guardian) : "")
    setRelationshipToGuardian(patient.relationship_to_guardian)
    setIsEditing(true)
  }

  const save = useMutation({
    mutationFn: () =>
      updatePatient(patient.id, {
        attendant_name: attendantName,
        attendant_phone: attendantPhone,
        attendant_relation: attendantRelation,
        referring_doctor_name: referringDoctor,
        guardian: guardianId ? Number(guardianId) : null,
        relationship_to_guardian: relationshipToGuardian,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient", patient.id] })
      setIsEditing(false)
    },
  })

  return (
    <Card padded>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[11px] tracking-[.08em] uppercase text-ink-4 font-semibold">Linked people</div>
        {!isEditing && (
          <button onClick={openEdit} className="text-[11.5px] font-semibold text-brand hover:underline">
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={attendantName}
              onChange={(e) => setAttendantName(e.target.value)}
              placeholder="Attendant name"
              className="h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] outline-none focus:border-brand"
            />
            <input
              value={attendantPhone}
              onChange={(e) => setAttendantPhone(e.target.value)}
              placeholder="Attendant phone"
              className="h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] font-mono outline-none focus:border-brand"
            />
          </div>
          <input
            value={attendantRelation}
            onChange={(e) => setAttendantRelation(e.target.value)}
            placeholder="Relation (e.g. spouse, parent)"
            className="h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] outline-none focus:border-brand"
          />
          <input
            value={referringDoctor}
            onChange={(e) => setReferringDoctor(e.target.value)}
            placeholder="Referred by"
            className="h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] outline-none focus:border-brand"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={guardianId}
              onChange={(e) => setGuardianId(e.target.value)}
              placeholder="Guardian patient ID"
              type="number"
              className="h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] font-mono outline-none focus:border-brand"
            />
            <input
              value={relationshipToGuardian}
              onChange={(e) => setRelationshipToGuardian(e.target.value)}
              placeholder="Relation (e.g. child, spouse)"
              className="h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] outline-none focus:border-brand"
            />
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-[13px]">
          <div>
            <div className="text-[11.5px] text-ink-4">Attendant</div>
            <div className="text-ink-2 font-semibold mt-0.5">{patient.attendant_name || "—"}</div>
            {patient.attendant_relation && <div className="text-[11.5px] text-ink-4 mt-0.5">{patient.attendant_relation}</div>}
          </div>
          <div>
            <div className="text-[11.5px] text-ink-4">Attendant phone</div>
            <div className="text-ink-2 font-mono mt-0.5">{patient.attendant_phone || "—"}</div>
          </div>
          <div>
            <div className="text-[11.5px] text-ink-4">Referred by</div>
            <div className="text-ink-2 font-semibold mt-0.5">{patient.referring_doctor_name || "—"}</div>
          </div>
          <div>
            <div className="text-[11.5px] text-ink-4">Treating doctor</div>
            <div className="text-ink-2 font-semibold mt-0.5">{treatingDoctorLabel}</div>
          </div>
          <div>
            <div className="text-[11.5px] text-ink-4">Guardian / household head</div>
            <div className="text-ink-2 font-semibold mt-0.5">
              {patient.guardian ? `Patient #${patient.guardian}` : "—"}
            </div>
            {patient.relationship_to_guardian && <div className="text-[11.5px] text-ink-4 mt-0.5">{patient.relationship_to_guardian}</div>}
          </div>
        </div>
      )}
    </Card>
  )
}

function RecallCard({ patient }: { patient: Patient }) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [dueDate, setDueDate] = useState(patient.next_recall_due_at ? patient.next_recall_due_at.slice(0, 10) : "")
  const [reason, setReason] = useState(patient.recall_reason)

  const openEdit = () => {
    setDueDate(patient.next_recall_due_at ? patient.next_recall_due_at.slice(0, 10) : "")
    setReason(patient.recall_reason)
    setIsEditing(true)
  }

  const save = useMutation({
    mutationFn: () =>
      updatePatient(patient.id, {
        next_recall_due_at: dueDate ? new Date(dueDate).toISOString() : null,
        recall_reason: reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient", patient.id] })
      setIsEditing(false)
    },
  })

  const overdue = patient.next_recall_due_at && new Date(patient.next_recall_due_at).getTime() < Date.now()

  return (
    <Card padded>
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[11px] tracking-[.08em] uppercase text-ink-4 font-semibold">Preventive-care recall</div>
        {!isEditing && (
          <button onClick={openEdit} className="text-[11.5px] font-semibold text-brand hover:underline">
            {patient.next_recall_due_at ? "Edit" : "Schedule"}
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] outline-none focus:border-brand"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Annual checkup, post-surgery follow-up"
            className="h-8 px-2.5 border border-border-strong rounded-control text-[12.5px] outline-none focus:border-brand"
          />
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : patient.next_recall_due_at ? (
        <div className="text-[13px]">
          <div className={overdue ? "font-semibold text-danger" : "font-semibold text-ink-2"}>
            {overdue ? "Overdue since " : "Due "}
            {new Date(patient.next_recall_due_at).toLocaleDateString("en-IN")}
          </div>
          {patient.recall_reason && <div className="text-[11.5px] text-ink-4 mt-0.5">{patient.recall_reason}</div>}
        </div>
      ) : (
        <div className="text-[12.5px] text-ink-4">No recall scheduled.</div>
      )}
    </Card>
  )
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const patientId = id ? parseInt(id, 10) : 0
  const authUser = useAuthStore((state) => state.user)

  const [activeTab, setActiveTab] = useState<TabKey>("timeline")
  const [isDocModalOpen, setIsDocModalOpen] = useState(false)
  const [docCategory, setDocCategory] = useState<"report" | "prescription" | "insurance_card" | "consent" | "id_proof" | "other">("report")
  const [docTitle, setDocTitle] = useState("")
  const [docNotes, setDocNotes] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // e-Rx State
  const [isRxModalOpen, setIsRxModalOpen] = useState(false)
  const [rxDiagnosis, setRxDiagnosis] = useState("")
  const [rxSymptoms, setRxSymptoms] = useState("")
  const [rxNotes, setRxNotes] = useState("")
  const [rxMedications, setRxMedications] = useState<Medication[]>([
    { name: "Paracetamol 500mg", dosage: "1-0-1", duration: "5 Days" }
  ])
  const [rxLabOrders, setRxLabOrders] = useState<string[]>(["CBC", "Chest X-Ray"])
  const [viewingRx, setViewingRx] = useState<Prescription | null>(null)

  // Auto-restore e-Rx draft from localStorage (Unsaved Form Protection)
  useEffect(() => {
    if (!patientId) return
    const saved = localStorage.getItem(`erx_draft_${patientId}`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.diagnosis) setRxDiagnosis(parsed.diagnosis)
        if (parsed.symptoms) setRxSymptoms(parsed.symptoms)
        if (parsed.notes) setRxNotes(parsed.notes)
        if (parsed.medications?.length) setRxMedications(parsed.medications)
      } catch (e) {}
    }
  }, [patientId])

  // Auto-save draft on change
  useEffect(() => {
    if (!patientId || (!rxDiagnosis && !rxSymptoms && !rxNotes)) return
    const draft = { diagnosis: rxDiagnosis, symptoms: rxSymptoms, notes: rxNotes, medications: rxMedications }
    localStorage.setItem(`erx_draft_${patientId}`, JSON.stringify(draft))
  }, [rxDiagnosis, rxSymptoms, rxNotes, rxMedications, patientId])

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => getPatient(patientId),
    enabled: !!patientId,
  })

  const { data: rxData, isLoading: isRxLoading } = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: () => listPrescriptions(patientId),
    enabled: !!patientId && (activeTab === "prescriptions" || isRxModalOpen),
  })

  const createRxMutation = useMutation({
    mutationFn: (payload: Partial<Prescription>) => createPrescription(payload),
    onSuccess: () => {
      localStorage.removeItem(`erx_draft_${patientId}`)
      queryClient.invalidateQueries({ queryKey: ["patient-prescriptions", patientId] })
      setIsRxModalOpen(false)
      setRxDiagnosis("")
      setRxSymptoms("")
      setRxNotes("")
    },
  })



  const { data: timelineData, isLoading: isTimelineLoading } = useQuery({
    queryKey: ["patient-timeline", patientId],
    queryFn: () => getPatientTimeline(patientId),
    enabled: !!patientId && activeTab === "timeline",
  })

  const { data: docsData, isLoading: isDocsLoading } = useQuery({
    queryKey: ["patient-documents", patientId],
    queryFn: () => listPatientDocuments(patientId),
    enabled: !!patientId && activeTab === "documents",
  })

  // Loosened from `activeTab === "appointments"` so the header's "Treating doctor"
  // derivation has data on initial page load regardless of the active tab.
  const { data: appointmentsData, isLoading: isApptsLoading } = useQuery({
    queryKey: ["patient-appointments", patientId],
    queryFn: () => listAppointments({ patient: String(patientId) }),
    enabled: !!patientId,
  })

  const { data: messagesData, isLoading: isMsgsLoading } = useQuery({
    queryKey: ["patient-messages", patientId],
    queryFn: () => listMessages(patientId),
    enabled: !!patientId && activeTab === "messages",
  })

  const { data: billingData } = useQuery({
    queryKey: ["patient-billing", patientId],
    queryFn: () => listHisBilling(patientId),
    enabled: !!patientId,
  })

  const { data: consentData, isLoading: isConsentLoading } = useQuery({
    queryKey: ["patient-consent", patientId],
    queryFn: () => listConsent(patientId),
    enabled: !!patientId && activeTab === "consents",
  })

  const { data: doctorsData } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => listDoctors(),
  })

  const uploadMutation = useMutation({
    mutationFn: (fd: FormData) => uploadPatientDocument(fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-documents", patientId] })
      setIsDocModalOpen(false)
      setDocTitle("")
      setDocNotes("")
      setSelectedFile(null)
    },
  })

  const handleDocSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!docTitle || !selectedFile) return
    const formData = new FormData()
    formData.append("patient", String(patientId))
    formData.append("category", docCategory)
    formData.append("title", docTitle)
    formData.append("notes", docNotes)
    formData.append("file", selectedFile)
    uploadMutation.mutate(formData)
  }

  if (isLoading) return <LoadingState />
  if (isError || !patient) return <ErrorState />

  const documents = docsData?.results ?? []
  const appointments = appointmentsData?.results ?? []
  const messages = messagesData?.results ?? []
  const timeline = timelineData ?? []
  const billingRecords = billingData?.results ?? []
  const consentRows = consentData?.results ?? []
  const doctorsList = doctorsData?.results ?? []

  const outstandingDues = billingRecords
    .filter((r) => r.status === "outstanding" || r.status === "partial")
    .reduce((sum, r) => sum + Number(r.outstanding_amount), 0)
  const lifetimeBilled = billingRecords.reduce((sum, r) => sum + Number(r.total_amount), 0)

  const doctorName = (doctorId: number) => doctorsList.find((d) => d.id === doctorId)?.name ?? `Doctor #${doctorId}`

  const treatingAppointment = [...appointments]
    .filter((a) => TREATING_STATUSES.includes(a.status))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  const treatingDoctorLabel = treatingAppointment ? doctorName(treatingAppointment.doctor) : "—"

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/patients")}>
          ← Back to directory
        </Button>
      </div>

      {/* Patient header */}
      <Card padded>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex gap-3.5">
            <Avatar name={patient.full_name || `${patient.first_name} ${patient.last_name}`} size={46} />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[19px] font-semibold">
                  {patient.full_name || `${patient.first_name} ${patient.last_name}`}
                </div>
                {patient.is_active ? <SuccessTag>Active patient</SuccessTag> : <NeutralTag>Inactive</NeutralTag>}
                <NeutralTag>{(patient.preferred_language || "en").toUpperCase()}</NeutralTag>
              </div>
              <div className="text-[12.5px] text-ink-4 mt-1">
                MRN #{patient.id} · Registered {new Date(patient.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="primary" size="sm" onClick={() => setIsRxModalOpen(true)}>
              💊 + Write e-Rx
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate(`/console?mobile=${patient.mobile}`)}>
              Call screen-pop
            </Button>
          </div>
        </div>


        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-4 pt-4 border-t border-border-soft text-[13px]">
          <div>
            <div className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-semibold mb-0.5">Mobile</div>
            <div className="text-ink-2 font-mono">{patient.mobile}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-semibold mb-0.5">Email</div>
            <div className="text-ink-2">{patient.email || "—"}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-semibold mb-0.5">Gender / City</div>
            <div className="text-ink-2 capitalize">
              {patient.gender || "N/A"} {patient.city ? `· ${patient.city}` : ""}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-semibold mb-0.5">Alt. mobile</div>
            <div className="text-ink-2 font-mono">{patient.alternate_mobile || "—"}</div>
          </div>
        </div>
      </Card>

      {/* Account + Linked people */}
      <div className="grid grid-cols-2 gap-3.5">
        <AccountCard patient={patient} outstandingDues={outstandingDues} lifetimeBilled={lifetimeBilled} />
        <LinkedPeopleCard patient={patient} treatingDoctorLabel={treatingDoctorLabel} />
      </div>
      <RecallCard patient={patient} />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === tab.key ? "border-brand text-brand" : "border-transparent text-ink-4 hover:text-ink-2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab contents */}
      {activeTab === "timeline" && (
        <Card padded>
          <Eyebrow>Interaction timeline</Eyebrow>
          {isTimelineLoading ? (
            <LoadingState />
          ) : timeline.length === 0 ? (
            <EmptyState message="No recorded timeline events for this patient yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {timeline.map((item) => (
                <div key={item.id} className="flex gap-2.5 items-start pb-3 border-b border-border-faint last:border-0 last:pb-0">
                  <NeutralTag>{item.event_type}</NeutralTag>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink leading-relaxed">{item.summary}</div>
                    <div className="text-[11px] text-ink-5 mt-0.5">{new Date(item.occurred_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* e-Prescriptions Tab */}
      {activeTab === "prescriptions" && (
        <Card padded>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] tracking-[.08em] uppercase text-ink-4 font-semibold">Digital e-Prescriptions (e-Rx)</div>
            <Button size="sm" variant="primary" onClick={() => setIsRxModalOpen(true)}>
              + Write New e-Rx
            </Button>
          </div>

          {isRxLoading ? (
            <LoadingState />
          ) : !rxData?.results?.length ? (
            <EmptyState message="No e-Prescriptions issued for this patient yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {rxData.results.map((rx) => (
                <div key={rx.id} className="border border-border rounded-lg p-3 bg-surface hover:border-brand/40 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand text-sm">℞</span>
                      <span className="font-bold text-[13px] text-ink">{rx.diagnosis}</span>
                    </div>
                    <span className="text-[11px] text-ink-5">{new Date(rx.created_at).toLocaleString()}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs mb-2 text-ink-3">
                    <div>
                      <span className="font-semibold text-ink-4">Prescribed Medicines:</span>
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                        {rx.medications.map((m, idx) => (
                          <li key={idx}>
                            <span className="font-medium text-ink">{m.name}</span> ({m.dosage} - {m.duration})
                          </li>
                        ))}
                      </ul>
                    </div>
                    {!!rx.lab_orders?.length && (
                      <div>
                        <span className="font-semibold text-ink-4">Diagnostic Lab Orders:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rx.lab_orders.map((lab, idx) => (
                            <NeutralTag key={idx}>{lab}</NeutralTag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border-faint text-xs">
                    <span className="text-ink-5 font-medium">Doctor: {rx.doctor_name || "OPD Consultant"}</span>
                    <Button size="sm" variant="secondary" onClick={() => setViewingRx(rx)}>
                      🖨️ View & Print Prescription PDF
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "documents" && (
        <Card padded>

          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[11px] tracking-[.08em] uppercase text-ink-4 font-semibold">Document vault</div>
            <Button size="sm" variant="primary" onClick={() => setIsDocModalOpen(true)}>
              + Upload document
            </Button>
          </div>

          {isDocsLoading ? (
            <LoadingState />
          ) : documents.length === 0 ? (
            <EmptyState message="No medical reports, prescriptions, or ID proofs uploaded yet." />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {documents.map((doc) => (
                <div key={doc.id} className="border border-border rounded-control p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <NeutralTag>{doc.category}</NeutralTag>
                    <span className="text-[11px] text-ink-5">{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-[13px] font-semibold truncate">{doc.title}</div>
                  {doc.notes && <div className="text-[11.5px] text-ink-4 mt-1">{doc.notes}</div>}
                  {doc.file && (
                    <a
                      href={doc.file}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-[11.5px] font-semibold text-brand hover:underline mt-2"
                    >
                      Download →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "appointments" && (
        <Card padded>
          <Eyebrow>OPD appointments</Eyebrow>
          {isApptsLoading ? (
            <LoadingState />
          ) : appointments.length === 0 ? (
            <EmptyState message="No OPD appointments recorded for this patient." />
          ) : (
            <div className="flex flex-col">
              {appointments.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between py-2.5 border-b border-border-faint last:border-0">
                  <div>
                    <div className="text-[13px] font-semibold">Appointment #{appt.id}</div>
                    <div className="text-[11.5px] text-ink-4 mt-0.5">
                      {doctorName(appt.doctor)} · {appt.reason || "General OPD"} · Created{" "}
                      {new Date(appt.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <NeutralTag>{appt.status}</NeutralTag>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "messages" && (
        <Card padded>
          <Eyebrow>Omnichannel messages</Eyebrow>
          {isMsgsLoading ? (
            <LoadingState />
          ) : messages.length === 0 ? (
            <EmptyState message="No sent or received messages for this patient." />
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded-control max-w-[70%] text-[13px] ${
                    msg.direction === "outbound" ? "ml-auto bg-brand-tint text-ink" : "mr-auto bg-page text-ink"
                  }`}
                >
                  <div className="flex justify-between items-center gap-4 text-[11px] text-ink-4 mb-1">
                    <span className="font-semibold capitalize">
                      {msg.channel} ({msg.direction})
                    </span>
                    <span>{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                  <div>{msg.body}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "consents" && (
        <Card padded>
          <Eyebrow>Consent & opt-outs</Eyebrow>
          {isConsentLoading ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-[110px_repeat(3,1fr)] gap-y-3 gap-x-3 text-[12.5px] items-center">
              <div />
              {PURPOSES.map((purpose) => (
                <div key={purpose} className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-semibold">
                  {PURPOSE_LABELS[purpose]}
                </div>
              ))}
              {CHANNELS.map((channel) => (
                <Fragment key={channel}>
                  <div className="font-semibold text-ink-2">{CHANNEL_LABELS[channel]}</div>
                  {PURPOSES.map((purpose) => {
                    const existing = consentRows.find((r) => r.channel === channel && r.purpose === purpose)
                    return (
                      <ConsentToggle key={purpose} patientId={patientId} channel={channel} purpose={purpose} existing={existing} />
                    )
                  })}
                </Fragment>
              ))}
            </div>
          )}
          <div className="text-[11.5px] text-ink-5 mt-3 pt-3 border-t border-border-faint">
            Opted-in channels may still be suppressed by regulatory quiet hours.
          </div>
        </Card>
      )}

      {/* Upload Document Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setIsDocModalOpen(false)}>
          <div className="bg-surface rounded-card p-5 w-[420px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-semibold mb-3">Upload patient document</div>
            <form onSubmit={handleDocSubmit} className="flex flex-col gap-2.5">
              <div>
                <div className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-semibold mb-1">Category</div>
                <select
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]"
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as any)}
                >
                  <option value="report">Lab / scan report</option>
                  <option value="prescription">Prescription</option>
                  <option value="insurance_card">Insurance card</option>
                  <option value="consent">Consent form</option>
                  <option value="id_proof">ID proof</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-semibold mb-1">Title *</div>
                <input
                  required
                  type="text"
                  placeholder="e.g. Blood test report, Aadhaar card"
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-semibold mb-1">Notes</div>
                <textarea
                  rows={2}
                  className="w-full border border-border rounded-control p-2.5 text-[13px] leading-relaxed outline-none focus:border-brand"
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                />
              </div>

              <div>
                <div className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-semibold mb-1">File *</div>
                <input required type="file" className="w-full text-[12.5px]" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <Button type="button" variant="secondary" onClick={() => setIsDocModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={uploadMutation.isPending}>
                  {uploadMutation.isPending ? "Uploading…" : "Upload file"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Write e-Prescription Modal */}
      {isRxModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="erx-title"
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => {
            if ((rxDiagnosis.trim() || rxSymptoms.trim()) && !window.confirm("You have unsaved prescription draft entries. Discard draft?")) {
              return
            }
            setIsRxModalOpen(false)
          }}
        >
          <div className="bg-surface rounded-card p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div id="erx-title" className="text-[16px] font-bold text-ink flex items-center gap-2">
                <span className="text-brand text-lg">💊</span> Write OPD e-Prescription (e-Rx)
              </div>
              <button
                onClick={() => {
                  if ((rxDiagnosis.trim() || rxSymptoms.trim()) && !window.confirm("You have unsaved prescription draft entries. Discard draft?")) {
                    return
                  }
                  setIsRxModalOpen(false)
                }}
                className="text-ink-5 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>


            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!rxDiagnosis) return
                createRxMutation.mutate({
                  patient: patientId,
                  diagnosis: rxDiagnosis,
                  symptoms: rxSymptoms,
                  medications: rxMedications.filter((m) => m.name.trim()),
                  lab_orders: rxLabOrders,
                  notes: rxNotes,
                })
              }}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-bold block mb-1">
                  Diagnosis (ICD-10 / Clinical Finding) *
                </label>
                <input
                  autoFocus
                  required
                  type="text"
                  placeholder="e.g. Essential Hypertension, Acute Bronchitis, Type 2 Diabetes"
                  className="w-full h-9 px-3 border border-border-strong rounded-control text-xs outline-none focus:border-brand font-semibold"
                  value={rxDiagnosis}
                  onChange={(e) => setRxDiagnosis(e.target.value)}
                />
              </div>


              <div>
                <label className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-bold block mb-1">
                  Symptoms & Clinical Presenting Complaints
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dry cough for 3 days, mild fever, chest congestion"
                  className="w-full h-9 px-3 border border-border rounded-control text-xs outline-none focus:border-brand"
                  value={rxSymptoms}
                  onChange={(e) => setRxSymptoms(e.target.value)}
                />
              </div>

              {/* Dynamic Medications Builder */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-bold">
                    Prescribed Rx Medications
                  </label>
                  <button
                    type="button"
                    onClick={() => setRxMedications([...rxMedications, { name: "", dosage: "1-0-1", duration: "5 Days" }])}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    + Add Drug
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {rxMedications.map((med, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        placeholder="Drug Name (e.g. Paracetamol 500mg)"
                        className="flex-1 h-8 px-2.5 border border-border rounded-control text-xs outline-none focus:border-brand"
                        value={med.name}
                        onChange={(e) => {
                          const copy = [...rxMedications]
                          copy[idx].name = e.target.value
                          setRxMedications(copy)
                        }}
                      />
                      <select
                        className="w-24 h-8 px-2 border border-border rounded-control text-xs bg-surface"
                        value={med.dosage}
                        onChange={(e) => {
                          const copy = [...rxMedications]
                          copy[idx].dosage = e.target.value
                          setRxMedications(copy)
                        }}
                      >
                        <option value="1-0-1">1-0-1 (BD)</option>
                        <option value="1-1-1">1-1-1 (TDS)</option>
                        <option value="1-0-0">1-0-0 (OD AM)</option>
                        <option value="0-0-1">0-0-1 (HS PM)</option>
                        <option value="STAT">STAT (SOS)</option>
                      </select>
                      <input
                        placeholder="Duration"
                        className="w-24 h-8 px-2 border border-border rounded-control text-xs"
                        value={med.duration}
                        onChange={(e) => {
                          const copy = [...rxMedications]
                          copy[idx].duration = e.target.value
                          setRxMedications(copy)
                        }}
                      />
                      {rxMedications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRxMedications(rxMedications.filter((_, i) => i !== idx))}
                          className="text-xs text-danger-text px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Lab Orders Checklist */}
              <div>
                <label className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-bold block mb-1.5">
                  Diagnostic Lab Orders
                </label>
                <div className="flex flex-wrap gap-2">
                  {["CBC", "Chest X-Ray", "ECG", "Lipid Profile", "HbA1c", "KFT / RFT", "Urinary Routine"].map((lab) => {
                    const isChecked = rxLabOrders.includes(lab)
                    return (
                      <button
                        type="button"
                        key={lab}
                        onClick={() => {
                          if (isChecked) setRxLabOrders(rxLabOrders.filter((l) => l !== lab))
                          else setRxLabOrders([...rxLabOrders, lab])
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          isChecked ? "bg-brand text-white border-brand font-semibold" : "bg-page text-ink-3 border-border"
                        }`}
                      >
                        {isChecked ? `✓ ${lab}` : `+ ${lab}`}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[.06em] text-ink-4 font-bold block mb-1">
                  Advice & Lifestyle Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Drink plenty of warm fluids, avoid cold water, review after 5 days"
                  className="w-full border border-border rounded-control p-2.5 text-xs outline-none focus:border-brand"
                  value={rxNotes}
                  onChange={(e) => setRxNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="secondary" onClick={() => setIsRxModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={createRxMutation.isPending}>
                  {createRxMutation.isPending ? "Generating e-Rx…" : "Issue e-Prescription"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Prescription PDF Preview Modal */}
      {viewingRx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingRx(null)}>
          <div className="bg-white text-slate-900 rounded-card p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Prescription Letterhead Header */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-slate-800">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">{authUser?.hospital_name || "Hospital name not set"}</h2>
                {(authUser?.hospital_address || authUser?.hospital_city || authUser?.hospital_state) && (
                  <p className="text-xs text-slate-500">
                    {[authUser?.hospital_address, authUser?.hospital_city, authUser?.hospital_state].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="inline-block bg-slate-900 text-white font-bold text-xs px-2.5 py-1 rounded">OPD e-PRESCRIPTION</span>
                <p className="text-xs font-mono text-slate-500 mt-1">Rx #{viewingRx.id}</p>
                <p className="text-xs text-slate-500">{new Date(viewingRx.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Patient & Doctor Meta */}
            <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-200 text-xs text-slate-700 bg-slate-50 px-3 my-3 rounded">
              <div>
                <p><span className="font-bold text-slate-900">Patient:</span> {patient.full_name} ({patient.gender}, MRN #{patient.id})</p>
                <p><span className="font-bold text-slate-900">Mobile:</span> {patient.mobile}</p>
              </div>
              <div>
                <p><span className="font-bold text-slate-900">Consultant Doctor:</span> {viewingRx.doctor_name || "—"}</p>
                <p><span className="font-bold text-slate-900">Department:</span> OPD Consult</p>
              </div>
            </div>

            {/* Diagnosis */}
            <div className="my-4">
              <span className="font-bold text-xs uppercase text-slate-500 tracking-wider">Clinical Diagnosis</span>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{viewingRx.diagnosis}</p>
              {viewingRx.symptoms && <p className="text-xs text-slate-600">Complaints: {viewingRx.symptoms}</p>}
            </div>

            {/* Rx Symbol & Medication Table */}
            <div className="my-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-serif font-bold text-emerald-700">℞</span>
                <span className="font-bold text-xs uppercase text-slate-500 tracking-wider">Prescribed Medicines</span>
              </div>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Medicine / Drug Name</th>
                    <th className="py-2 px-2">Dosage Pattern</th>
                    <th className="py-2 px-2">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingRx.medications.map((m, idx) => (
                    <tr key={idx} className="border-b border-slate-200">
                      <td className="py-2 px-2 text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2 font-bold text-slate-900">{m.name}</td>
                      <td className="py-2 px-2 font-mono">{m.dosage}</td>
                      <td className="py-2 px-2 text-slate-600">{m.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Diagnostic Lab Orders */}
            {!!viewingRx.lab_orders?.length && (
              <div className="my-4">
                <span className="font-bold text-xs uppercase text-slate-500 tracking-wider">Diagnostic Lab Orders</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {viewingRx.lab_orders.map((lab, idx) => (
                    <span key={idx} className="bg-slate-200 text-slate-800 font-semibold text-xs px-2.5 py-1 rounded">
                      🧪 {lab}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Advice */}
            {viewingRx.notes && (
              <div className="my-4 text-xs">
                <span className="font-bold uppercase text-slate-500 tracking-wider">Doctor Advice</span>
                <p className="text-slate-700 mt-0.5 italic">{viewingRx.notes}</p>
              </div>
            )}

            {/* Doctor Signature Line */}
            <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-end text-xs">
              <div className="text-slate-500">
                <p>Generated via Polynexus Hospital CRM e-Rx</p>
                <p>Digital Record Verified ✓</p>
              </div>
              <div className="text-center">
                <div className="font-serif italic font-bold text-emerald-800 text-sm">{viewingRx.doctor_name || "Dr. Ramesh Kulkarni"}</div>
                <p className="border-t border-slate-400 pt-0.5 text-slate-700 font-semibold mt-1">Doctor Signature / Stamp</p>
              </div>
            </div>

            {/* Print & Close Controls */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setViewingRx(null)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                🖨️ Print Prescription PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

