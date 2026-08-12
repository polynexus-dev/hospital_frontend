import { api } from "./client"
import type { Paginated } from "../types/api"

export interface ReferringDoctor {
  id: number
  name: string
  speciality: string
  clinic_name: string
  mobile: string
  email: string
  city: string
  tier: "gold" | "silver" | "bronze"
  date_of_birth?: string
  notes?: string
  is_active: boolean
  total_referrals?: number
  total_attributed_revenue?: number
  created_at: string
}

export interface ReferralRecord {
  id: number
  referring_doctor: number
  referring_doctor_name: string
  patient: number
  patient_name: string
  department?: number
  attributed_revenue: number
  commission_percentage: number
  status: "pending" | "converted" | "paid"
  referred_at: string
}

export interface FieldVisit {
  id: number
  referring_doctor: number
  referring_doctor_name: string
  visited_by?: number
  visited_by_name?: string
  visit_date: string
  notes: string
  outcome?: string
  created_at: string
}

export function listReferringDoctors() {
  return api.get<Paginated<ReferringDoctor>>("/referrals/doctors/")
}

export function listReferralLeagueTable() {
  return api.get<ReferringDoctor[]>("/referrals/doctors/league-table/")
}

export function createReferringDoctor(payload: Partial<ReferringDoctor>) {
  return api.post<ReferringDoctor>("/referrals/doctors/", payload)
}

export function listReferralRecords() {
  return api.get<Paginated<ReferralRecord>>("/referrals/records/")
}

export function listFieldVisits() {
  return api.get<Paginated<FieldVisit>>("/referrals/field-visits/")
}

export function createFieldVisit(payload: Partial<FieldVisit>) {
  return api.post<FieldVisit>("/referrals/field-visits/", payload)
}
