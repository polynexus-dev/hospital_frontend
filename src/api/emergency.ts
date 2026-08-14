import { api } from "./client"
import type { EDVisit, Paginated, Triage } from "../types/api"

export function listEDVisits(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<EDVisit>>(`/emergency/ed-visits/${qs ? `?${qs}` : ""}`)
}

export function createEDVisit(data: { patient: number; chief_complaint: string }) {
  return api.post<EDVisit>("/emergency/ed-visits/", data)
}

export function createTriage(data: { ed_visit: number; triage_category: Triage["triage_category"]; vitals_summary?: string }) {
  return api.post<Triage>("/emergency/triages/", data)
}

export function admitEDVisitToIPD(edVisitId: number, data: { admitting_doctor: number; bed: number }) {
  return api.post(`/emergency/ed-visits/${edVisitId}/admit-to-ipd/`, data)
}
