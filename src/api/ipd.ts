import { api } from "./client"
import type { Paginated } from "../types/api"

export type AdmissionStatus = "admitted" | "discharged" | "dama" | "deceased"

export interface Admission {
  id: number
  patient: number
  patient_name: string
  admitting_doctor: number
  doctor_name: string
  department: number | null
  bed: number
  bed_label: string
  source_encounter: number | null
  admission_type: "planned" | "emergency"
  status: AdmissionStatus
  admission_diagnosis: string
  admitted_at: string
  discharged_at: string | null
}

export interface DoctorProgressNote {
  id: number
  admission: number
  doctor: number
  note: string
  finalized_at: string | null
  finalized_by: number | null
  created_at: string
}

export interface DischargeSummary {
  id: number
  admission: number
  final_diagnosis: string
  procedures_performed: string
  treatment_summary: string
  discharge_medications: string
  follow_up_instructions: string
  discharge_type: "routine" | "dama" | "referred" | "deceased"
  prepared_by: number | null
  finalized_at: string | null
  finalized_by: number | null
  created_at: string
}

export interface WardTransfer {
  id: number
  admission: number
  from_bed: number
  to_bed: number
  reason: string
  requested_by: number | null
  approved_by: number | null
  requested_at: string
  transferred_at: string | null
}

export function listAdmissions(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Admission>>(`/ipd/admissions/${qs ? `?${qs}` : ""}`)
}

export function admitPatient(payload: {
  patient: number
  admitting_doctor: number
  bed: number
  department?: number
  admission_type?: "planned" | "emergency"
  admission_diagnosis?: string
  source_encounter?: number
}) {
  return api.post<Admission>("/ipd/admissions/", payload)
}

export function dischargeAdmission(id: number, status: AdmissionStatus = "discharged") {
  return api.post<Admission>(`/ipd/admissions/${id}/discharge/`, { status })
}

export function listProgressNotes(admissionId: number) {
  return api.get<Paginated<DoctorProgressNote>>(`/ipd/progress-notes/?admission=${admissionId}`)
}

export function addProgressNote(admission: number, note: string) {
  return api.post<DoctorProgressNote>("/ipd/progress-notes/", { admission, note })
}

export function finalizeProgressNote(id: number) {
  return api.post<DoctorProgressNote>(`/ipd/progress-notes/${id}/finalize/`)
}

export function listDischargeSummaries(admissionId: number) {
  return api.get<Paginated<DischargeSummary>>(`/ipd/discharge-summaries/?admission=${admissionId}`)
}

export function createDischargeSummary(payload: Partial<DischargeSummary> & { admission: number }) {
  return api.post<DischargeSummary>("/ipd/discharge-summaries/", payload)
}

export function finalizeDischargeSummary(id: number) {
  return api.post<DischargeSummary>(`/ipd/discharge-summaries/${id}/finalize/`)
}

export function requestWardTransfer(payload: { admission: number; to_bed: number; reason?: string }) {
  return api.post<WardTransfer>("/ipd/ward-transfers/", payload)
}

export function approveWardTransfer(id: number) {
  return api.post<WardTransfer>(`/ipd/ward-transfers/${id}/approve/`)
}
