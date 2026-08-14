import { api } from "./client"
import type { Paginated } from "../types/api"

export interface HealthPackage {
  id: number
  name: string
  code: string
  category: "cardiac" | "full_body" | "ortho" | "maternity"
  price: number
  description: string
  included_tests: string[]
  is_active: boolean
}

export interface Campaign {
  id: number
  name: string
  campaign_type: "health_camp" | "digital_ad" | "corporate_tieup"
  budget: number
  actual_spend: number
  status: "planned" | "active" | "completed"
  start_date: string
  end_date?: string
  total_registrations?: number
  total_conversions?: number
  total_revenue_generated?: number
  cost_per_lead?: number | null
  cost_per_acquisition?: number | null
  roi_percent?: number | null
  created_at: string
}

export interface CampRegistration {
  id: number
  campaign: number
  campaign_name: string
  patient_name: string
  mobile: string
  stage: "registered" | "attended" | "opd_converted" | "ipd_converted"
  revenue_generated: number
  enquiry: number | null
  patient: number | null
  corporate_client: number | null
  registered_at: string
}

export interface CorporateClient {
  id: number
  name: string
  contact_person: string
  contact_phone: string
  contact_email: string
  campaign: number | null
  billing_model: "per_employee" | "flat_annual" | "credit_line"
  discount_percent: number
  contract_start: string
  contract_end: string | null
  employee_count: number
  is_active: boolean
  notes: string
  created_at: string
}

export function listCorporateClients() {
  return api.get<Paginated<CorporateClient>>("/packages/corporate-clients/")
}

export function createCorporateClient(payload: Partial<CorporateClient>) {
  return api.post<CorporateClient>("/packages/corporate-clients/", payload)
}

export function listHealthPackages() {
  return api.get<Paginated<HealthPackage>>("/packages/catalog/")
}

export function createHealthPackage(payload: Partial<HealthPackage>) {
  return api.post<HealthPackage>("/packages/catalog/", payload)
}

export function listCampaigns() {
  return api.get<Paginated<Campaign>>("/packages/campaigns/")
}

export function createCampaign(payload: Partial<Campaign>) {
  return api.post<Campaign>("/packages/campaigns/", payload)
}

export function listCampRegistrations() {
  return api.get<Paginated<CampRegistration>>("/packages/registrations/")
}

export function createCampRegistration(payload: Partial<CampRegistration>) {
  return api.post<CampRegistration>("/packages/registrations/", payload)
}
