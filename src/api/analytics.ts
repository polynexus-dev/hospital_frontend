import { api } from "./client"
import type {
  CallPerformanceReport,
  DailyMisPreview,
  DepartmentDoctorVolumeRow,
  DoctorRevenueReport,
  EnquiriesByDepartmentRow,
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

export function enquiriesByDepartment() {
  return api.get<{ rows: EnquiriesByDepartmentRow[] }>("/reports/enquiries-by-department/")
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

export interface OPDSnapshot {
  encounters_today: number
  waiting: number
  in_consult: number
  completed_today: number
}

export function opdSnapshot() {
  return api.get<OPDSnapshot>("/reports/opd-snapshot/")
}

export interface BedOccupancy {
  total_beds: number
  occupied_beds: number
  occupancy_pct: number
}

export function bedOccupancy() {
  return api.get<BedOccupancy>("/reports/bed-occupancy/")
}

export function doctorRevenue() {
  return api.get<DoctorRevenueReport>("/reports/doctor-revenue/")
}

export interface LabTAT {
  orders_today: number
  pending_orders: number
  avg_tat_minutes: number | null
}

export function labTAT() {
  return api.get<LabTAT>("/reports/lab-tat/")
}

export interface PharmacyLowStock {
  total_medicines: number
  low_stock_count: number
  low_stock_medicines: { id: number; name: string; available: number; reorder_level: number }[]
}

export function pharmacyLowStock() {
  return api.get<PharmacyLowStock>("/reports/pharmacy-low-stock/")
}
