import { api } from "./client"
import type { Paginated } from "../types/api"

export interface Medicine {
  id: number
  name: string
  generic_name: string
  form: string
  unit: string
  reorder_level: number
  is_active: boolean
  total_available: number
}

export interface MedicineBatch {
  id: number
  medicine: number
  medicine_name: string
  batch_number: string
  expiry_date: string
  quantity_available: number
  mrp: string
  purchase_price: string
  supplier: number | null
}

export interface DispenseRecord {
  id: number
  prescription: number | null
  batch: number
  medicine_name: string
  quantity: number
  dispensed_by: number | null
  dispensed_at: string
}

export interface StockAdjustment {
  id: number
  batch: number
  adjustment_type: "damage" | "expiry" | "correction"
  quantity_delta: number
  reason: string
  adjusted_by: number | null
  adjusted_at: string
}

export function listMedicines(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ""
  return api.get<Paginated<Medicine>>(`/pharmacy/medicines/${qs}`)
}

export function listMedicineBatches(medicineId?: number) {
  const qs = medicineId ? `?medicine=${medicineId}` : ""
  return api.get<Paginated<MedicineBatch>>(`/pharmacy/batches/${qs}`)
}

export function listDispenseRecords(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<DispenseRecord>>(`/pharmacy/dispense-records/${qs ? `?${qs}` : ""}`)
}

export function dispenseMedicine(payload: { batch: number; quantity: number; prescription?: number }) {
  return api.post<DispenseRecord>("/pharmacy/dispense-records/", payload)
}

export function createStockAdjustment(payload: { batch: number; adjustment_type: string; quantity_delta: number; reason?: string }) {
  return api.post<StockAdjustment>("/pharmacy/stock-adjustments/", payload)
}
