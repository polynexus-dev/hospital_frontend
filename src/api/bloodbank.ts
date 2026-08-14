import { api } from "./client"
import type { BloodUnit, CrossMatchRequest, Donor, Paginated, Transfusion } from "../types/api"

export function listDonors() {
  return api.get<Paginated<Donor>>("/bloodbank/donors/")
}

export function createDonor(data: { name: string; blood_group: string; phone?: string }) {
  return api.post<Donor>("/bloodbank/donors/", data)
}

export function listBloodUnits(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<BloodUnit>>(`/bloodbank/units/${qs ? `?${qs}` : ""}`)
}

export function createBloodUnit(data: {
  donor?: number
  blood_group: string
  component: BloodUnit["component"]
  collection_date: string
  expiry_date: string
}) {
  return api.post<BloodUnit>("/bloodbank/units/", data)
}

export function listCrossMatchRequests() {
  return api.get<Paginated<CrossMatchRequest>>("/bloodbank/cross-matches/")
}

export function createCrossMatchRequest(data: {
  patient: number
  blood_group_required: string
  component: BloodUnit["component"]
}) {
  return api.post<CrossMatchRequest>("/bloodbank/cross-matches/", data)
}

export function createTransfusion(data: {
  blood_unit: number
  patient: number
  admission?: number
  reaction_notes?: string
}) {
  return api.post<Transfusion>("/bloodbank/transfusions/", data)
}
