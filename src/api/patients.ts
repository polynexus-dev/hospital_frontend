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

export interface RecallPatient {
  id: number
  full_name: string
  uhid: string
  mobile: string
  preferred_language: string
  next_recall_due_at: string
  recall_reason: string
  urgency: "overdue" | "due_today" | "upcoming"
}

export interface RecallSummary {
  overdue: number
  due_today: number
  due_this_week: number
  total_recalls: number
}

export interface RecallResponse {
  summary: RecallSummary
  results: RecallPatient[]
}

export function listPatientRecalls(params: { status?: string; reason?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return api.get<RecallResponse>(`/patients/recalls/${qs ? `?${qs}` : ""}`)
}


