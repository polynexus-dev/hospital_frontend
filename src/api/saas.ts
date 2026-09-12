import { api } from "./client"
import type {
  OnboardTenantPayload,
  Paginated,
  PlatformAnalytics,
  PublicTenantBranding,
  SaaSHospital,
  SaaSSupportTicket,
  TenantInvoice,
  TenantSubscription,
  TenantUsageSnapshot,
} from "../types/api"


// apps.saas_admin — every endpoint here is gated server-side by
// apps.core.permissions.IsSaaSAdmin (is_saas_admin OR is_superuser) and
// queries across all tenants, not the caller's own hospital.

function qs(params: Record<string, string>) {
  const search = new URLSearchParams(params).toString()
  return search ? `?${search}` : ""
}

export function platformAnalytics() {
  return api.get<PlatformAnalytics>("/saas-admin/analytics/")
}

export function listSubscriptions(params: Record<string, string> = {}) {
  return api.get<Paginated<TenantSubscription>>(`/saas-admin/subscriptions/${qs(params)}`)
}

export function updateSubscription(id: number, body: Partial<TenantSubscription>) {
  return api.patch<TenantSubscription>(`/saas-admin/subscriptions/${id}/`, body)
}

export function listInvoices(params: Record<string, string> = {}) {
  return api.get<Paginated<TenantInvoice>>(`/saas-admin/invoices/${qs(params)}`)
}

export function markInvoicePaid(id: number) {
  return api.post<TenantInvoice>(`/saas-admin/invoices/${id}/mark-paid/`)
}

// The PDF endpoint returns a file, not JSON — fetched as a blob so the
// Authorization header can be attached (a plain <a href> can't), then
// handed to triggerBlobDownload. Same reason getBlob exists in client.ts.
export function downloadInvoicePdf(id: number) {
  return api.getBlob(`/saas-admin/invoices/${id}/download/`)
}

export function listUsageSnapshots(params: Record<string, string> = {}) {
  return api.get<Paginated<TenantUsageSnapshot>>(`/saas-admin/usage-snapshots/${qs(params)}`)
}

export function listSaaSTickets(params: Record<string, string> = {}) {
  return api.get<Paginated<SaaSSupportTicket>>(`/saas-admin/tickets/${qs(params)}`)
}

export function resolveTicket(id: number, resolutionNotes: string) {
  return api.post<SaaSSupportTicket>(`/saas-admin/tickets/${id}/resolve/`, { resolution_notes: resolutionNotes })
}

export function listHospitals(params: Record<string, string> = {}) {
  return api.get<Paginated<SaaSHospital>>(`/saas-admin/hospitals/${qs(params)}`)
}

export function onboardHospital(data: OnboardTenantPayload) {
  return api.post<SaaSHospital>("/saas-admin/hospitals/", data)
}

export function updateHospitalModules(id: string, enabledModules: string[]) {
  return api.post<SaaSHospital>(`/saas-admin/hospitals/${id}/modules/`, { enabled_modules: enabledModules })
}

export function toggleHospitalStatus(id: string) {
  return api.post<SaaSHospital>(`/saas-admin/hospitals/${id}/toggle-status/`)
}

export function getPublicTenantBranding(subdomain?: string | null) {
  const query = subdomain ? `?subdomain=${encodeURIComponent(subdomain)}` : ""
  return api.get<PublicTenantBranding>(`/public/tenant-branding/${query}`)
}

