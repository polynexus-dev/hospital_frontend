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

export interface Trend {
  value: number
  change_pct: number | null
}

/** GET /reports/live-dashboard/ — every owner-dashboard figure from live records (end date inclusive). */
export interface LiveDashboard {
  generated_at: string
  calls: { received: Trend; answered: Trend; missed: Trend }
  opd: {
    completed: Trend
    encounters: Trend
    avg_wait_minutes: { value: number | null; change_minutes: number | null }
  }
  now: { waiting: number; in_consultation: number; consults_done_today: number; lab_pending: number; radiology_pending: number }
  enquiries: { new: number; contacted: number; follow_up: number; converted: number; total: number }
  revenue_by_service: { service: string; amount: string }[]
  doctor_billed: string
  department_volume: { department_id: number | null; department: string; count: number }[]
  filters: { departments: { id: number; name: string }[] }
}

export function liveDashboard(params: ReportDateParams & { department?: string; doctor?: string }) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v && v !== "all" && query.set(k, v))
  return api.get<LiveDashboard>(`/reports/live-dashboard/?${query}`)
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
