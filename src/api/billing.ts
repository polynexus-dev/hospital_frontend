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

export function downloadBillPdf(billId: number) {
  return api.getBlob(`/billing/bills/${billId}/download/`)
}


export interface OnlinePaymentLink {
  id: number
  bill: number
  amount: string
  short_url: string
  status: "created" | "paid" | "cancelled" | "expired"
  patient_notified_at: string | null
  paid_at: string | null
}

export interface PaymentGatewayStatus {
  configured: boolean
  source: "hospital" | "server" | null
  key_id: string
  is_active: boolean
  webhook_url: string
  webhook_events: string[]
}

/** NABH FPM.2.b / FPM.3.e: a Razorpay link the patient pays by UPI, card, netbanking or wallet. */
export function createPaymentLink(bill: number, amount?: number, notify = true) {
  return api.post<OnlinePaymentLink>("/billing/payment-links/", { bill, amount, notify })
}

export function listPaymentLinks(bill: number) {
  return api.get<Paginated<OnlinePaymentLink>>(`/billing/payment-links/?bill=${bill}`)
}

export function cancelPaymentLink(id: number) {
  return api.post<OnlinePaymentLink>(`/billing/payment-links/${id}/cancel/`)
}

export function getPaymentGateway() {
  return api.get<PaymentGatewayStatus>("/billing/payment-gateway/")
}

export function savePaymentGateway(payload: { key_id: string; key_secret?: string; webhook_secret?: string; is_active?: boolean }) {
  return api.put<PaymentGatewayStatus>("/billing/payment-gateway/", payload)
}
