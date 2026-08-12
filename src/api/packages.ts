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
  total_revenue_generated?: number
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
  registered_at: string
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
