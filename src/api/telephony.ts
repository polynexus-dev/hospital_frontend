import { api } from "./client"
import type { Call, CallbackTask, Paginated } from "../types/api"

export function listCalls(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Call>>(`/calls/${qs ? `?${qs}` : ""}`)
}

export function clickToCall(toNumber: string, patientId?: number) {
  return api.post<Call>("/calls/click-to-call/", { to_number: toNumber, patient: patientId })
}

export function listCallbackTasks(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<CallbackTask>>(`/callback-tasks/${qs ? `?${qs}` : ""}`)
}

export function claimCallbackTask(id: number) {
  return api.post<CallbackTask>(`/callback-tasks/${id}/claim/`)
}

export function completeCallbackTask(id: number, notes?: string) {
  return api.post<CallbackTask>(`/callback-tasks/${id}/complete/`, { notes })
}

export function logCallbackAttempt(id: number) {
  return api.post<CallbackTask>(`/callback-tasks/${id}/log_attempt/`)
}

export interface OperatorProductivityRow {
  operator_id: number
  operator__email: string
  calls_handled: number
  answered: number
  missed: number
  avg_duration_seconds: number | null
}

export function operatorProductivity(params: { start?: string; end?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return api.get<OperatorProductivityRow[]>(`/calls/operator-productivity/${qs ? `?${qs}` : ""}`)
}
