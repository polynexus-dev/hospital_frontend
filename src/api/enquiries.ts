import { api, triggerBlobDownload } from "./client"
import type { Enquiry, EnquiryHistory, EnquiryStage, LostReason, Paginated } from "../types/api"

export interface TreatmentEstimate {
  id: number
  patient?: number | null
  patient_name?: string
  patient_mobile?: string
  enquiry?: number | null
  doctor?: number | null
  doctor_name?: string
  department?: number | null
  department_name?: string
  procedure_name: string
  diagnosis?: string
  room_category: "general" | "semi_private" | "private" | "deluxe"
  stay_days: number
  surgeon_fee: string | number
  ot_charges: string | number
  room_charges: string | number
  medicines_estimate: string | number
  implants_investigations: string | number
  total_estimate: string | number
  payment_mode: "cash" | "insurance" | "govt_scheme" | "corporate"
  tpa_name?: string
  insurance_preauth_status: "not_applicable" | "pending_docs" | "submitted" | "query_raised" | "approved" | "denied"
  approved_preauth_amount?: string | number | null
  stage: "advised" | "counseling" | "estimate_shared" | "preauth_in_progress" | "scheduled" | "converted" | "dropped"
  drop_reason?: string
  notes?: string
  valid_until?: string
  created_at: string
  updated_at: string
}

export interface WebhookConfigResponse {
  token: string
  webhook_url: string
  supported_sources: string[]
  sample_payload: Record<string, any>
}

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

export function updateEnquiry(id: number, payload: Partial<Enquiry>) {
  return api.patch<Enquiry>(`/enquiries/${id}/`, payload)
}

export function getEnquiryHistory(id: number) {
  return api.get<EnquiryHistory>(`/enquiries/${id}/history/`)
}

export function addEnquiryNote(id: number, note: string) {
  return api.post<Enquiry>(`/enquiries/${id}/add-note/`, { note })
}

export async function exportEnquiriesCsv(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  const blob = await api.getBlob(`/enquiries/export-csv/${qs ? `?${qs}` : ""}`)
  triggerBlobDownload(blob, `hospital_crm_leads_${new Date().toISOString().slice(0, 10)}.csv`)
}

export function getWebhookConfig() {
  return api.get<WebhookConfigResponse>("/enquiries/webhook-config/")
}

export function listTreatmentEstimates(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<TreatmentEstimate>>(`/treatment-estimates/${qs ? `?${qs}` : ""}`)
}

export function createTreatmentEstimate(payload: Partial<TreatmentEstimate>) {
  return api.post<TreatmentEstimate>("/treatment-estimates/", payload)
}

export function updateTreatmentEstimate(id: number, payload: Partial<TreatmentEstimate>) {
  return api.patch<TreatmentEstimate>(`/treatment-estimates/${id}/`, payload)
}

export function convertEstimateAdmission(id: number) {
  return api.post<TreatmentEstimate>(`/treatment-estimates/${id}/convert-admission/`, {})
}

export async function downloadTreatmentEstimatePdf(id: number, procedureName = "Surgical_Estimate") {
  const blob = await api.getBlob(`/treatment-estimates/${id}/pdf/`)
  const sanitized = procedureName.replace(/[^a-zA-Z0-9_-]/g, "_")
  triggerBlobDownload(blob, `Estimate_EST-${id}_${sanitized}.pdf`)
}

export interface BranchMetric {
  hospital_id: string
  hospital_name: string
  slug: string
  city: string
  is_current: boolean
  total_enquiries: number
  active_leads: number
  stages: {
    new: number
    contacted: number
    scheduled: number
    visited: number
    completed: number
    lost: number
  }
  pipeline_value: number
  converted_value: number
  conversion_rate: number
  sla_breaches: number
  treatment_estimates_count: number
}

export interface ChainOverviewResponse {
  group_name: string
  total_branches: number
  total_group_enquiries: number
  total_group_pipeline_value: number
  total_group_converted_value: number
  overall_conversion_rate: number
  branches: BranchMetric[]
}

export function getChainOverview() {
  return api.get<ChainOverviewResponse>("/enquiries/chain-overview/")
}



