import { api } from "./client"
import type { Channel, ConsentOptOut, Message, Paginated, Template, Thread } from "../types/api"

export function listMessages(patientId?: number) {
  const qs = patientId ? `?patient=${patientId}&ordering=created_at` : ""
  return api.get<Paginated<Message>>(`/messages/${qs}`)
}

export function listRecentThreads() {
  return api.get<Paginated<Message>>("/messages/?ordering=-created_at")
}

export interface SendMessagePayload {
  patient: number
  channel: Channel
  purpose?: string
  body?: string
  message?: string
  template?: number | null
  template_id?: number | null
  context?: Record<string, string>
  fallback_channel?: Channel
}

export function sendMessage(payload: SendMessagePayload) {
  return api.post<Message>("/messages/send/", payload)
}

export function listTemplates(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Template>>(`/templates/${qs ? `?${qs}` : ""}`)
}

export function postInteractiveChatAction(payload: { action: string; language?: string; payload?: any }) {
  return api.post<{
    reply: string
    text: string
    options: Array<{ id: string; label: string }>
    step: string
    confirmed_details?: any
    requires_input?: string[] | null
    pending_slot_id?: number | null
  }>("/messages/ai-chat/", payload)
}

export function listThreads(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Thread>>(`/threads/${qs ? `?${qs}` : ""}`)
}

export function claimThread(id: number) {
  return api.post<Thread>(`/threads/${id}/claim/`)
}

export function markThreadRead(id: number) {
  return api.post<Thread>(`/threads/${id}/mark_read/`)
}

export function listConsent(patientId: number) {
  return api.get<Paginated<ConsentOptOut>>(`/consent/?patient=${patientId}`)
}

export function setConsent(id: number, isOptedOut: boolean) {
  return api.patch<ConsentOptOut>(`/consent/${id}/`, { is_opted_out: isOptedOut })
}

export function createConsent(payload: { patient: number; channel: Channel; purpose: ConsentOptOut["purpose"]; is_opted_out: boolean }) {
  return api.post<ConsentOptOut>("/consent/", payload)
}

export interface BroadcastCampaign {
  id: number
  title: string
  channel: Channel
  target_audience: "all_patients" | "unconverted_leads" | "follow_up_leads" | "chronic_care" | "senior_citizens"
  template: number | null
  custom_message: string
  scheduled_for: string | null
  status: "draft" | "scheduled" | "sending" | "completed" | "failed"
  total_recipients: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  created_by?: number | null
  created_by_name?: string
  created_at: string
  updated_at: string
}

export interface AudienceCountResponse {
  all_patients: number
  unconverted_leads: number
  follow_up_leads: number
  chronic_care: number
  senior_citizens: number
}

export function listBroadcastCampaigns() {
  return api.get<Paginated<BroadcastCampaign>>("/broadcasts/")
}

export function createBroadcastCampaign(payload: Partial<BroadcastCampaign>) {
  return api.post<BroadcastCampaign>("/broadcasts/", payload)
}

export function dispatchBroadcastCampaign(id: number) {
  return api.post<{ detail: string; campaign: BroadcastCampaign }>(`/broadcasts/${id}/dispatch/`)
}

export function getAudienceCounts() {
  return api.get<AudienceCountResponse>("/broadcasts/audience-count/")
}



