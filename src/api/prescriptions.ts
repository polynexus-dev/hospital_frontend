import { api } from "./client"
import type { Paginated } from "../types/api"

export interface Medication {
  name: string
  dosage: string   // e.g. "1-0-1"
  duration: string // e.g. "5 Days"
}

export interface Prescription {
  id: number
  patient: number
  patient_name: string
  doctor?: number
  doctor_name?: string
  diagnosis: string
  symptoms?: string
  medications: Medication[]
  lab_orders: string[]
  notes?: string
  created_at: string
}

export function listPrescriptions(patientId?: number) {
  const query = patientId ? `?patient=${patientId}` : ""
  return api.get<Paginated<Prescription>>(`/prescriptions/${query}`)
}

export function createPrescription(payload: Partial<Prescription>) {
  return api.post<Prescription>("/prescriptions/", payload)
}
