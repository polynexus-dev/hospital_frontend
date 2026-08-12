import { api } from "./client"
import type { Document, Paginated, Patient, PatientLookup, TimelineEvent } from "../types/api"

export function listPatients(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ""
  return api.get<Paginated<Patient>>(`/patients/${qs}`)
}

export function getPatient(id: number | string) {
  return api.get<Patient>(`/patients/${id}/`)
}

export function lookupPatientByMobile(mobile: string) {
  return api.get<PatientLookup[]>(`/patients/lookup/?mobile=${encodeURIComponent(mobile)}`)
}

export function getPatientTimeline(id: number | string) {
  return api.get<TimelineEvent[]>(`/patients/${id}/timeline/`)
}

export function listPatientDocuments(patientId: number | string) {
  return api.get<Paginated<Document>>(`/documents/?patient=${patientId}`)
}

export function createPatient(payload: Partial<Patient>) {
  return api.post<Patient>("/patients/", payload)
}

export function updatePatient(id: number | string, payload: Partial<Patient>) {
  return api.patch<Patient>(`/patients/${id}/`, payload)
}

export function uploadPatientDocument(formData: FormData) {
  return api.post<Document>("/documents/", formData)
}

