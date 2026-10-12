import { api } from "./client"
import type {
  DataRightsRequest,
  DataRightsRequestType,
  GrievancePriority,
  GrievanceTicket,
  Nominee,
  Paginated,
  PatientDataExport,
} from "../types/api"

// --- Data rights requests (DPDP access/correction/erasure/nomination) -----

export function listDataRightsRequests(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<DataRightsRequest>>(`/privacy/data-rights-requests/${qs ? `?${qs}` : ""}`)
}

export function createDataRightsRequest(data: { patient: number; request_type: DataRightsRequestType; channel?: string; details?: string }) {
  return api.post<DataRightsRequest>("/privacy/data-rights-requests/", data)
}

export function verifyDataRightsRequest(id: number) {
  return api.post<DataRightsRequest>(`/privacy/data-rights-requests/${id}/verify/`)
}

export function exportDataRightsRequest(id: number) {
  return api.get<PatientDataExport>(`/privacy/data-rights-requests/${id}/export/`)
}

export function completeDataRightsRequest(id: number, resolutionNotes: string) {
  return api.post<DataRightsRequest>(`/privacy/data-rights-requests/${id}/complete/`, { resolution_notes: resolutionNotes })
}

export function rejectDataRightsRequest(id: number, resolutionNotes: string) {
  return api.post<DataRightsRequest>(`/privacy/data-rights-requests/${id}/reject/`, { resolution_notes: resolutionNotes })
}

// --- Grievances (DPDP §2.5 grievance redressal) ----------------------------

export function listGrievanceTickets(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<GrievanceTicket>>(`/privacy/grievances/${qs ? `?${qs}` : ""}`)
}

export function createGrievanceTicket(data: { patient?: number; subject: string; description: string; priority?: GrievancePriority }) {
  return api.post<GrievanceTicket>("/privacy/grievances/", data)
}

export function resolveGrievanceTicket(id: number, resolution: string) {
  return api.post<GrievanceTicket>(`/privacy/grievances/${id}/resolve/`, { resolution })
}

// --- Nominees (DPDP §14) ----------------------------------------------------

export function listNominees(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Nominee>>(`/privacy/nominees/${qs ? `?${qs}` : ""}`)
}

export function createNominee(data: { patient: number; name: string; relationship: string; phone?: string; email?: string }) {
  return api.post<Nominee>("/privacy/nominees/", data)
}

export function verifyNominee(id: number) {
  return api.post<Nominee>(`/privacy/nominees/${id}/verify/`)
}

export function deleteNominee(id: number) {
  return api.delete<void>(`/privacy/nominees/${id}/`)
}

// --- DPDP consent register --------------------------------------------------

export interface ConsentNotice {
  id: number
  purpose: string
  purpose_label: string
  language: string
  version: number
  title: string
  body: string
  is_active: boolean
  created_at: string
}

export interface PatientConsent {
  id: number
  patient: number
  notice: number
  notice_version: number
  purpose: string
  purpose_label: string
  status: "granted" | "declined" | "withdrawn"
  method: "written" | "digital" | "verbal" | "portal"
  given_by: "self" | "guardian" | "nominee"
  guardian_name: string
  captured_by_name: string | null
  created_at: string
  withdrawn_at: string | null
  withdrawal_reason: string
}

export interface ConsentSummaryRow {
  purpose: string
  purpose_label: string
  consent: PatientConsent | null
  current_notice: ConsentNotice | null
  outdated: boolean
}

export function getConsentSummary(patientId: number | string, language = "en") {
  return api.get<ConsentSummaryRow[]>(`/privacy/consents/summary/?patient=${patientId}&language=${language}`)
}

export function recordConsent(data: { patient: number; notice: number; status: "granted" | "declined"; method: string; given_by: string; guardian_name?: string }) {
  return api.post<PatientConsent>("/privacy/consents/", data)
}

export function withdrawConsent(id: number, reason: string) {
  return api.post<PatientConsent>(`/privacy/consents/${id}/withdraw/`, { reason })
}
