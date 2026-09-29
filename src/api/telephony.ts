import { api } from "./client"
import type { Call, CallbackTask, Paginated, CallHistoryResponse } from "../types/api"
import { isUserOnCall, registerOutboundCall } from "../telephony/sipClient"

export function listCalls(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Call>>(`/calls/${qs ? `?${qs}` : ""}`)
}

export function getIncomingCallHistory(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<CallHistoryResponse>(`/calls/incoming-history/${qs ? `?${qs}` : ""}`)
}

export function getOutgoingCallHistory(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<CallHistoryResponse>(`/calls/outgoing-history/${qs ? `?${qs}` : ""}`)
}

export function getCall(id: number | string) {
  return api.get<Call>(`/calls/${id}/`)
}

export interface ActiveCallLeg {
  caller: string
  callee: string
  duration: string
  direction?: string
}

export function listActiveCalls() {
  return api.get<ActiveCallLeg[]>("/calls/active-calls/")
}

export function validateAndSanitizePhoneNumber(phone: string): { valid: boolean; sanitized: string; error?: string } {
  if (!phone || typeof phone !== "string") {
    return { valid: false, sanitized: "", error: "Phone number is required." }
  }
  const sanitized = phone.trim().replace(/[\s\-\(\)\.]/g, "")
  const phoneRegex = /^\+?[0-9]{7,15}$/
  if (!phoneRegex.test(sanitized)) {
    return {
      valid: false,
      sanitized,
      error: "Invalid phone number format. Please provide a valid 7 to 15 digit phone number.",
    }
  }
  return { valid: true, sanitized }
}

export function clickToCall(toNumber: string, patientId?: number) {
  const check = validateAndSanitizePhoneNumber(toNumber)
  if (!check.valid) {
    return Promise.reject(new Error(check.error || "Invalid phone number provided."))
  }
  if (isUserOnCall()) {
    return Promise.reject(
      new Error("Cannot place call: You are already on an active call. Please hang up before placing another call.")
    )
  }
  registerOutboundCall(check.sanitized)
  return api.post<Call>("/calls/click-to-call/", { to_number: check.sanitized, patient: patientId })
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
