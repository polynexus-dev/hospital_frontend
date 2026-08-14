import { api } from "./client"
import type { AnaesthesiaRecord, ConsumableUsage, ImplantUsage, OperativeNote, OTSchedule, Paginated, PreOpChecklist, SurgeryRequest } from "../types/api"

export function listSurgeryRequests(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<SurgeryRequest>>(`/ot/surgery-requests/${qs ? `?${qs}` : ""}`)
}

export function createSurgeryRequest(data: { patient: number; proposed_procedure: string; admission?: number }) {
  return api.post<SurgeryRequest>("/ot/surgery-requests/", data)
}

export function createOTSchedule(data: {
  surgery_request: number
  operation_theatre_room: string
  surgeon: number
  anaesthetist?: number
  scheduled_start: string
  scheduled_end: string
}) {
  return api.post<OTSchedule>("/ot/schedules/", data)
}

export function listOTSchedules() {
  return api.get<Paginated<OTSchedule>>("/ot/schedules/")
}

export function createOperativeNote(data: {
  ot_schedule: number
  procedure_performed: string
  findings?: string
  surgeon: number
  started_at: string
  ended_at: string
}) {
  return api.post<OperativeNote>("/ot/operative-notes/", data)
}

export function finalizeOperativeNote(id: number) {
  return api.post<OperativeNote>(`/ot/operative-notes/${id}/finalize/`)
}

export function createPreOpChecklist(data: {
  surgery_request: number
  consent_obtained: boolean
  fasting_confirmed: boolean
  site_marked: boolean
}) {
  return api.post<PreOpChecklist>("/ot/preop-checklists/", data)
}

export function createConsumableUsage(data: { ot_schedule: number; item_name: string; quantity: number }) {
  return api.post<ConsumableUsage>("/ot/consumables/", data)
}

export function createImplantUsage(data: { ot_schedule: number; implant_name: string; serial_number: string; quantity: number }) {
  return api.post<ImplantUsage>("/ot/implants/", data)
}

export function createAnaesthesiaRecord(data: {
  ot_schedule: number
  anaesthesia_type: string
  intra_op_notes?: string
  anaesthetist: number
}) {
  return api.post<AnaesthesiaRecord>("/ot/anaesthesia-records/", data)
}

export function finalizeAnaesthesiaRecord(id: number) {
  return api.post<AnaesthesiaRecord>(`/ot/anaesthesia-records/${id}/finalize/`)
}
