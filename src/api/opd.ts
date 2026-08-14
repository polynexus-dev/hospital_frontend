import { api } from "./client"
import type { Paginated } from "../types/api"

export interface Encounter {
  id: number
  appointment: number
  patient: number
  patient_name: string
  doctor: number
  doctor_name: string
  department: number | null
  created_at: string
}

export interface VitalsReading {
  id: number
  encounter: number
  recorded_by: number | null
  height_cm: string | null
  weight_kg: string | null
  bp_systolic: number | null
  bp_diastolic: number | null
  pulse: number | null
  temperature_c: string | null
  spo2: number | null
  recorded_at: string
}

export interface ClinicalNote {
  id: number
  encounter: number
  doctor: number
  chief_complaints: string
  history: string
  examination_findings: string
  finalized_at: string | null
  finalized_by: number | null
  created_at: string
  updated_at: string
}

export interface Diagnosis {
  id: number
  encounter: number
  icd_code: string
  description: string
  diagnosis_type: "provisional" | "final"
  created_by: number | null
  finalized_at: string | null
  finalized_by: number | null
  created_at: string
}

// Returns the single Encounter for an appointment, or null if none exists
// yet (e.g. the appointment hasn't been checked in — see
// apps.opd.signals.create_encounter_on_check_in).
export async function fetchEncounterForAppointment(appointmentId: number): Promise<Encounter | null> {
  const page = await api.get<Paginated<Encounter>>(`/opd/encounters/?appointment=${appointmentId}`)
  return page.results[0] ?? null
}

export function listVitals(encounterId: number) {
  return api.get<Paginated<VitalsReading>>(`/opd/vitals/?encounter=${encounterId}`)
}

export function recordVitals(payload: Partial<VitalsReading> & { encounter: number }) {
  return api.post<VitalsReading>("/opd/vitals/", payload)
}

export function listClinicalNotes(encounterId: number) {
  return api.get<Paginated<ClinicalNote>>(`/opd/clinical-notes/?encounter=${encounterId}`)
}

export function createClinicalNote(payload: { encounter: number; chief_complaints?: string; history?: string; examination_findings?: string }) {
  return api.post<ClinicalNote>("/opd/clinical-notes/", payload)
}

export function updateClinicalNote(id: number, payload: Partial<Pick<ClinicalNote, "chief_complaints" | "history" | "examination_findings">>) {
  return api.patch<ClinicalNote>(`/opd/clinical-notes/${id}/`, payload)
}

export function finalizeClinicalNote(id: number) {
  return api.post<ClinicalNote>(`/opd/clinical-notes/${id}/finalize/`)
}

export function listDiagnoses(encounterId: number) {
  return api.get<Paginated<Diagnosis>>(`/opd/diagnoses/?encounter=${encounterId}`)
}

export function addDiagnosis(payload: { encounter: number; description: string; icd_code?: string; diagnosis_type?: Diagnosis["diagnosis_type"] }) {
  return api.post<Diagnosis>("/opd/diagnoses/", payload)
}

export function finalizeDiagnosis(id: number) {
  return api.post<Diagnosis>(`/opd/diagnoses/${id}/finalize/`)
}
