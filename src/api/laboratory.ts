import { api } from "./client"
import type { Paginated } from "../types/api"

export type LabOrderStatus = "ordered" | "sample_collected" | "processing" | "resulted" | "verified"
export type LabResultFlag = "normal" | "high" | "low" | "critical"

export interface LabTest {
  id: number
  name: string
  code: string
  department: string
  reference_range: string
  unit: string
  price: string
  is_active: boolean
}

export interface LabOrder {
  id: number
  investigation_order: number | null
  patient: number
  patient_name: string
  ordered_tests: number[]
  status: LabOrderStatus
  ordered_by: number | null
  ordered_at: string
}

export interface LabResult {
  id: number
  lab_order: number
  lab_test: number
  lab_test_name: string
  value: string
  unit: string
  reference_range: string
  flag: LabResultFlag
  entered_by: number | null
  finalized_at: string | null
  finalized_by: number | null
  created_at: string
}

export function listLabTests() {
  return api.get<Paginated<LabTest>>("/laboratory/tests/")
}

export function listLabOrders(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<LabOrder>>(`/laboratory/orders/${qs ? `?${qs}` : ""}`)
}

export function createLabOrder(payload: { patient: number; ordered_tests: number[]; investigation_order?: number }) {
  return api.post<LabOrder>("/laboratory/orders/", payload)
}

export function createSampleCollection(payload: { lab_order: number; sample_type: string; barcode: string }) {
  return api.post("/laboratory/samples/", payload)
}

export function listLabResults(labOrderId: number) {
  return api.get<Paginated<LabResult>>(`/laboratory/results/?lab_order=${labOrderId}`)
}

export function createLabResult(payload: { lab_order: number; lab_test: number; value: string; unit?: string; reference_range?: string; flag?: LabResultFlag }) {
  return api.post<LabResult>("/laboratory/results/", payload)
}

export function verifyLabResult(id: number) {
  return api.post<LabResult>(`/laboratory/results/${id}/verify/`)
}
