import { api } from "./client"
import type { Channel, ConsentOptOut, Message, Paginated, Template, Thread } from "../types/api"

export function listMessages(patientId?: number) {
  const qs = patientId ? `?patient=${patientId}&ordering=created_at` : ""
  return api.get<Paginated<Message>>(`/messages/${qs}`)
}

export function listRecentThreads() {
  return api.get<Paginated<Message>>("/messages/?ordering=-created_at")
}

export function sendMessage(payload: {
  patient: number
  channel: Channel
  purpose: string
  context?: Record<string, string>
  fallback_channel?: Channel
}) {
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


