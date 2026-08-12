import { api } from "./client"
import type { HISBillingRecord, HISVisit, IntegrationHealth, Paginated } from "../types/api"

export function integrationHealth() {
  return api.get<IntegrationHealth>("/integration-health/")
}

export function listHisBilling(patientId: number) {
  return api.get<Paginated<HISBillingRecord>>(`/his-billing/?patient=${patientId}`)
}

export function listHisVisits(patientId: number) {
  return api.get<Paginated<HISVisit>>(`/his-visits/?patient=${patientId}`)
}
