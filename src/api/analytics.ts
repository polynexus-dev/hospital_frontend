import { api, triggerBlobDownload } from "./client"
import type {
  CallPerformanceReport,
  DailyMisPreview,
  DepartmentDoctorVolumeRow,
  DoctorRevenueReport,
  EnquiryFunnelReport,
  NoShowEffectivenessReport,
  ReminderDeliveryReport,
  RevenueBySourceReport,
} from "../types/api"

export interface ReportDateParams {
  start?: string
  end?: string
}

function buildQs(params?: ReportDateParams) {
  if (!params) return ""
  const query = new URLSearchParams()
  if (params.start) query.set("start", params.start)
  if (params.end) query.set("end", params.end)
  const s = query.toString()
  return s ? `?${s}` : ""
}

export function callPerformance(params?: ReportDateParams) {
  return api.get<CallPerformanceReport>(`/reports/call-performance/${buildQs(params)}`)
}

export function enquiryFunnel(params?: ReportDateParams) {
  return api.get<EnquiryFunnelReport>(`/reports/enquiry-funnel/${buildQs(params)}`)
}

export function departmentDoctorVolume(params?: ReportDateParams) {
  return api.get<{ rows: DepartmentDoctorVolumeRow[] }>(`/reports/department-doctor-volume/${buildQs(params)}`)
}

export function noShowEffectiveness(params?: ReportDateParams) {
  return api.get<NoShowEffectivenessReport>(`/reports/no-show-effectiveness/${buildQs(params)}`)
}

export function dailyMisPreview(params?: ReportDateParams) {
  return api.get<DailyMisPreview>(`/reports/daily-mis-preview/${buildQs(params)}`)
}

export function revenueBySource(params?: ReportDateParams) {
  return api.get<RevenueBySourceReport>(`/reports/revenue-by-source/${buildQs(params)}`)
}

export function reminderDelivery(params?: ReportDateParams) {
  return api.get<ReminderDeliveryReport>(`/reports/reminder-delivery/${buildQs(params)}`)
}

export function doctorRevenue(params?: ReportDateParams) {
  return api.get<DoctorRevenueReport>(`/reports/doctor-revenue/${buildQs(params)}`)
}

export async function exportMISReport(format: "pdf" | "csv", params?: ReportDateParams) {
  const query = new URLSearchParams()
  query.set("format", format)
  if (params?.start) query.set("start", params.start)
  if (params?.end) query.set("end", params.end)
  const blob = await api.getBlob(`/reports/mis-export/?${query.toString()}`)
  const ext = format === "csv" ? "csv" : "pdf"
  const startStr = params?.start || "start"
  const endStr = params?.end || "end"
  triggerBlobDownload(blob, `MIS_Report_${startStr}_to_${endStr}.${ext}`)
}
