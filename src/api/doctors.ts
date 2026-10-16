import { api } from "./client"
import type { Department, Doctor, DoctorQueue, Paginated, SlotTemplate } from "../types/api"

export interface ListDoctorsParams {
  search?: string
  department?: number | string
  is_active?: boolean | string
  ordering?: string
  page?: number
  page_size?: number
}

export function listDoctors(params: ListDoctorsParams = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      qs.append(key, String(val))
    }
  })
  const query = qs.toString()
  return api.get<Paginated<Doctor>>(`/doctors/${query ? `?${query}` : ""}`)
}

export function getDoctor(id: number | string) {
  return api.get<Doctor>(`/doctors/${id}/`)
}

export interface DoctorInput {
  department?: number | null
  name: string
  speciality: string
  phone?: string
  email?: string
  default_consultation_minutes?: number
  is_active?: boolean
  smc_registration_number?: string
  degree?: string
  pan?: string
}

export function createDoctor(payload: DoctorInput) {
  return api.post<Doctor>("/doctors/", payload)
}

/** Creates the doctor's login (Consultant Doctor role, doctor's email) and returns a one-time password. */
export function grantDoctorLogin(id: number | string, email?: string) {
  return api.post<import("./accounts").TemporaryPassword>(`/doctors/${id}/grant-login/`, email ? { email } : {})
}

export function updateDoctor(id: number | string, payload: Partial<DoctorInput>) {
  return api.patch<Doctor>(`/doctors/${id}/`, payload)
}

export function deleteDoctor(id: number | string) {
  return api.delete<void>(`/doctors/${id}/`)
}

export function blockDoctorLeave(
  id: number | string,
  payload: { date?: string; start_date?: string; end_date?: string; reason?: string },
) {
  return api.post<{ blocked?: number; skipped_already_booked?: number; booked_slot_ids?: number[]; detail?: string }>(
    `/doctors/${id}/block-leave/`,
    payload,
  )
}

export function unblockDoctorLeave(
  id: number | string,
  payload: { date?: string; start_date?: string; end_date?: string },
) {
  return api.post<{ unblocked?: number; detail?: string }>(`/doctors/${id}/unblock-leave/`, payload)
}

export function getDoctorQueue(id: number | string, date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ""
  return api.get<DoctorQueue>(`/doctors/${id}/queue/${qs}`)
}

export function getDoctorSchedule(id: number | string, date: string, output?: string) {
  const qs = new URLSearchParams({ date })
  if (output) qs.set("output", output)
  return api.get<unknown>(`/doctors/${id}/schedule/?${qs.toString()}`)
}

export function listDepartments() {
  return api.get<Paginated<Department> | Department[]>("/departments/").then((res) => {
    if (Array.isArray(res)) return res
    if (res && Array.isArray((res as Paginated<Department>).results)) {
      return (res as Paginated<Department>).results
    }
    return []
  })
}

export function listSlotTemplates(params: { doctor?: number | string } = {}) {
  const qs = new URLSearchParams()
  if (params.doctor) qs.append("doctor", String(params.doctor))
  const query = qs.toString()
  return api.get<Paginated<SlotTemplate> | SlotTemplate[]>(`/slot-templates/${query ? `?${query}` : ""}`).then((res) => {
    if (Array.isArray(res)) return res
    if (res && Array.isArray((res as Paginated<SlotTemplate>).results)) {
      return (res as Paginated<SlotTemplate>).results
    }
    return []
  })
}

export function createSlotTemplate(payload: {
  doctor: number
  weekday: number
  start_time: string
  end_time: string
  slot_duration_minutes: number
  is_active?: boolean
}) {
  return api.post<SlotTemplate>("/slot-templates/", payload)
}

export function deleteSlotTemplate(id: number | string) {
  return api.delete<void>(`/slot-templates/${id}/`)
}

export function generateSlotsFromTemplate(
  templateId: number | string,
  payload: { start_date: string; end_date: string },
) {
  return api.post<{ detail?: string; created?: number }>(`/slot-templates/${templateId}/generate-slots/`, payload)
}
