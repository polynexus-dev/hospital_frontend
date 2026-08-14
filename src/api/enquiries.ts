import { api } from "./client"
import type { Enquiry, EnquiryStage, LostReason, Paginated } from "../types/api"

export function listEnquiries(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Enquiry>>(`/enquiries/${qs ? `?${qs}` : ""}`)
}

export function createEnquiry(payload: Partial<Enquiry>) {
  return api.post<Enquiry>("/enquiries/", payload)
}

export function moveEnquiryStage(id: number, stage: EnquiryStage) {
  return api.post<Enquiry>(`/enquiries/${id}/move-stage/`, { stage })
}

export function loseEnquiry(id: number, lostReason: LostReason, lostNotes?: string) {
  return api.post<Enquiry>(`/enquiries/${id}/lose/`, { lost_reason: lostReason, lost_notes: lostNotes ?? "" })
}

export function reassignEnquiry(id: number, ownerId: number, reason?: string) {
  return api.post<Enquiry>(`/enquiries/${id}/reassign/`, { owner: ownerId, reason: reason ?? "" })
}

export function mergeEnquiry(duplicateId: number, primaryId: number) {
  return api.post<Enquiry>(`/enquiries/${duplicateId}/merge/`, { primary_id: primaryId })
}
