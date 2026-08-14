import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader, Eyebrow } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Pill } from "../../components/ui/Pill"
import type { Tone } from "../../components/ui/tone"
import { LoadingState } from "../../components/ui/QueryStates"
import { listBeds, listRooms, listWards, type Bed, type BedStatus } from "../../api/facilities"
import { admitPatient, listAdmissions } from "../../api/ipd"
import { listDoctors } from "../../api/appointments"
import { listPatients } from "../../api/patients"
import { AdmissionDetailPanel } from "./AdmissionDetailPanel"

const BED_STATUS_TONE: Record<BedStatus, Tone> = {
  available: "ok",
  occupied: "info",
  maintenance: "bad",
  reserved: "warn",
}

const BED_STATUS_LABELS: Record<BedStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  maintenance: "Maintenance",
  reserved: "Reserved",
}

export function IPDPage() {
  const queryClient = useQueryClient()
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<number | null>(null)
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false)
  const [admitDraft, setAdmitDraft] = useState({ patient: 0, admitting_doctor: 0, bed: 0, admission_diagnosis: "" })
  const [showDischarged, setShowDischarged] = useState(false)

  const wardsQuery = useQuery({ queryKey: ["wards"], queryFn: () => listWards() })
  const roomsQuery = useQuery({ queryKey: ["rooms"], queryFn: () => listRooms() })
  const bedsQuery = useQuery({ queryKey: ["beds"], queryFn: () => listBeds() })
  const admissionsQuery = useQuery({
    queryKey: ["admissions", showDischarged],
    queryFn: () => listAdmissions(showDischarged ? {} : { status: "admitted" }),
  })
  const doctorsQuery = useQuery({ queryKey: ["doctors"], queryFn: () => listDoctors() })
  const patientsQuery = useQuery({ queryKey: ["patients-dropdown"], queryFn: () => listPatients() })

  const wards = wardsQuery.data?.results ?? []
  const rooms = roomsQuery.data?.results ?? []
  const beds = bedsQuery.data?.results ?? []
  const admissions = admissionsQuery.data?.results ?? []
  const doctors = (doctorsQuery.data?.results ?? []).filter((d) => d.is_active)
  const patients = patientsQuery.data?.results ?? []

  const roomsByWard = useMemo(() => {
    const map = new Map<number, typeof rooms>()
    for (const room of rooms) map.set(room.ward, [...(map.get(room.ward) ?? []), room])
    return map
  }, [rooms])
  const bedsByRoom = useMemo(() => {
    const map = new Map<number, Bed[]>()
    for (const bed of beds) map.set(bed.room, [...(map.get(bed.room) ?? []), bed])
    return map
  }, [beds])

  const occupiedCount = beds.filter((b) => b.status === "occupied").length
  const occupancyPct = beds.length ? Math.round((occupiedCount / beds.length) * 100) : 0

  const availableBeds = beds.filter((b) => b.status === "available")

  const admitMutation = useMutation({
    mutationFn: () => admitPatient(admitDraft),
    onSuccess: () => {
      setIsAdmitModalOpen(false)
      setAdmitDraft({ patient: 0, admitting_doctor: 0, bed: 0, admission_diagnosis: "" })
      queryClient.invalidateQueries({ queryKey: ["admissions"] })
      queryClient.invalidateQueries({ queryKey: ["beds"] })
    },
  })

  const selectedAdmission = admissions.find((a) => a.id === selectedAdmissionId) ?? null

  if (wardsQuery.isLoading || admissionsQuery.isLoading) return <LoadingState />

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold">IPD</div>
          <div className="text-[12.5px] text-ink-4">
            {occupiedCount} of {beds.length} beds occupied ({occupancyPct}%)
          </div>
        </div>
        <Button variant="primary" onClick={() => setIsAdmitModalOpen(true)}>Admit patient</Button>
      </div>

      <Card padded>
        <CardHeader>
          <Eyebrow>Bed board</Eyebrow>
        </CardHeader>
        <div className="flex flex-col gap-3">
          {wards.map((ward) => (
            <div key={ward.id}>
              <div className="text-[12.5px] font-semibold mb-1.5">{ward.name}</div>
              <div className="flex flex-wrap gap-1.5">
                {(roomsByWard.get(ward.id) ?? []).flatMap((room) => bedsByRoom.get(room.id) ?? []).map((bed) => (
                  <div key={bed.id} className="border border-border-strong rounded-control px-2.5 py-1.5 text-[12px] min-w-[64px]">
                    <div className="font-semibold">{bed.bed_number}</div>
                    <Pill tone={BED_STATUS_TONE[bed.status]}>{BED_STATUS_LABELS[bed.status]}</Pill>
                  </div>
                ))}
                {(roomsByWard.get(ward.id) ?? []).length === 0 && <div className="text-[12px] text-ink-5">No rooms configured.</div>}
              </div>
            </div>
          ))}
          {wards.length === 0 && <div className="text-[12.5px] text-ink-4">No wards configured yet.</div>}
        </div>
      </Card>

      <Card padded>
        <CardHeader>
          <Eyebrow>Admissions</Eyebrow>
          <button className="text-[12px] text-brand font-semibold" onClick={() => setShowDischarged((v) => !v)}>
            {showDischarged ? "Show admitted only" : "Show all"}
          </button>
        </CardHeader>
        <div className="flex flex-col gap-1.5">
          {admissions.map((admission) => (
            <button
              key={admission.id}
              className="flex items-center justify-between text-left px-2.5 py-2 rounded-control hover:bg-page text-[12.5px]"
              onClick={() => setSelectedAdmissionId(admission.id)}
            >
              <span>{admission.patient_name} · {admission.doctor_name} · {admission.bed_label}</span>
              <Pill tone={admission.status === "admitted" ? "info" : "neutral"}>{admission.status}</Pill>
            </button>
          ))}
          {admissions.length === 0 && <div className="text-[12.5px] text-ink-4">No admissions.</div>}
        </div>
      </Card>

      {isAdmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setIsAdmitModalOpen(false)}>
          <div className="bg-surface rounded-card p-5 w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-semibold mb-3">Admit patient</div>
            <div className="space-y-2.5">
              <select className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]" value={admitDraft.patient} onChange={(e) => setAdmitDraft({ ...admitDraft, patient: Number(e.target.value) })}>
                <option value={0}>Select patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name || `${p.first_name} ${p.last_name}`}</option>
                ))}
              </select>
              <select className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]" value={admitDraft.admitting_doctor} onChange={(e) => setAdmitDraft({ ...admitDraft, admitting_doctor: Number(e.target.value) })}>
                <option value={0}>Select admitting doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <select className="w-full h-9 px-3 border border-border-strong rounded-control text-[13px]" value={admitDraft.bed} onChange={(e) => setAdmitDraft({ ...admitDraft, bed: Number(e.target.value) })}>
                <option value={0}>Select an available bed…</option>
                {availableBeds.map((b) => (
                  <option key={b.id} value={b.id}>{b.bed_number}</option>
                ))}
              </select>
              <textarea
                rows={2}
                placeholder="Admission diagnosis"
                className="w-full border border-border rounded-control p-2 text-[13px]"
                value={admitDraft.admission_diagnosis}
                onChange={(e) => setAdmitDraft({ ...admitDraft, admission_diagnosis: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-3.5">
              <Button variant="secondary" onClick={() => setIsAdmitModalOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => admitMutation.mutate()}
                disabled={!admitDraft.patient || !admitDraft.admitting_doctor || !admitDraft.bed || admitMutation.isPending}
              >
                {admitMutation.isPending ? "Admitting…" : "Admit"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedAdmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectedAdmissionId(null)}>
          <div className="bg-surface rounded-card p-5 w-full max-w-[560px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="text-[15px] font-semibold">{selectedAdmission.patient_name}</div>
              <Pill tone={selectedAdmission.status === "admitted" ? "info" : "neutral"}>{selectedAdmission.status}</Pill>
            </div>
            <div className="text-[12.5px] text-ink-4 mb-4">
              {selectedAdmission.doctor_name} · {selectedAdmission.bed_label}
            </div>

            <AdmissionDetailPanel admission={selectedAdmission} onDischarged={() => setSelectedAdmissionId(null)} />

            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={() => setSelectedAdmissionId(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
