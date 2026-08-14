import { api } from "./client"
import type { Paginated } from "../types/api"

export type RadiologyOrderStatus = "ordered" | "scheduled" | "completed" | "reported"

export interface RadiologyProcedure {
  id: number
  name: string
  modality: string
  price: string
  is_active: boolean
}

export interface RadiologyOrder {
  id: number
  investigation_order: number | null
  patient: number
  patient_name: string
  procedure: number
  procedure_name: string
  status: RadiologyOrderStatus
  ordered_by: number | null
  ordered_at: string
}

export interface RadiologyReport {
  id: number
  radiology_order: number
  findings: string
  impression: string
  reported_by: number | null
  image_file: string | null
  finalized_at: string | null
  finalized_by: number | null
  created_at: string
}

export function listRadiologyProcedures() {
  return api.get<Paginated<RadiologyProcedure>>("/radiology/procedures/")
}

export function listRadiologyOrders(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<RadiologyOrder>>(`/radiology/orders/${qs ? `?${qs}` : ""}`)
}

export function createRadiologyOrder(payload: { patient: number; procedure: number; investigation_order?: number }) {
  return api.post<RadiologyOrder>("/radiology/orders/", payload)
}

export function listRadiologyReports(radiologyOrderId: number) {
  return api.get<Paginated<RadiologyReport>>(`/radiology/reports/?radiology_order=${radiologyOrderId}`)
}

export function createRadiologyReport(payload: { radiology_order: number; findings: string; impression: string }) {
  return api.post<RadiologyReport>("/radiology/reports/", payload)
}

export function verifyRadiologyReport(id: number) {
  return api.post<RadiologyReport>(`/radiology/reports/${id}/verify/`)
}
