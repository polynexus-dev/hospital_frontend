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
  formula?: string
  is_nabl_accredited?: boolean
  tat_hours?: number | null
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
  order_number?: string
  priority?: string
  department?: string
  dispatched_at?: string | null
  dispatch_due_at?: string | null
  processing_state?: "not_started" | "in_process" | "results_ready"
}

export interface PlacedLabOrder extends LabOrder {
  orders?: { id: number; order_number: string; department: string; merged: boolean }[]
  merged?: boolean
}

export type WorklistStatus = "pending_collection" | "collected" | "in_process" | "outsourced" | "resulted" | "verified"

export interface WorklistRow {
  order: number
  order_number: string
  patient: number
  patient_name: string
  uhid: string
  priority: string
  ordered_at: string
  test: number
  test_name: string
  test_code: string
  department: string
  status: WorklistStatus
  result: number | null
  value: string
  unit: string
  flag: LabResultFlag | ""
  calculated: boolean
  due_at: string | null
  overdue: boolean
}

export interface LabDispatch {
  id: number
  channel: string
  recipient: string
  sent: boolean
  error: string
  automatic: boolean
  created_at: string
}

export interface LabSettings {
  nabl_certificate_number: string
  nabl_valid_until: string | null
  nabl_logo: string
  nabl_active: boolean
  auto_dispatch: boolean
  dispatch_channels: string[]
  dispatch_times: string[]
  dispatch_delay_minutes: number
  merge_window_minutes: number
  split_by_department: boolean
  dispatch_outsourced: boolean
  merge_dispatch_reports: boolean
}

export const LAB_DEPARTMENTS = ["hematology", "biochemistry", "microbiology", "serology", "pathology", "other"]

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
  return api.post<PlacedLabOrder>("/laboratory/orders/", payload)
}

export function getLabOrder(id: number) {
  return api.get<LabOrder>(`/laboratory/orders/${id}/`)
}

export function labWorklist(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
  return api.get<WorklistRow[]>(`/laboratory/orders/worklist/${qs ? `?${qs}` : ""}`)
}

export function dispatchLabReport(orderId: number, channels: string[]) {
  return api.post<{ channel: string; recipient: string; sent: boolean; error: string }[]>(`/laboratory/orders/${orderId}/dispatch_report/`, { channels })
}

export function listLabDispatches(orderId: number) {
  return api.get<LabDispatch[]>(`/laboratory/orders/${orderId}/dispatches/`)
}

export function getLabSettings() {
  return api.get<LabSettings>("/laboratory/settings/")
}

export function saveLabSettings(payload: Partial<LabSettings>) {
  return api.put<LabSettings>("/laboratory/settings/", payload)
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
