import { api } from "./client"
import type {
  GenerateLicensePayload,
  OnboardTenantPayload,
  LicenseRequest,
  LicenseUsageReport,
  OnPremiseLicense,
  Paginated,
  PermissionMatrix,
  PlatformAnalytics,
  PublicTenantBranding,
  SaaSHospital,
  SaaSStaff,
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

export function getHospitalPermissions(id: string) {
  return api.get<PermissionMatrix>(`/saas-admin/hospitals/${id}/permissions/`)
}

/** `null` lifts the ceiling: everything in the hospital's enabled modules. */
export function setHospitalPermissions(id: string, permissions: string[] | null) {
  return api.put<PermissionMatrix>(`/saas-admin/hospitals/${id}/permissions/`, { permissions })
}

/** A SaaS Owner's request is signed at once (the licence comes back); anyone
 *  else's waits for an Owner's approval (`{ detail, request }`, HTTP 202). */
export function generateLicense(hospitalId: string, data: GenerateLicensePayload) {
  return api.post<OnPremiseLicense | { detail: string; request: LicenseRequest }>(
    `/saas-admin/hospitals/${hospitalId}/generate-license/`, { ...data, response: "json" },
  )
}

export function listLicenseRequests(status = "") {
  return api.get<Paginated<LicenseRequest>>(`/saas-admin/license-requests/${qs(status ? { status } : {})}`)
}

/** SaaS Owners only; needs the Owner's current 2FA code. */
export function approveLicenseRequest(id: number, otp: string) {
  return api.post<{ request: LicenseRequest; license: OnPremiseLicense }>(`/saas-admin/license-requests/${id}/approve/`, { otp })
}

export function rejectLicenseRequest(id: number, note: string) {
  return api.post<LicenseRequest>(`/saas-admin/license-requests/${id}/reject/`, { note })
}

export function cancelLicenseRequest(id: number) {
  return api.post<LicenseRequest>(`/saas-admin/license-requests/${id}/cancel/`)
}

/** Signed list of revoked licence IDs — save as Backend/apps/licensing/revocations.lic before `make bundle`. */
export function downloadRevocationList() {
  return api.getBlob("/saas-admin/licenses/revocation-list/")
}

// SaaS Owners only: who may issue licences, and blocking staff who leave.
export function listSaaSStaff() {
  return api.get<Paginated<SaaSStaff>>("/saas-admin/staff/")
}

export function setLicenceRight(id: number, grant: boolean, otp: string) {
  return api.post<SaaSStaff>(`/saas-admin/staff/${id}/licence-right/`, { grant, otp })
}

export function blockSaaSStaff(id: number, reason: string, otp: string) {
  return api.post<SaaSStaff>(`/saas-admin/staff/${id}/block/`, { reason, otp })
}

export function unblockSaaSStaff(id: number) {
  return api.post<SaaSStaff>(`/saas-admin/staff/${id}/unblock/`)
}

export function listLicenses(hospitalId: string) {
  return api.get<Paginated<OnPremiseLicense>>(`/saas-admin/licenses/?hospital=${hospitalId}`)
}

/** Every on-premise licence, renewals due first. */
export function listAllLicenses(params: { status?: string; expiring_within?: string; search?: string; issued_by?: string } = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>
  return api.get<Paginated<OnPremiseLicense>>(`/saas-admin/licenses/${qs(clean)}`)
}

/** A usage report file a hospital exported from Settings → License (its text contents). */
export function uploadUsageReport(report: string) {
  return api.post<LicenseUsageReport>("/saas-admin/licenses/usage-reports/", { report })
}

export function downloadLicense(id: number) {
  return api.getBlob(`/saas-admin/licenses/${id}/download/`)
}

export function revokeLicense(id: number, reason: string) {
  return api.post<OnPremiseLicense>(`/saas-admin/licenses/${id}/revoke/`, { reason })
}

export function toggleHospitalStatus(id: string) {
  return api.post<SaaSHospital>(`/saas-admin/hospitals/${id}/toggle-status/`)
}

export function getPublicTenantBranding(subdomain?: string | null) {
  const query = subdomain ? `?subdomain=${encodeURIComponent(subdomain)}` : ""
  return api.get<PublicTenantBranding>(`/public/tenant-branding/${query}`)
}

