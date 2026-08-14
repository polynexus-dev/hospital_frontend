import { api } from "./client"
import type { Paginated } from "../types/api"

export interface TPACompany {
  id: number
  name: string
  code: string
  contact_person: string
  phone: string
  email: string
  claim_submission_email: string
  avg_tat_days: number
  is_active: boolean
  created_at: string
}

export interface PreAuthRequest {
  id: number
  patient: number
  patient_name: string
  tpa_company: number
  tpa_name: string
  policy_number: string
  claim_amount: number
  approved_amount: number
  status: "submitted" | "query_raised" | "approved" | "rejected"
  checklist: Record<string, boolean>
  submitted_at: string
  approved_at?: string
}

export function listTPACompanies() {
  return api.get<Paginated<TPACompany>>("/tpa/companies/")
}

export function createTPACompany(payload: Partial<TPACompany>) {
  return api.post<TPACompany>("/tpa/companies/", payload)
}

export function listPreAuthRequests() {
  return api.get<Paginated<PreAuthRequest>>("/tpa/pre-auth/")
}

export function createPreAuthRequest(payload: Partial<PreAuthRequest>) {
  return api.post<PreAuthRequest>("/tpa/pre-auth/", payload)
}

export function updatePreAuthStatus(id: number, status: PreAuthRequest["status"], approved_amount?: number) {
  return api.patch<PreAuthRequest>(`/tpa/pre-auth/${id}/`, { status, approved_amount })
}

export interface Claim {
  id: number
  preauth_request: number | null
  patient: number
  patient_name: string
  tpa_company: number
  tpa_name: string
  claim_number: string
  billed_amount: number
  settled_amount: number
  outstanding_amount: number
  status: "submitted" | "under_review" | "settled" | "partially_settled" | "rejected"
  rejection_reason: string
  notes: string
  submitted_at: string
  settled_at?: string
}

export function listClaims() {
  return api.get<Paginated<Claim>>("/tpa/claims/")
}

export function createClaim(payload: Partial<Claim>) {
  return api.post<Claim>("/tpa/claims/", payload)
}

export function updateClaim(id: number, payload: Partial<Claim>) {
  return api.patch<Claim>(`/tpa/claims/${id}/`, payload)
}
