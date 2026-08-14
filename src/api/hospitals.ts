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
}

export async function listHospitals() {
  const data = await api.get<any>("/hospitals/")
  return (Array.isArray(data) ? data : data?.results ?? []) as Hospital[]
}

export function createHospital(data: Partial<Hospital>) {
  return api.post<Hospital>("/hospitals/", data)
}

export function updateHospitalModules(hospitalId: string, enabled_modules: string[]) {
  return api.patch<Hospital>(`/hospitals/${hospitalId}/update-modules/`, { enabled_modules })
}

export function toggleHospitalStatus(hospitalId: string) {
  return api.post<Hospital>(`/hospitals/${hospitalId}/toggle-status/`, {})
}
