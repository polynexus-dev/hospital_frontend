import { api } from "./client"
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

export function callPerformance() {
  return api.get<CallPerformanceReport>("/reports/call-performance/")
}

export function enquiryFunnel() {
  return api.get<EnquiryFunnelReport>("/reports/enquiry-funnel/")
}

export function departmentDoctorVolume() {
  return api.get<{ rows: DepartmentDoctorVolumeRow[] }>("/reports/department-doctor-volume/")
}

export function noShowEffectiveness() {
  return api.get<NoShowEffectivenessReport>("/reports/no-show-effectiveness/")
}

export function dailyMisPreview() {
  return api.get<DailyMisPreview>("/reports/daily-mis-preview/")
}

export function revenueBySource() {
  return api.get<RevenueBySourceReport>("/reports/revenue-by-source/")
}

export function reminderDelivery() {
  return api.get<ReminderDeliveryReport>("/reports/reminder-delivery/")
}

export function doctorRevenue() {
  return api.get<DoctorRevenueReport>("/reports/doctor-revenue/")
}
