import { api } from "./client"
import type { Appointment, AppointmentStatus, Doctor, DoctorQueue, Paginated, Slot, Waitlist } from "../types/api"

export function listDoctors() {
  return api.get<Paginated<Doctor>>("/doctors/")
}

export function listSlots(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Slot>>(`/slots/${qs ? `?${qs}` : ""}`)
}

export function listAvailableSlots(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Slot[]>(`/slots/available/${qs ? `?${qs}` : ""}`)
}

export function listAppointments(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Appointment>>(`/appointments/${qs ? `?${qs}` : ""}`)
}

export function bookAppointment(payload: { patient: number; slot: number; source?: string; reason?: string }) {
  return api.post<Appointment>("/appointments/", payload)
}

const actionEndpoint: Record<string, string> = {
  checked_in: "check-in",
  in_consult: "start-consult",
  completed: "complete_action",
  cancelled: "cancel_action",
  no_show: "no-show",
}

export function transitionAppointment(id: number, toStatus: AppointmentStatus) {
  const endpoint = actionEndpoint[toStatus]
  return api.post<Appointment>(`/appointments/${id}/${endpoint}/`)
}

export function rescheduleAppointment(id: number, newSlot: number) {
  return api.post<Appointment>(`/appointments/${id}/reschedule/`, { new_slot: newSlot })
}

export function listWaitlist(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Waitlist>>(`/waitlist/${qs ? `?${qs}` : ""}`)
}

export function addToWaitlist(payload: { patient: number; doctor: number; department?: number; preferred_date?: string; notes?: string }) {
  return api.post<Waitlist>("/waitlist/", payload)
}

export function confirmWaitlist(id: number) {
  return api.post<Waitlist>(`/waitlist/${id}/confirm/`)
}

export function cancelWaitlist(id: number) {
  return api.post<Waitlist>(`/waitlist/${id}/cancel/`)
}

export function fetchDoctorQueue(doctorId: number, date: string) {
  return api.get<DoctorQueue>(`/doctors/${doctorId}/queue/?date=${date}`)
}

export function blockDoctorLeave(doctorId: number, payload: { start_date: string; end_date: string; reason?: string }) {
  return api.post<{ blocked: number; skipped_already_booked: number; booked_slot_ids: number[] }>(
    `/doctors/${doctorId}/block-leave/`,
    payload,
  )
}

export function unblockDoctorLeave(doctorId: number, payload: { start_date: string; end_date: string }) {
  return api.post<{ unblocked: number }>(`/doctors/${doctorId}/unblock-leave/`, payload)
}
