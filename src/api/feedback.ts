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

export interface ReputationSummary {
  total_responses: number
  promoters_count: number
  passives_count: number
  detractors_count: number
  nps_score: number
  google_review_url: string
  prompts_sent_count: number
}

export function getReputationSummary() {
  return api.get<ReputationSummary>("/nps-responses/reputation-summary/")
}

export function updateGoogleReviewUrl(googleReviewUrl: string) {
  return api.post<{ google_review_url: string }>("/nps-responses/update-google-review-url/", { google_review_url: googleReviewUrl })
}

export function sendGoogleReviewPrompt(npsResponseId: number) {
  return api.post<{ detail: string; google_review_url: string }>(`/nps-responses/${npsResponseId}/send-google-review-prompt/`)
}

