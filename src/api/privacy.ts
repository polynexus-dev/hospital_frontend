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
