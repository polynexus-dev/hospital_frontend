import { api } from "./client"
import type { Complaint, NpsByDepartmentRow, NPSResponse, Paginated, ServiceRecoveryTask } from "../types/api"

export function listNpsResponses(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<NPSResponse>>(`/nps-responses/${qs ? `?${qs}` : ""}`)
}

export function listComplaints(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Complaint>>(`/complaints/${qs ? `?${qs}` : ""}`)
}

export function listServiceRecoveryTasks(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<ServiceRecoveryTask>>(`/service-recovery-tasks/${qs ? `?${qs}` : ""}`)
}

export function resolveServiceRecoveryTask(id: number, resolutionNotes: string) {
  return api.post<ServiceRecoveryTask>(`/service-recovery-tasks/${id}/resolve/`, { resolution_notes: resolutionNotes })
}

export function npsByDepartment() {
  return api.get<NpsByDepartmentRow[]>("/nps-responses/by-department/")
}
