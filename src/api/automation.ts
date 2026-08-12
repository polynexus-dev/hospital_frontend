import { api } from "./client"
import type { AutomationTask, EscalationRule, Paginated } from "../types/api"

export function listTasks(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<AutomationTask>>(`/tasks/${qs ? `?${qs}` : ""}`)
}

export function claimTask(id: number) {
  return api.post<AutomationTask>(`/tasks/${id}/claim/`)
}

export function completeTask(id: number) {
  return api.post<AutomationTask>(`/tasks/${id}/complete/`)
}

export function listEscalationRules() {
  return api.get<Paginated<EscalationRule>>("/escalation-rules/")
}
