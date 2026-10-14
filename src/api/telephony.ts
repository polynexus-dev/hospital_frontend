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

// ─── AI call analysis & missed opportunities ────────────────────────────────

export interface CallAnalysis {
  id: number
  transcript: string
  call_reason: string
  ai_summary: string
  ai_lead_class: string
  ai_booking_intent: boolean | null
  ai_status: string
  ai_error: string
  ai_processed_at: string | null
  missed_opportunity: string
  missed_opportunity_at: string | null
}

export function getCallAnalysis(id: number | string) {
  return api.get<CallAnalysis>(`/calls/${id}/analysis/`)
}

export function reanalyseCall(id: number | string) {
  return api.post<CallAnalysis>(`/calls/${id}/analyse/`)
}

export interface MissedOpportunityReport {
  from: string
  to: string
  summary: {
    missed_opportunities: number
    unreturned: number
    not_booked: number
    analysed_calls: number
    booking_intent_calls: number
    lead_classes: Record<string, number>
  }
  flagged: Call[]
}

export function getMissedOpportunities(params: { start?: string; end?: string } = {}) {
  const qs = new URLSearchParams(params as Record<string, string>).toString()
  return api.get<MissedOpportunityReport>(`/calls/missed-opportunities/${qs ? `?${qs}` : ""}`)
}

// ─── Live call queue ─────────────────────────────────────────────────────────

export interface QueuedCaller {
  id: number
  caller: string
  patient_id: number | null
  patient_name: string
  queue: string
  department: string
  language: string
  path: string
  position: number
  waiting_seconds: number
  estimated_wait_seconds: number
}

export interface LiveQueue {
  waiting: QueuedCaller[]
  today: { queued: number; answered: number; abandoned: number; callbacks_requested: number; avg_wait_seconds: number | null }
}

export function getLiveQueue() {
  return api.get<LiveQueue>("/call-queue/")
}

// ─── Phone menu (dynamic IVR) ───────────────────────────────────────────────

export type IVRAction = "menu" | "language" | "queue" | "info" | "callback" | "booking_link"

export interface IVRNode {
  id: number
  menu: number
  parent: number | null
  digit: string
  label: string
  action: IVRAction
  prompt: string
  language: string
  department: number | null
  queue_target: string
  queue_agents: number
  sort_order: number
}

export interface IVRMenu {
  id: number
  name: string
  dial_in_number: string
  is_active: boolean
  fallback_target: string
  hold_announce_seconds: number
  hold_info_text: string
  booking_url: string
  nodes: IVRNode[]
  webhooks: { step: string; hold: string; event: string }
  created_at: string
}

export interface IVRReply {
  action: "collect" | "queue" | "hold" | "transfer" | "hangup" | "none"
  say: string
  language: string
  target?: string
  position?: number
  estimated_wait_seconds?: number
  call_id: string
  state: string
  path: string
}

export function listIVRMenus() {
  return api.get<Paginated<IVRMenu>>("/ivr-menus/")
}

export function createIVRMenu(body: Partial<IVRMenu>) {
  return api.post<IVRMenu>("/ivr-menus/", body)
}

export function updateIVRMenu(id: number, body: Partial<IVRMenu>) {
  return api.patch<IVRMenu>(`/ivr-menus/${id}/`, body)
}

export function deleteIVRMenu(id: number) {
  return api.delete(`/ivr-menus/${id}/`)
}

export function rotateIVRMenuToken(id: number) {
  return api.post<IVRMenu>(`/ivr-menus/${id}/rotate-token/`)
}

export function simulateIVRMenu(id: number, body: { call_id?: string; digits?: string; hold?: boolean }) {
  return api.post<IVRReply>(`/ivr-menus/${id}/simulate/`, body)
}

export function createIVRNode(body: Partial<IVRNode>) {
  return api.post<IVRNode>("/ivr-nodes/", body)
}

export function updateIVRNode(id: number, body: Partial<IVRNode>) {
  return api.patch<IVRNode>(`/ivr-nodes/${id}/`, body)
}

export function deleteIVRNode(id: number) {
  return api.delete(`/ivr-nodes/${id}/`)
}
