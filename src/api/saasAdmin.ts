import { api, triggerBlobDownload } from "./client"
import type { Paginated } from "../types/api"

export interface TenantSubscription {
  id: number
  hospital: string
  hospital_name: string
  tier: "starter" | "pro" | "enterprise"
  billing_cycle: "monthly" | "annual"
  base_price: string
  max_staff_users: number
  status: "active" | "suspended" | "cancelled"
  started_at: string
  next_billing_date: string | null
  created_at: string
  updated_at: string
}

export interface TenantInvoice {
  id: number
  hospital: string
  hospital_name: string
  subscription: number | null
  invoice_number: string
  billing_period_start: string
  billing_period_end: string
  amount: string
  status: "unpaid" | "paid" | "overdue"
  due_date: string
  paid_at: string | null
  payment_receipt: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface TenantUsageSnapshot {
  id: number
  hospital: string
  hospital_name: string
  period_start: string
  period_end: string
  active_staff_count: number
  patients_registered_count: number
  bills_generated_count: number
  storage_bytes_used: number
  created_at: string
}

export type TicketCategory = "bug" | "feature_request" | "billing" | "general"
export type TicketPriority = "low" | "medium" | "high" | "urgent"
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed"

export interface SupportTicket {
  id: number
  hospital: string
  hospital_name?: string
  raised_by: number | null
  raised_by_email: string | null
  subject: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  assigned_to: number | null
  assigned_to_email?: string | null
  resolution_notes: string
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface PlatformAnalytics {
  total_hospitals: number
  active_hospitals: number
  total_revenue: number
  total_patients: number
  module_adoption_percent: Record<string, number>
}

// --- Subscriptions ---------------------------------------------------

export function listSubscriptions(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<TenantSubscription>>(`/saas-admin/subscriptions/${qs ? `?${qs}` : ""}`)
}

export function createSubscription(data: Partial<TenantSubscription>) {
  return api.post<TenantSubscription>("/saas-admin/subscriptions/", data)
}

export function updateSubscription(id: number, data: Partial<TenantSubscription>) {
  return api.patch<TenantSubscription>(`/saas-admin/subscriptions/${id}/`, data)
}

// --- Invoices ----------------------------------------------------------

export function listInvoices(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<TenantInvoice>>(`/saas-admin/invoices/${qs ? `?${qs}` : ""}`)
}

export function createInvoice(data: Partial<TenantInvoice>) {
  return api.post<TenantInvoice>("/saas-admin/invoices/", data)
}

export function markInvoicePaid(id: number) {
  return api.post<TenantInvoice>(`/saas-admin/invoices/${id}/mark-paid/`, {})
}

export async function downloadInvoicePdf(id: number, invoiceNumber: string) {
  const blob = await api.getBlob(`/saas-admin/invoices/${id}/download/`)
  triggerBlobDownload(blob, `${invoiceNumber}.pdf`)
}

// --- Usage snapshots (read-only) ----------------------------------------

export function listUsageSnapshots(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<TenantUsageSnapshot>>(`/saas-admin/usage-snapshots/${qs ? `?${qs}` : ""}`)
}

// --- Support tickets — SaaS-admin side (every hospital) -----------------

export function listSaasTickets(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<SupportTicket>>(`/saas-admin/tickets/${qs ? `?${qs}` : ""}`)
}

export function resolveTicket(id: number, resolution_notes: string) {
  return api.post<SupportTicket>(`/saas-admin/tickets/${id}/resolve/`, { resolution_notes })
}

export function assignTicket(id: number, assigned_to: number) {
  return api.post<SupportTicket>(`/saas-admin/tickets/${id}/assign/`, { assigned_to })
}

// --- Support tickets — hospital side (raise/view your own) --------------

export function listMyTickets(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<SupportTicket>>(`/support-tickets/${qs ? `?${qs}` : ""}`)
}

export function createTicket(data: { subject: string; description: string; category: TicketCategory; priority?: TicketPriority }) {
  return api.post<SupportTicket>("/support-tickets/", data)
}

// --- Platform analytics --------------------------------------------------

export function getPlatformAnalytics() {
  return api.get<PlatformAnalytics>("/saas-admin/analytics/")
}
