import { api } from "./client"
import type { Enquiry, EnquiryStage, Paginated } from "../types/api"

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

export function loseEnquiry(id: number, lostReason: string) {
  return api.post<Enquiry>(`/enquiries/${id}/lose/`, { lost_reason: lostReason })
}
