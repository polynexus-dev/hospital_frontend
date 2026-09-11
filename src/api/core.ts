import { api } from "./client"
import type { AuditLog, EmergencyAccessLog, Paginated } from "../types/api"

export function listAuditLogs(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<AuditLog>>(`/audit-logs/${qs ? `?${qs}` : ""}`)
}

export function listEmergencyAccessLogs(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<EmergencyAccessLog>>(`/emergency-access-logs/${qs ? `?${qs}` : ""}`)
}

export function markEmergencyAccessReviewed(id: number, reviewNotes: string) {
  return api.post<EmergencyAccessLog>(`/emergency-access-logs/${id}/mark_reviewed/`, { review_notes: reviewNotes })
}
