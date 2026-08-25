import { api } from "./client"

export interface Hospital {
  id: string
  name: string
  slug: string
  city: string
  state: string
  is_active: boolean
  enabled_modules: string[]
  patient_count?: number
  appointment_count?: number
  total_revenue?: number
  // Only present in the response to the POST that created this hospital —
  // the auto-provisioned admin's password is generated server-side and
  // returned exactly once, never stored in plaintext or retrievable again.
  provisioned_admin?: { email: string; password: string }
}

export async function listHospitals() {
  const data = await api.get<any>("/hospitals/")
  return (Array.isArray(data) ? data : data?.results ?? []) as Hospital[]
}

export function createHospital(data: Partial<Hospital> & { admin_email?: string }) {
  return api.post<Hospital>("/hospitals/", data)
}

export function updateHospitalModules(hospitalId: string, enabled_modules: string[]) {
  return api.patch<Hospital>(`/hospitals/${hospitalId}/update-modules/`, { enabled_modules })
}

export function toggleHospitalStatus(hospitalId: string) {
  return api.post<Hospital>(`/hospitals/${hospitalId}/toggle-status/`, {})
}
