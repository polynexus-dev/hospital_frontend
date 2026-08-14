import { api } from "./client"
import type { Bill, InsuranceClaim, Paginated, Payment } from "../types/api"

export function listBills(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Bill>>(`/billing/bills/${qs ? `?${qs}` : ""}`)
}

export function createBill(data: { patient: number; admission?: number; discount_amount?: number }) {
  return api.post<Bill>("/billing/bills/", data)
}

export function addBillItem(billId: number, data: { description: string; quantity: number; unit_price: number }) {
  return api.post<Bill>(`/billing/bills/${billId}/add-item/`, data)
}

export function listPayments(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Payment>>(`/billing/payments/${qs ? `?${qs}` : ""}`)
}

export function recordPayment(data: { bill: number; amount: number; payment_method: string; transaction_id?: string }) {
  return api.post<Payment>("/billing/payments/", data)
}

export function listInsuranceClaims(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<InsuranceClaim>>(`/billing/insurance-claims/${qs ? `?${qs}` : ""}`)
}

export function createInsuranceClaim(data: { bill: number; insurance_company: string; policy_number: string; claimed_amount: number }) {
  return api.post<InsuranceClaim>("/billing/insurance-claims/", data)
}
