import { api } from "./client"
import type { Attendance, Employee, LeaveRequest, Paginated, Shift } from "../types/api"

export function listEmployees(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Employee>>(`/hr/employees/${qs ? `?${qs}` : ""}`)
}

export function createEmployee(data: {
  employee_code: string
  designation: string
  name_prefix?: string
  marital_status?: string
  employment_type?: Employee["employment_type"]
  department?: number
  bank_account_number?: string
  pan_number?: string
}) {
  return api.post<Employee>("/hr/employees/", data)
}

export function linkEmployeeUser(employeeId: number, userId: number) {
  return api.post<Employee>(`/hr/employees/${employeeId}/link_user/`, { user_id: userId })
}

export function listAttendance(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Attendance>>(`/hr/attendance/${qs ? `?${qs}` : ""}`)
}

export function createAttendance(data: {
  employee: number
  date?: string
  status: Attendance["status"]
  check_in?: string
  check_out?: string
}) {
  return api.post<Attendance>("/hr/attendance/", data)
}

export function listLeaveRequests(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<LeaveRequest>>(`/hr/leave-requests/${qs ? `?${qs}` : ""}`)
}

export function createLeaveRequest(data: {
  employee: number
  leave_type?: string
  leave_type_master?: number
  start_date: string
  end_date: string
  half_day?: boolean
  reason?: string
}) {
  return api.post<LeaveRequest>("/hr/leave-requests/", data)
}

export function approveLeaveRequest(id: number) {
  return api.post<LeaveRequest>(`/hr/leave-requests/${id}/approve/`)
}

export function rejectLeaveRequest(id: number) {
  return api.post<LeaveRequest>(`/hr/leave-requests/${id}/reject/`)
}

export function listShifts(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return api.get<Paginated<Shift>>(`/hr/shifts/${qs ? `?${qs}` : ""}`)
}

export function createShift(data: {
  employee: number
  shift_date: string
  shift_type: Shift["shift_type"]
}) {
  return api.post<Shift>("/hr/shifts/", data)
}
