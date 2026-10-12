import { api } from "./client"

// OPD front desk (apps.appointments.frontdesk_views): register, visit, bill, pay.

export interface Charge {
  description: string
  amount: string
  source: string
}

export interface FrontDeskPreview {
  visit_type: "new" | "follow_up" | "free_follow_up"
  visit_type_label: string
  reason: string
  last_paid_visit: string | null
  charges: Charge[]
  total: string
  warnings: string[]
  advance_balance: string
  policy: { discount_limit_percent: string; credit_payer_types: string[]; round_down_to_rupee: boolean; default_rate_category: string }
}

export interface DuplicateMatch {
  id: number
  uhid: string
  name: string
  date_of_birth: string | null
  score: number
  match: "exact" | "probable"
  reasons: string[]
}

export interface PinLookup {
  pincode: string
  found: boolean
  directory_loaded?: boolean
  state?: string
  district?: string
  sub_districts?: string[]
  areas?: string[]
}

export interface RegistrationResult {
  patient: { id: number; uhid: string; full_name: string }
  visit: { id: number; visit_number: string; token: number | null; visit_type_label: string; doctor_name: string; department_name: string | null }
  bill: { id: number; bill_number: string; status: string; total: string; discount: string; round_off: string; net: string }
  assessment: string
  warnings: string[]
  awaiting_discount_approval: number | null
  links: { receipt: string; card: string; sticker: string }
}

export interface Option {
  id: number
  name: string
}

export function previewVisit(params: Record<string, string>) {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString()
  return api.get<FrontDeskPreview>(`/frontdesk/preview/?${qs}`)
}

export function registerVisit(body: Record<string, unknown>) {
  return api.post<RegistrationResult>("/frontdesk/registrations/", body)
}

export function checkDuplicates(body: Record<string, unknown>) {
  return api.post<DuplicateMatch[]>("/patients/check-duplicates/", body)
}

export function lookupPincode(pin: string) {
  return api.get<PinLookup>(`/locations/pincode/${pin}/`)
}

export function listStates() {
  return api.get<{ name: string; is_union_territory: boolean }[]>("/locations/states/")
}

export function listDistricts(state: string) {
  return api.get<string[]>(`/locations/districts/?state=${encodeURIComponent(state)}`)
}

export function listApprovers() {
  return api.get<Option[]>("/frontdesk/approvers/")
}

export function advanceBalance(patientId: number) {
  return api.get<{ balance: string }>(`/frontdesk/advances/?patient=${patientId}`)
}

export function printDocument(path: string) {
  return api.getBlob(path.replace(/^\/api\/v1/, ""))
}

/** Rows from any paginated list endpoint; an endpoint the hospital hasn't licensed just gives none. */
export async function listOptions<T>(path: string): Promise<T[]> {
  try {
    const res = await api.get<{ results?: T[] } | T[]>(path)
    return Array.isArray(res) ? res : res.results ?? []
  } catch {
    return []
  }
}
