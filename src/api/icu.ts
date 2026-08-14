import { api } from "./client"
import type { ICUAdmission, ICUDailyProgressNote, Paginated, VentilatorLog } from "../types/api"

export function listICUAdmissions() {
  return api.get<Paginated<ICUAdmission>>("/icu/admissions/")
}

export function createICUAdmission(data: { admission: number; bed: number; ventilator_required?: boolean }) {
  return api.post<ICUAdmission>("/icu/admissions/", data)
}

export function createVentilatorLog(data: { icu_admission: number; mode: string; ventilator_settings?: Record<string, unknown> }) {
  return api.post<VentilatorLog>("/icu/ventilator-logs/", data)
}

export function createICUProgressNote(data: { icu_admission: number; doctor: number; note: string }) {
  return api.post<ICUDailyProgressNote>("/icu/progress-notes/", data)
}

export function finalizeICUProgressNote(id: number) {
  return api.post<ICUDailyProgressNote>(`/icu/progress-notes/${id}/finalize/`)
}
