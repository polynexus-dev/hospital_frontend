import { api } from "./client"
import type { Paginated } from "../types/api"

export interface NursingNote {
  id: number
  admission_id: string
  nurse: number | null
  note: string
  created_at: string
}

export interface MedicationAdministration {
  id: number
  admission_id: string
  prescription: number | null
  medication_name: string
  dose: string
  nurse: number | null
  administered_at: string
  notes: string
}

export interface IntakeOutput {
  id: number
  admission_id: string
  recorded_by: number | null
  intake_ml: number | null
  output_ml: number | null
  recorded_at: string
  notes: string
}

export function listNursingNotes(admissionId: number) {
  return api.get<Paginated<NursingNote>>(`/nursing/notes/?admission=${admissionId}`)
}

export function addNursingNote(admission: number, note: string) {
  return api.post<NursingNote>("/nursing/notes/", { admission, note })
}

export function listMedicationAdministrations(admissionId: number) {
  return api.get<Paginated<MedicationAdministration>>(`/nursing/medication-administrations/?admission=${admissionId}`)
}

export function recordMedicationAdministration(payload: { admission: number; medication_name: string; dose?: string; notes?: string }) {
  return api.post<MedicationAdministration>("/nursing/medication-administrations/", payload)
}

export function listIntakeOutput(admissionId: number) {
  return api.get<Paginated<IntakeOutput>>(`/nursing/intake-output/?admission=${admissionId}`)
}

export function recordIntakeOutput(payload: { admission: number; intake_ml?: number; output_ml?: number; notes?: string }) {
  return api.post<IntakeOutput>("/nursing/intake-output/", payload)
}
